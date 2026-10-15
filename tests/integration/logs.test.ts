// Every log record of whole flows - controller events and http_request traces - is checked for
// file names, merchants, amounts and CSV content. The integration tests elsewhere use silentLog.
import { ImportsApi, type Http } from "@/core/api";
import { ImportController } from "@/core/controller";
import { traced } from "@/core/httpTrace";
import type { SafeLog } from "@/core/log";
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

const FORBIDDEN = [
  "statement",
  "StreamBeam",
  "BrightGrid",
  "1999",
  "13200",
  "date,description",
];

let mock: { base: string; stop: () => Promise<void> };
beforeEach(async () => {
  mock = await startMock();
});
afterEach(async () => {
  await mock.stop();
});

/** Real HTTP to the mock, traced like the device adapter. */
function tracedHttp(base: string, log: SafeLog): Http {
  const http = new NodeHttp(base);
  return {
    request: (method, path, headers, json) =>
      traced(
        log,
        method,
        path,
        () => false,
        () => http.request(method, path, headers, json),
      ),
    uploadFile: (path, uri, headers) =>
      traced(
        log,
        "POST",
        path,
        () => false,
        () => http.uploadFile(path, uri, headers),
      ),
  };
}

it.each(["happy", "lost_ack", "delete_failure"] as const)(
  "%s: no log record holds a file name, merchant, amount or CSV text",
  async (scenario) => {
    const records: string[] = [];
    const log: SafeLog = (event, fields = {}) =>
      records.push(event + JSON.stringify(fields));
    const api = new ImportsApi(tracedHttp(mock.base, log));
    const controller = new ImportController({
      api,
      files: new NodeFiles(),
      store: new MemoryStore(),
      newKey,
      log,
    });
    await api.setScenario(scenario);
    await controller.confirm(
      await controller.inspect(pickFixture("statement.csv")),
    );
    await until(
      () => controller.refresh(),
      (operation) => operation?.job?.status === "ready",
    );
    const failed = await controller.requestDelete();
    if (scenario === "delete_failure") {
      expect(failed?.deleteError).toBe("server_503");
      await api.setScenario("happy");
      await controller.requestDelete();
    }
    await until(
      () => controller.refresh(),
      (operation) => operation?.job?.status === "deleted",
    );

    expect(records.length).toBeGreaterThan(5);
    for (const record of records)
      for (const word of FORBIDDEN) expect(record).not.toContain(word);
  },
);
