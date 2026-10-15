// Runs the real controller against the unmodified mock server (mock-kit/),
// one test per row of the acceptance matrix. Counters come from /__test/state.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ImportsApi, type Http } from "../../src/core/api";
import { ImportController } from "../../src/core/controller";
import { silentLog } from "../../src/core/log";
import {
  MemoryStore,
  NodeFiles,
  NodeHttp,
  FIXTURES,
  KIT_DIRECTORY,
  newKey,
  pickFixture,
  startMock,
  until,
} from "../support/node";

jest.setTimeout(20000);

let mock: { base: string; stop: () => Promise<void> };
let api: ImportsApi;

function createController(store = new MemoryStore(), files = new NodeFiles()) {
  return {
    controller: new ImportController({
      api,
      files,
      store,
      newKey,
      log: silentLog,
    }),
    store,
    files,
  };
}

beforeAll(() => {
  if (!existsSync(join(FIXTURES, "oversize.csv")))
    execFileSync(process.execPath, ["make-oversize.mjs"], {
      cwd: KIT_DIRECTORY,
    });
});

beforeEach(async () => {
  mock = await startMock();
  api = new ImportsApi(new NodeHttp(mock.base));
});

afterEach(async () => {
  await mock.stop();
});

const ready = (controller: ImportController) =>
  until(
    () => controller.refresh(),
    (operation) => operation?.job?.status === "ready",
  );

describe("acceptance matrix against the mock", () => {
  it("happy: bytes are sent, 202 is not a report, ready shows two items", async () => {
    const { controller, files } = createController();
    const inspected = await controller.inspect(pickFixture("statement.csv"));
    const created = await controller.confirm(inspected);
    expect(created.job?.status).toBe("queued");
    expect(created.job?.items).toBeUndefined();
    const done = await ready(controller);
    expect(done?.job?.items?.map((item) => item.merchant)).toEqual([
      "StreamBeam",
      "BrightGrid",
    ]);
    const state = await api.mockState();
    expect(state.stats).toMatchObject({ createRequests: 1, newJobs: 1 });
    expect(state.stats.acceptedBytes).toBeGreaterThan(0);
    expect(readdirSync(files.directory)).toEqual([]); // private copy removed once the server has the job
  });

  it("happy with the PDF fixture too", async () => {
    const { controller } = createController();
    await controller.confirm(
      await controller.inspect(pickFixture("statement.pdf")),
    );
    expect((await ready(controller))?.job?.currency).toBe("AUD");
  });

  it("lost_ack: the job is found by key, newJobs stays 1, nothing is re-sent on relaunch", async () => {
    await api.setScenario("lost_ack");
    const store = new MemoryStore();
    const first = createController(store);
    const operation = await first.controller.confirm(
      await first.controller.inspect(pickFixture("statement.csv")),
    );
    expect(operation.jobId).toBe("job-demo-001"); // recovered through GET /imports/by-key
    // Relaunch: a new controller over the same storage.
    const relaunched = createController(store, first.files);
    const resumed = await relaunched.controller.resume();
    expect(resumed?.jobId).toBe("job-demo-001");
    const state = await api.mockState();
    expect(state.stats.newJobs).toBe(1);
    expect(state.stats.createRequests).toBe(1);
  });

  it("lost_ack + manual retry with the same key and bytes does not create a second job", async () => {
    await api.setScenario("lost_ack");
    const store = new MemoryStore();
    const { controller } = createController(store);
    const operation = await controller.confirm(
      await controller.inspect(pickFixture("statement.csv")),
    );
    // Force the "outcome unknown" branch, as if by-key had answered 404 at that instant.
    await store.save({
      ...operation,
      phase: "uncertain",
      localCopyUri: await new NodeFiles().keepPrivate(
        pickFixture("statement.csv").uri,
        operation.key,
      ),
    });
    await api.setScenario("happy");
    const retried = await controller.retrySend();
    expect(retried?.jobId).toBe("job-demo-001");
    const state = await api.mockState();
    expect(state.stats).toMatchObject({ newJobs: 1, duplicateHits: 1 });
  });

  it("stale_status: ready/3 then processing/2 - the screen stays on ready", async () => {
    const { controller } = createController();
    const created = await controller.confirm(
      await controller.inspect(pickFixture("statement.csv")),
    );
    expect(created.jobId).toBeTruthy();
    await api.setScenario("stale_status");
    const first = await controller.refresh();
    expect(first?.job).toMatchObject({ status: "ready", revision: 3 });
    const second = await controller.refresh(); // the mock answers processing/2 here
    expect(second?.job).toMatchObject({ status: "ready", revision: 3 });
  });

  it("delete_failure: 503 is not a deletion; after happy the same key reaches deleted", async () => {
    const { controller } = createController();
    await controller.confirm(
      await controller.inspect(pickFixture("statement.csv")),
    );
    await ready(controller);
    await api.setScenario("delete_failure");
    const failed = await controller.requestDelete();
    expect(failed?.deleteError).toBe("server_503");
    expect(failed?.job?.status).toBe("ready");
    const deleteKey = failed?.deleteKey;
    const late = await controller.refresh(); // a late "ready" must not undo the delete intent
    expect(late?.deleteKey).toBe(deleteKey);
    await api.setScenario("happy");
    const accepted = await controller.requestDelete();
    expect(accepted?.deleteKey).toBe(deleteKey);
    expect(accepted?.job?.status).toBe("deleting");
    const gone = await until(
      () => controller.refresh(),
      (operation) => operation?.job?.status === "deleted",
    );
    expect(gone?.job?.revision).toBe(5);
    expect((await api.mockState()).stats.deleteRequests).toBe(2);
  });

  it("spoofed + oversize: both rejected before POST, createRequests unchanged", async () => {
    const { controller } = createController();
    const before = (await api.mockState()).stats.createRequests;
    const spoofed = await controller.inspect(pickFixture("spoofed.pdf"));
    const oversize = await controller.inspect(pickFixture("oversize.csv"));
    expect(spoofed.check).toEqual({ ok: false, reason: "unsupported" });
    expect(oversize.check).toEqual({ ok: false, reason: "too_large" });
    expect(existsSync(spoofed.file.uri)).toBe(false); // temporary copies deleted
    expect(existsSync(oversize.file.uri)).toBe(false);
    await expect(controller.confirm(spoofed)).rejects.toThrow();
    expect((await api.mockState()).stats.createRequests).toBe(before);
  });

  it("the key is stored before the upload starts", async () => {
    const store = new MemoryStore();
    const saves: string[] = [];
    const spy = {
      load: () => store.load(),
      save: async (operation: Parameters<MemoryStore["save"]>[0]) => {
        saves.push(operation?.phase ?? "null");
        await store.save(operation);
      },
    };
    const controller = new ImportController({
      api,
      files: new NodeFiles(),
      store: spy,
      newKey,
      log: silentLog,
    });
    await controller.confirm(
      await controller.inspect(pickFixture("statement.csv")),
    );
    expect(saves[0]).toBe("sending");
  });

  it("an accepted file moves to the private folder right after the check; cancel deletes it", async () => {
    const { controller, files } = createController();
    const picked = pickFixture("statement.csv");
    const inspected = await controller.inspect(picked);
    expect(inspected.privateUri).toBeTruthy();
    expect(existsSync(inspected.privateUri!)).toBe(true);
    expect(existsSync(picked.uri)).toBe(false); // the cache copy is no longer relied on
    await controller.discard(inspected);
    expect(readdirSync(files.directory)).toEqual([]);
  });

  it("report items are not stored at rest; a relaunch fetches them again", async () => {
    const store = new MemoryStore();
    const first = createController(store);
    await first.controller.confirm(
      await first.controller.inspect(pickFixture("statement.csv")),
    );
    expect((await ready(first.controller))?.job?.items).toHaveLength(2);
    expect((await store.load())?.job?.items).toBeUndefined();
    const relaunched = createController(store, first.files);
    expect((await relaunched.controller.refresh())?.job?.items).toHaveLength(2);
  });

  it("poll reports an unreachable server instead of pretending all is well", async () => {
    const { controller } = createController();
    await controller.confirm(
      await controller.inspect(pickFixture("statement.csv")),
    );
    await mock.stop();
    const response = await controller.poll();
    expect(response.reachable).toBe(false);
    expect(response.operation?.jobId).toBeTruthy();
    mock = await startMock(); // afterEach stops it again
  });

  it("missing: after a server reset refresh() reports the job as missing, keeping its id", async () => {
    const { controller, store } = createController();
    const created = await controller.confirm(
      await controller.inspect(pickFixture("statement.csv")),
    );
    await fetch(`${mock.base}/__test/reset`, { method: "POST" });
    const missing = await controller.refresh();
    expect(missing?.phase).toBe("missing");
    expect(missing?.jobId).toBe(created.jobId);
    expect(missing?.job?.status).not.toBe("deleted");
    expect((await store.load())?.phase).toBe("missing");
    expect((await controller.resume())?.phase).toBe("missing"); // a relaunch stays put
  });

  it("missing: DELETE answered 404 after a server reset is not retried", async () => {
    const http = new NodeHttp(mock.base);
    let deleteCalls = 0;
    const countingHttp: Http = {
      request: (method, path, headers, json) => {
        if (method === "DELETE") deleteCalls += 1;
        return http.request(method, path, headers, json);
      },
      uploadFile: (path, fileUri, headers) =>
        http.uploadFile(path, fileUri, headers),
    };
    api = new ImportsApi(countingHttp);
    const { controller } = createController();
    await controller.confirm(
      await controller.inspect(pickFixture("statement.csv")),
    );
    await ready(controller);
    await fetch(`${mock.base}/__test/reset`, { method: "POST" });

    const missing = await controller.requestDelete();
    expect(missing?.phase).toBe("missing");
    expect(missing?.deleteError).toBeNull();
    expect(missing?.job?.status).not.toBe("deleted");
    expect(await controller.requestDelete()).toEqual(missing);
    expect((await controller.poll()).operation?.phase).toBe("missing");
    expect(deleteCalls).toBe(1);
  });
});
