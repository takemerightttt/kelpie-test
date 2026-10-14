// Runs the real controller against the unmodified mock server (mock-kit/),
// one test per row of the acceptance matrix. Counters come from /__test/state.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ImportsApi } from '../../src/core/api';
import { ImportController } from '../../src/core/controller';
import { silentLog } from '../../src/core/log';
import { MemoryStore, NodeFiles, NodeHttp, FIXTURES, KIT_DIR, newKey, pickFixture, startMock, until } from '../support/node';

jest.setTimeout(20000);

let mock: { base: string; stop: () => Promise<void> };
let api: ImportsApi;

function controller(store = new MemoryStore(), files = new NodeFiles()) {
  return { c: new ImportController({ api, files, store, newKey, log: silentLog }), store, files };
}

beforeAll(() => {
  if (!existsSync(join(FIXTURES, 'oversize.csv'))) execFileSync(process.execPath, ['make-oversize.mjs'], { cwd: KIT_DIR });
});

beforeEach(async () => {
  mock = await startMock();
  api = new ImportsApi(new NodeHttp(mock.base));
});

afterEach(async () => {
  await mock.stop();
});

const ready = (c: ImportController) => until(() => c.refresh(), (op) => op?.job?.status === 'ready');

describe('acceptance matrix against the mock', () => {
  it('happy: bytes are sent, 202 is not a report, ready shows two items', async () => {
    const { c, files } = controller();
    const inspected = await c.inspect(pickFixture('statement.csv'));
    const created = await c.confirm(inspected);
    expect(created.job?.status).toBe('queued');
    expect(created.job?.items).toBeUndefined();
    const done = await ready(c);
    expect(done?.job?.items?.map((i) => i.merchant)).toEqual(['StreamBeam', 'BrightGrid']);
    const state = await api.mockState();
    expect(state.stats).toMatchObject({ createRequests: 1, newJobs: 1 });
    expect(state.stats.acceptedBytes).toBeGreaterThan(0);
    expect(readdirSync(files.dir)).toEqual([]); // private copy removed once the server has the job
  });

  it('happy with the PDF fixture too', async () => {
    const { c } = controller();
    await c.confirm(await c.inspect(pickFixture('statement.pdf')));
    expect((await ready(c))?.job?.currency).toBe('AUD');
  });

  it('lost_ack: the job is found by key, newJobs stays 1, nothing is re-sent on relaunch', async () => {
    await api.setScenario('lost_ack');
    const store = new MemoryStore();
    const first = controller(store);
    const op = await first.c.confirm(await first.c.inspect(pickFixture('statement.csv')));
    expect(op.jobId).toBe('job-demo-001'); // recovered through GET /imports/by-key
    // Relaunch: a new controller over the same storage.
    const relaunched = controller(store, first.files);
    const resumed = await relaunched.c.resume();
    expect(resumed?.jobId).toBe('job-demo-001');
    const state = await api.mockState();
    expect(state.stats.newJobs).toBe(1);
    expect(state.stats.createRequests).toBe(1);
  });

  it('lost_ack + manual retry with the same key and bytes does not create a second job', async () => {
    await api.setScenario('lost_ack');
    const store = new MemoryStore();
    const { c } = controller(store);
    const op = await c.confirm(await c.inspect(pickFixture('statement.csv')));
    // Force the "outcome unknown" branch, as if by-key had answered 404 at that instant.
    await store.save({ ...op, phase: 'uncertain', localCopyUri: (await new NodeFiles().keepPrivate(pickFixture('statement.csv').uri, op.key)) });
    await api.setScenario('happy');
    const retried = await c.retrySend();
    expect(retried?.jobId).toBe('job-demo-001');
    const state = await api.mockState();
    expect(state.stats).toMatchObject({ newJobs: 1, duplicateHits: 1 });
  });

  it('stale_status: ready/3 then processing/2 - the screen stays on ready', async () => {
    const { c } = controller();
    const created = await c.confirm(await c.inspect(pickFixture('statement.csv')));
    expect(created.jobId).toBeTruthy();
    await api.setScenario('stale_status');
    const first = await c.refresh();
    expect(first?.job).toMatchObject({ status: 'ready', revision: 3 });
    const second = await c.refresh(); // the mock answers processing/2 here
    expect(second?.job).toMatchObject({ status: 'ready', revision: 3 });
  });

  it('delete_failure: 503 is not a deletion; after happy the same key reaches deleted', async () => {
    const { c } = controller();
    await c.confirm(await c.inspect(pickFixture('statement.csv')));
    await ready(c);
    await api.setScenario('delete_failure');
    const failed = await c.requestDelete();
    expect(failed?.deleteError).toBe('server_503');
    expect(failed?.job?.status).toBe('ready');
    const deleteKey = failed?.deleteKey;
    const late = await c.refresh(); // a late "ready" must not undo the delete intent
    expect(late?.deleteKey).toBe(deleteKey);
    await api.setScenario('happy');
    const accepted = await c.requestDelete();
    expect(accepted?.deleteKey).toBe(deleteKey);
    expect(accepted?.job?.status).toBe('deleting');
    const gone = await until(() => c.refresh(), (op) => op?.job?.status === 'deleted');
    expect(gone?.job?.revision).toBe(5);
    expect((await api.mockState()).stats.deleteRequests).toBe(2);
  });

  it('spoofed + oversize: both rejected before POST, createRequests unchanged', async () => {
    const { c } = controller();
    const before = (await api.mockState()).stats.createRequests;
    const spoofed = await c.inspect(pickFixture('spoofed.pdf'));
    const oversize = await c.inspect(pickFixture('oversize.csv'));
    expect(spoofed.check).toEqual({ ok: false, reason: 'unsupported' });
    expect(oversize.check).toEqual({ ok: false, reason: 'too_large' });
    expect(existsSync(spoofed.file.uri)).toBe(false); // temporary copies deleted
    expect(existsSync(oversize.file.uri)).toBe(false);
    await expect(c.confirm(spoofed)).rejects.toThrow();
    expect((await api.mockState()).stats.createRequests).toBe(before);
  });

  it('the key is stored before the upload starts', async () => {
    const store = new MemoryStore();
    const saves: string[] = [];
    const spy = { load: () => store.load(), save: async (op: Parameters<MemoryStore['save']>[0]) => { saves.push(op?.phase ?? 'null'); await store.save(op); } };
    const c = new ImportController({ api, files: new NodeFiles(), store: spy, newKey, log: silentLog });
    await c.confirm(await c.inspect(pickFixture('statement.csv')));
    expect(saves[0]).toBe('sending');
  });
});
