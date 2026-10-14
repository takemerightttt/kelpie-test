import type { ImportsApi } from './api';
import { checkFile, HEAD_BYTES, type FileCheck } from './fileCheck';
import { sizeBucket, type SafeLog } from './log';
import { applyView } from './rules';
import type { Operation } from './types';

/** A file the user picked: already a private temporary copy made by the picker. */
export type PickedFile = { uri: string; name: string };

export interface FileStore {
  /** Size from metadata and the first `headBytes` bytes - never the whole file. */
  inspect(uri: string, headBytes: number): Promise<{ size: number; head: Uint8Array }>;
  /** Moves the picked temporary file into the app's private import folder. */
  keepPrivate(uri: string, key: string): Promise<string>;
  /** Deletes a private copy; missing files are fine. */
  remove(uri: string): Promise<void>;
}

export interface OperationStore {
  load(): Promise<Operation | null>;
  save(op: Operation | null): Promise<void>;
}

export type Deps = {
  api: ImportsApi;
  files: FileStore;
  store: OperationStore;
  newKey: () => string;
  log: SafeLog;
};

export type Inspected = { file: PickedFile; size: number; check: FileCheck };

/**
 * The import flow, independent of React Native. Every server-changing request
 * is preceded by a save of the operation, so a crash or relaunch at any point
 * resumes from storage. Nothing here re-sends a file on its own: after a lost
 * answer the job is looked up by its key, and a second POST happens only when
 * the user presses "retry" - with the same key and the same bytes.
 */
export class ImportController {
  constructor(private readonly d: Deps) {}

  async current(): Promise<Operation | null> {
    return this.d.store.load();
  }

  /** Local validation before anything leaves the device. Rejected files are deleted right away. */
  async inspect(file: PickedFile): Promise<Inspected> {
    const { size, head } = await this.d.files.inspect(file.uri, HEAD_BYTES);
    const check = checkFile(size, head);
    this.d.log('file_checked', { sizeBucket: sizeBucket(size), format: check.ok ? check.format : undefined, reason: check.ok ? undefined : check.reason });
    if (!check.ok) await this.d.files.remove(file.uri);
    return { file, size, check };
  }

  /** The user cancelled on the confirmation screen. */
  async discard(file: PickedFile): Promise<void> {
    await this.d.files.remove(file.uri);
  }

  /** Confirmed: the key is created and stored before the first byte is sent. */
  async confirm(inspected: Inspected): Promise<Operation> {
    if (!inspected.check.ok) throw new Error('cannot send a rejected file');
    const key = this.d.newKey();
    const localCopyUri = await this.d.files.keepPrivate(inspected.file.uri, key);
    const op: Operation = {
      key,
      fileName: inspected.file.name,
      size: inspected.size,
      format: inspected.check.format,
      localCopyUri,
      phase: 'sending',
      jobId: null,
      job: null,
      deleteKey: null,
      deleteError: null,
      error: null,
    };
    await this.d.store.save(op);
    return this.send(op);
  }

  /** On app start: show the real job state, never re-send. */
  async resume(): Promise<Operation | null> {
    const op = await this.d.store.load();
    if (!op) return null;
    if (op.phase === 'sending' || op.phase === 'uncertain') return this.findByKey(op);
    if (op.phase === 'created') return this.refresh();
    return op;
  }

  /** User action after an uncertain POST: the same key with the same bytes. */
  async retrySend(): Promise<Operation | null> {
    const op = await this.d.store.load();
    if (!op || op.phase !== 'uncertain' || !op.localCopyUri) return op;
    const sending = { ...op, phase: 'sending' as const, error: null };
    await this.d.store.save(sending);
    return this.send(sending);
  }

  /** User action: ask the server again by key (no upload). */
  async checkByKey(): Promise<Operation | null> {
    const op = await this.d.store.load();
    if (!op || (op.phase !== 'uncertain' && op.phase !== 'sending')) return op;
    return this.findByKey(op);
  }

  async refresh(): Promise<Operation | null> {
    const op = await this.d.store.load();
    if (!op || !op.jobId) return op;
    try {
      const res = await this.d.api.getJob(op.jobId);
      if (res.kind !== 'found') return op;
      const next = applyView(op, res.view);
      if (next === op) {
        this.d.log('stale_response_ignored', { jobId: op.jobId, status: res.view.status, revision: res.view.revision });
        return op;
      }
      return this.persist(next);
    } catch {
      return op;
    }
  }

  /** The delete key is stored before the request, so a retry reuses it. */
  async requestDelete(): Promise<Operation | null> {
    const stored = await this.d.store.load();
    if (!stored || !stored.jobId) return stored;
    const op = stored.deleteKey ? stored : await this.persist({ ...stored, deleteKey: this.d.newKey() });
    try {
      const res = await this.d.api.remove(op.jobId as string, op.deleteKey as string);
      if (res.kind === 'accepted') {
        this.d.log('delete_accepted', { jobId: op.jobId, status: res.view.status });
        return this.persist({ ...applyView(op, res.view), deleteError: null });
      }
      this.d.log('delete_failed', { jobId: op.jobId, httpStatus: res.status });
      return this.persist({ ...op, deleteError: `server_${res.status}` });
    } catch {
      this.d.log('delete_failed', { jobId: op.jobId, reason: 'network' });
      return this.persist({ ...op, deleteError: 'network' });
    }
  }

  /** Start over. Allowed when nothing is pending on the server side. */
  async reset(): Promise<void> {
    const op = await this.d.store.load();
    if (op?.localCopyUri) await this.d.files.remove(op.localCopyUri);
    await this.d.store.save(null);
  }

  private async send(op: Operation): Promise<Operation> {
    if (!op.localCopyUri) return this.findByKey(op);
    try {
      const res = await this.d.api.create(op.key, op.fileName, op.localCopyUri);
      if (res.kind === 'accepted') {
        this.d.log('import_created', { jobId: res.view.jobId, status: res.view.status, revision: res.view.revision });
        return this.dropCopy(applyView({ ...op, error: null }, res.view));
      }
      if (res.kind === 'server_error') {
        this.d.log('import_uncertain', { httpStatus: res.status });
        return this.findByKey(await this.persist({ ...op, phase: 'uncertain' }));
      }
      const error = res.kind === 'conflict' ? 'key_conflict' : `rejected_${res.status}`;
      this.d.log('import_rejected', { reason: error });
      return this.dropCopy({ ...op, phase: 'failed', error });
    } catch {
      // No answer: the job may or may not exist. Ask by key instead of re-sending.
      this.d.log('import_no_answer', { phase: 'uncertain' });
      return this.findByKey(await this.persist({ ...op, phase: 'uncertain' }));
    }
  }

  private async findByKey(op: Operation): Promise<Operation> {
    try {
      const res = await this.d.api.findByKey(op.key);
      if (res.kind === 'found') {
        this.d.log('import_recovered', { jobId: res.view.jobId, status: res.view.status, revision: res.view.revision });
        return this.dropCopy(applyView({ ...op, error: null }, res.view));
      }
      return this.persist({ ...op, phase: 'uncertain', error: res.kind === 'not_found' ? 'not_found_yet' : `lookup_${res.status}` });
    } catch {
      return this.persist({ ...op, phase: 'uncertain', error: 'network' });
    }
  }

  /** The server has the job (or refused it): the private copy is no longer needed. */
  private async dropCopy(op: Operation): Promise<Operation> {
    if (op.localCopyUri) await this.d.files.remove(op.localCopyUri);
    return this.persist({ ...op, localCopyUri: null });
  }

  private async persist(op: Operation): Promise<Operation> {
    await this.d.store.save(op);
    return op;
  }
}
