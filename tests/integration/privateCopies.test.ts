// The sweep on resume(): a copy left behind when the app was killed on the confirmation screen is
// deleted; the copy of the current operation and a copy still awaiting confirmation are kept.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ImportsApi } from "@/core/api";
import { ImportController } from "@/core/controller";
import { silentLog } from "@/core/log";
import type { Operation } from "@/core/types";
import {
  MemoryStore,
  NodeFiles,
  NodeHttp,
  newKey,
  pickFixture,
  startMock,
} from "../support/node";

jest.setTimeout(20000);

let mock: { base: string; stop: () => Promise<void> };
let api: ImportsApi;
beforeEach(async () => {
  mock = await startMock();
  api = new ImportsApi(new NodeHttp(mock.base));
});
afterEach(async () => {
  await mock.stop();
});

function strayCopy(files: NodeFiles): string {
  const uri = join(files.directory, newKey());
  writeFileSync(uri, "date,description,amount\n");
  return uri;
}

it("resume() deletes a stray copy and keeps the copy of the current operation", async () => {
  const files = new NodeFiles();
  const store = new MemoryStore();
  const key = newKey();
  const localCopyUri = await files.keepPrivate(
    pickFixture("statement.csv").uri,
    key,
  );
  const uncertain: Operation = {
    key,
    fileName: "statement.csv",
    size: 100,
    format: "csv",
    localCopyUri,
    phase: "uncertain",
    jobId: null,
    job: null,
    deleteKey: null,
    deleteError: null,
    error: "not_found_yet",
  };
  await store.save(uncertain); // the key never reached the server: by-key answers 404
  const stray = strayCopy(files);
  const controller = new ImportController({
    api,
    files,
    store,
    newKey,
    log: silentLog,
  });

  const resumed = await controller.resume();
  expect(resumed?.phase).toBe("uncertain");
  expect(existsSync(stray)).toBe(false);
  expect(existsSync(localCopyUri)).toBe(true);
  expect(await files.listPrivate()).toEqual([localCopyUri]);
});

it("resume() with no operation empties the private folder", async () => {
  const files = new NodeFiles();
  const stray = strayCopy(files);
  const controller = new ImportController({
    api,
    files,
    store: new MemoryStore(),
    newKey,
    log: silentLog,
  });
  expect(await controller.resume()).toBeNull();
  expect(existsSync(stray)).toBe(false);
  expect(await files.listPrivate()).toEqual([]);
});

it("a foreground resume() on the confirmation screen keeps the picked copy", async () => {
  const files = new NodeFiles();
  const controller = new ImportController({
    api,
    files,
    store: new MemoryStore(),
    newKey,
    log: silentLog,
  });
  const inspected = await controller.inspect(pickFixture("statement.csv"));
  await controller.resume();
  expect(existsSync(inspected.privateUri!)).toBe(true);
  const created = await controller.confirm(inspected);
  expect(created.phase).toBe("created");
  expect(await files.listPrivate()).toEqual([]);
});
