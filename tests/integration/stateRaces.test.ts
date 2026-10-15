// Concurrency and state tests: every call on ONE controller instance, the way the app uses it.
// They fail on the current code and must pass after the controller serialises its public methods
// and keeps the full operation (with report items) in memory.
import { ImportsApi, type Http } from "@/core/api";
import { ImportController } from "@/core/controller";
import { silentLog } from "@/core/log";
import {
  MemoryStore,
  NodeFiles,
  NodeHttp,
  newKey,
  pickFixture,
  startMock,
  until,
} from "../support/node";

jest.setTimeout(20000);

let mock: { base: string; stop: () => Promise<void> };
beforeEach(async () => {
  mock = await startMock();
});
afterEach(async () => {
  await mock.stop();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Delays = { getJobMs: number; byKeyMs: number; uploadMs: number };

/** Real HTTP to the mock, with adjustable delays so two calls can overlap. */
function delayedHttp(base: string, delays: Delays): Http {
  const http = new NodeHttp(base);
  return {
    async request(method, path, headers, json) {
      const result = await http.request(method, path, headers, json);
      if (method === "GET" && /^\/imports\/job-/.test(path)) await sleep(delays.getJobMs);
      if (method === "GET" && path.startsWith("/imports/by-key/")) await sleep(delays.byKeyMs);
      return result;
    },
    async uploadFile(path, uri, headers) {
      await sleep(delays.uploadMs);
      return http.uploadFile(path, uri, headers);
    },
  };
}

function make(delays: Delays) {
  const store = new MemoryStore();
  const api = new ImportsApi(delayedHttp(mock.base, delays));
  const controller = new ImportController({
    api,
    files: new NodeFiles(),
    store,
    newKey,
    log: silentLog,
  });
  return { api, store, controller };
}

async function importUntilReady(controller: ImportController) {
  await controller.confirm(await controller.inspect(pickFixture("statement.csv")));
  return until(() => controller.refresh(), (operation) => operation?.job?.status === "ready");
}

it("stale_status: the report items stay on screen after a stale response is ignored", async () => {
  const { api, controller } = make({ getJobMs: 0, byKeyMs: 0, uploadMs: 0 });
  await importUntilReady(controller);
  await api.setScenario("stale_status");
  const first = await controller.refresh(); // ready/3 with items
  const second = await controller.refresh(); // processing/2 - must be ignored
  expect(first?.job?.items).toHaveLength(2);
  expect(second?.job?.status).toBe("ready");
  expect(second?.job?.revision).toBe(3);
  expect(second?.job?.items).toHaveLength(2);
});

it("a GET in flight while the user deletes cannot bring the job back", async () => {
  const delays = { getJobMs: 0, byKeyMs: 0, uploadMs: 0 };
  const { api, store, controller } = make(delays);
  const ready = await importUntilReady(controller);
  delays.getJobMs = 400; // the next GET answers late
  const pollPromise = controller.refresh();
  await sleep(50);
  const afterDelete = await controller.requestDelete();
  const afterPoll = await pollPromise;
  const stored = await store.load();
  const server = await api.getJob(ready!.jobId as string);

  expect(afterDelete?.deleteKey).toBeTruthy();
  expect(afterDelete?.job?.status).toBe("deleting");
  expect(afterPoll?.deleteKey).toBeTruthy();
  expect(afterPoll?.job?.status).toBe("deleting");
  expect(stored?.deleteKey).toBeTruthy();
  expect(stored?.job?.status).toBe("deleting");
  expect(server.kind === "found" && server.view.status).toBe("deleting");
});

it("resume() during an in-flight POST does not overwrite the created job", async () => {
  const delays = { getJobMs: 0, byKeyMs: 600, uploadMs: 300 };
  const { api, store, controller } = make(delays);
  const inspected = await controller.inspect(pickFixture("statement.csv"));
  const confirmPromise = controller.confirm(inspected);
  await sleep(50);
  const resumed = await controller.resume(); // foreground while the upload is still running
  const created = await confirmPromise;
  const stored = await store.load();
  const state = await api.mockState();

  expect(created.phase).toBe("created");
  expect(created.jobId).toBe("job-demo-001");
  expect(resumed?.phase).toBe("created");
  expect(resumed?.jobId).toBe("job-demo-001");
  expect(stored?.phase).toBe("created");
  expect(stored?.jobId).toBe("job-demo-001");
  expect(stored?.localCopyUri).toBeNull();
  expect(state.stats.newJobs).toBe(1);
  expect(state.stats.createRequests).toBe(1);
});

it("lost_ack: a relaunch while still 'sending' recovers by key and never re-sends", async () => {
  const { api, store, controller } = make({ getJobMs: 0, byKeyMs: 0, uploadMs: 0 });
  await api.setScenario("lost_ack");
  const operation = await controller.confirm(await controller.inspect(pickFixture("statement.csv")));
  await store.save({ ...operation, phase: "sending", jobId: null, job: null }); // crash before persist
  const relaunched = new ImportController({
    api,
    files: new NodeFiles(),
    store,
    newKey,
    log: silentLog,
  });
  const resumed = await relaunched.resume();
  const state = await api.mockState();
  expect(resumed?.phase).toBe("created");
  expect(resumed?.jobId).toBe("job-demo-001");
  expect(state.stats.newJobs).toBe(1);
  expect(state.stats.createRequests).toBe(1);
});
