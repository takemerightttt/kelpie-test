import { ResponseFormatError, type ImportsApi } from "./api";
import { checkFile, HEAD_BYTES, type FileCheck } from "./fileCheck";
import { sizeBucket, type SafeLog } from "./log";
import { applyView } from "./rules";
import type { Operation } from "./types";

/** A file the user picked: already a private temporary copy made by the picker. */
export type PickedFile = { uri: string; name: string };

export interface FileStore {
  /** Size from metadata and the first `headBytes` bytes - never the whole file. */
  inspect(
    uri: string,
    headBytes: number,
  ): Promise<{ size: number; head: Uint8Array }>;
  /** Moves the picked temporary file into the app's private import folder. */
  keepPrivate(uri: string, key: string): Promise<string>;
  /** Deletes a private copy; missing files are fine. */
  remove(uri: string): Promise<void>;
  /** URIs of every file in the private import folder. */
  listPrivate(): Promise<string[]>;
  /** Removes copies the OS picker left outside our control (iOS Inbox). No-op where there are none. */
  removeSystemCopies(): Promise<void>;
}

export interface OperationStore {
  load(): Promise<Operation | null>;
  save(operation: Operation | null): Promise<void>;
}

export type Dependencies = {
  api: ImportsApi;
  files: FileStore;
  store: OperationStore;
  newKey: () => string;
  log: SafeLog;
};

/**
 * After a passing check the file is already in the app's private folder under its key: picker copies
 * live in the cache, which the OS may clear while the user is still on the confirmation screen.
 */
export type Inspected = {
  file: PickedFile;
  size: number;
  check: FileCheck;
  key: string | null;
  privateUri: string | null;
};

/**
 * The import flow, independent of React Native. Every server-changing request
 * is preceded by a save of the operation, so a crash or relaunch at any point
 * resumes from storage. Nothing here re-sends a file on its own: after a lost
 * answer the job is looked up by its key, and a second POST happens only when
 * the user presses "retry" - with the same key and the same bytes.
 *
 * Public methods run one at a time on a queue: a poll in flight and a delete, or a foreground
 * resume and an upload, never interleave their reads and writes of the operation.
 */
export class ImportController {
  private queue: Promise<unknown> = Promise.resolve();
  /** The full operation, report items included; undefined until the store has been read. */
  private live: Operation | null | undefined = undefined;
  /** Copies made by inspect() that wait on the confirmation screen; the sweep keeps them. */
  private readonly awaitingConfirm = new Set<string>();

  constructor(private readonly deps: Dependencies) {}

  current(): Promise<Operation | null> {
    return this.run(() => this.load());
  }

  /** Local validation before anything leaves the device. Rejected files are deleted right away. */
  inspect(file: PickedFile): Promise<Inspected> {
    return this.run(() => this.inspectFile(file));
  }

  /** The user cancelled on the confirmation screen. */
  discard(inspected: Inspected): Promise<void> {
    return this.run(async () => {
      if (inspected.privateUri)
        this.awaitingConfirm.delete(inspected.privateUri);
      await this.deps.files.remove(inspected.privateUri ?? inspected.file.uri);
    });
  }

  /** Confirmed: the key is created and stored before the first byte is sent. */
  confirm(inspected: Inspected): Promise<Operation> {
    return this.run(() => this.confirmFile(inspected));
  }

  /** On app start and on foreground: show the real job state, never re-send. */
  resume(): Promise<Operation | null> {
    return this.run(async () => {
      const operation = await this.load();
      await this.sweep(operation);
      await this.removeSystemCopies();
      if (!operation) return null;
      if (operation.phase === "sending" || operation.phase === "uncertain")
        return this.findByKey(operation);
      if (operation.phase === "created")
        return (await this.pollJob()).operation;
      return operation;
    });
  }

  /** User action after an uncertain POST: the same key with the same bytes. */
  retrySend(): Promise<Operation | null> {
    return this.run(async () => {
      const operation = await this.load();
      if (
        !operation ||
        operation.phase !== "uncertain" ||
        !operation.localCopyUri
      )
        return operation;
      return this.send(
        await this.persist({ ...operation, phase: "sending", error: null }),
      );
    });
  }

  /** User action: ask the server again by key (no upload). */
  checkByKey(): Promise<Operation | null> {
    return this.run(async () => {
      const operation = await this.load();
      if (
        !operation ||
        (operation.phase !== "uncertain" && operation.phase !== "sending")
      )
        return operation;
      return this.findByKey(operation);
    });
  }

  async refresh(): Promise<Operation | null> {
    return (await this.poll()).operation;
  }

  /**
   * One status check. `reachable: false` means the server could not be asked (network) or answered
   * in an unexpected shape - the caller backs off instead of polling at a fixed rate.
   * The answer is the operation after the tasks queued during the check (a delete the user pressed
   * while the GET was in flight), so a poll result never puts an older state back on screen.
   */
  async poll(): Promise<{ operation: Operation | null; reachable: boolean }> {
    const { reachable } = await this.run(() => this.pollJob());
    return { operation: await this.run(() => this.load()), reachable };
  }

  /** The delete key is stored before the request, so a retry reuses it. */
  requestDelete(): Promise<Operation | null> {
    return this.run(() => this.deleteJob());
  }

  /** Start over. Allowed when nothing is pending on the server side. */
  reset(): Promise<void> {
    return this.run(async () => {
      const operation = await this.load();
      if (operation?.localCopyUri)
        await this.deps.files.remove(operation.localCopyUri);
      await this.deps.store.save(null);
      this.live = null;
    });
  }

  /** Chains a task after the previous one; a failed task does not block the next. */
  private run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.queue.then(task);
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async load(): Promise<Operation | null> {
    if (this.live === undefined) this.live = await this.deps.store.load();
    return this.live;
  }

  /**
   * A copy is created in inspect() before the user confirms; if the app is killed on the
   * confirmation screen nothing else would ever delete it.
   */
  private async sweep(operation: Operation | null): Promise<void> {
    for (const uri of await this.deps.files.listPrivate()) {
      if (uri === operation?.localCopyUri || this.awaitingConfirm.has(uri))
        continue;
      await this.deps.files.remove(uri);
    }
  }

  private async inspectFile(file: PickedFile): Promise<Inspected> {
    const { size, head } = await this.deps.files.inspect(file.uri, HEAD_BYTES);
    const check = checkFile(size, head);
    this.deps.log("file_checked", {
      sizeBucket: sizeBucket(size),
      format: check.ok ? check.format : undefined,
      reason: check.ok ? undefined : check.reason,
    });
    if (!check.ok) {
      await this.deps.files.remove(file.uri);
      await this.removeSystemCopies();
      return { file, size, check, key: null, privateUri: null };
    }
    const key = this.deps.newKey();
    const privateUri = await this.deps.files.keepPrivate(file.uri, key);
    this.awaitingConfirm.add(privateUri);
    await this.removeSystemCopies();
    return { file, size, check, key, privateUri };
  }

  /** The picker's own copy (iOS Inbox) is not ours to keep; a failed cleanup never breaks the flow. */
  private async removeSystemCopies(): Promise<void> {
    try {
      await this.deps.files.removeSystemCopies();
    } catch {
      this.deps.log("system_copy_cleanup_failed");
    }
  }

  private async confirmFile(inspected: Inspected): Promise<Operation> {
    if (!inspected.check.ok || !inspected.key || !inspected.privateUri)
      throw new Error("cannot send a rejected file");
    const key = inspected.key;
    const localCopyUri = inspected.privateUri;
    this.awaitingConfirm.delete(localCopyUri);
    const operation: Operation = {
      key,
      fileName: inspected.file.name,
      size: inspected.size,
      format: inspected.check.format,
      localCopyUri,
      phase: "sending",
      jobId: null,
      job: null,
      deleteKey: null,
      deleteError: null,
      error: null,
    };
    return this.send(await this.persist(operation));
  }

  private async pollJob(): Promise<{
    operation: Operation | null;
    reachable: boolean;
  }> {
    const operation = await this.load();
    if (!operation || !operation.jobId || operation.phase !== "created")
      return { operation, reachable: true };
    try {
      const response = await this.deps.api.getJob(operation.jobId);
      if (response.kind === "not_found")
        return {
          operation: await this.markMissing(operation),
          reachable: true,
        };
      if (response.kind !== "found") return { operation, reachable: false };
      const next = applyView(operation, response.view);
      if (next === operation) {
        this.deps.log("stale_response_ignored", {
          jobId: operation.jobId,
          status: response.view.status,
          revision: response.view.revision,
        });
        return { operation, reachable: true };
      }
      return { operation: await this.persist(next), reachable: true };
    } catch (error) {
      this.deps.log("poll_failed", {
        jobId: operation.jobId,
        reason:
          error instanceof ResponseFormatError ? "bad_response" : "network",
      });
      return { operation, reachable: false };
    }
  }

  private async deleteJob(): Promise<Operation | null> {
    const stored = await this.load();
    if (!stored || !stored.jobId || stored.phase !== "created") return stored;
    const operation = stored.deleteKey
      ? stored
      : await this.persist({ ...stored, deleteKey: this.deps.newKey() });
    try {
      const response = await this.deps.api.remove(
        operation.jobId as string,
        operation.deleteKey as string,
      );
      if (response.kind === "accepted") {
        this.deps.log("delete_accepted", {
          jobId: operation.jobId,
          status: response.view.status,
        });
        return this.persist({
          ...applyView(operation, response.view),
          deleteError: null,
        });
      }
      if (response.status === 404) return this.markMissing(operation);
      this.deps.log("delete_failed", {
        jobId: operation.jobId,
        httpStatus: response.status,
      });
      return this.persist({
        ...operation,
        deleteError: `server_${response.status}`,
      });
    } catch {
      this.deps.log("delete_failed", {
        jobId: operation.jobId,
        reason: "network",
      });
      return this.persist({ ...operation, deleteError: "network" });
    }
  }

  private async send(operation: Operation): Promise<Operation> {
    if (!operation.localCopyUri) return this.findByKey(operation);
    try {
      const response = await this.deps.api.create(
        operation.key,
        operation.fileName,
        operation.localCopyUri,
      );
      if (response.kind === "accepted") {
        this.deps.log("import_created", {
          jobId: response.view.jobId,
          status: response.view.status,
          revision: response.view.revision,
        });
        return this.dropCopy(
          applyView({ ...operation, error: null }, response.view),
        );
      }
      if (response.kind === "server_error") {
        this.deps.log("import_uncertain", { httpStatus: response.status });
        return this.findByKey(
          await this.persist({ ...operation, phase: "uncertain" }),
        );
      }
      const error =
        response.kind === "conflict"
          ? "key_conflict"
          : `rejected_${response.status}`;
      this.deps.log("import_rejected", { reason: error });
      return this.dropCopy({ ...operation, phase: "failed", error });
    } catch (error) {
      // A 202 in an unknown shape still means the server took the file; no answer means it may or may
      // not have. Either way: look the job up by key, never re-send on our own.
      const reason =
        error instanceof ResponseFormatError ? "bad_response" : "no_answer";
      this.deps.log("import_uncertain", { reason });
      return this.findByKey(
        await this.persist({ ...operation, phase: "uncertain" }),
      );
    }
  }

  private async findByKey(operation: Operation): Promise<Operation> {
    try {
      const response = await this.deps.api.findByKey(operation.key);
      if (response.kind === "found") {
        this.deps.log("import_recovered", {
          jobId: response.view.jobId,
          status: response.view.status,
          revision: response.view.revision,
        });
        return this.dropCopy(
          applyView({ ...operation, error: null }, response.view),
        );
      }
      return this.persist({
        ...operation,
        phase: "uncertain",
        error:
          response.kind === "not_found"
            ? "not_found_yet"
            : `lookup_${response.status}`,
      });
    } catch (error) {
      return this.persist({
        ...operation,
        phase: "uncertain",
        error:
          error instanceof ResponseFormatError ? "bad_response" : "network",
      });
    }
  }

  /**
   * 404 for a job the server had created: it no longer knows the import. Not "deleted" (no confirmation)
   * and not a network error, so nothing retries on its own; the user can only start over.
   */
  private async markMissing(operation: Operation): Promise<Operation> {
    this.deps.log("job_missing", { jobId: operation.jobId });
    return this.persist({
      ...operation,
      phase: "missing",
      deleteError: null,
      error: null,
    });
  }

  /** The server has the job (or refused it): the private copy is no longer needed. */
  private async dropCopy(operation: Operation): Promise<Operation> {
    if (operation.localCopyUri)
      await this.deps.files.remove(operation.localCopyUri);
    return this.persist({ ...operation, localCopyUri: null });
  }

  /**
   * Saves the operation without the report items: transaction data is not kept at rest on the device.
   * The full operation stays in memory; after a relaunch the report is fetched again from the server.
   */
  private async persist(operation: Operation): Promise<Operation> {
    const atRest = operation.job?.items
      ? { ...operation, job: { ...operation.job, items: undefined } }
      : operation;
    await this.deps.store.save(atRest);
    this.live = operation;
    return operation;
  }
}
