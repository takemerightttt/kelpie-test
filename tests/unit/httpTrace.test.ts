import { ImportsApi, type Http, type HttpResult } from "../../src/core/api";
import { pathTemplate, traced } from "../../src/core/httpTrace";
import type { SafeFields } from "../../src/core/log";

type Entry = { event: string; fields: SafeFields };

const KEY = "3f1c9a52-7d0e-4b8a-9c61-2e5f4d7a8b90";
const DELETE_KEY = "a8d2e6f1-0b3c-4e5d-8f7a-6c9b1d2e3f40";
const JOB_ID = "job-7f3e2a91";
const VIEW = JSON.stringify({ jobId: JOB_ID, status: "queued", revision: 1 });

/** An Http that answers like the mock and traces every call like the device adapter. */
function tracedFake(entries: Entry[], status = 202): Http {
  const log = (event: string, fields: SafeFields = {}) =>
    entries.push({ event, fields });
  const answer = async (): Promise<HttpResult> => ({ status, body: VIEW });
  return {
    request: (method, path) => traced(log, method, path, () => false, answer),
    uploadFile: (path) => traced(log, "POST", path, () => false, answer),
  };
}

describe("http_request trace", () => {
  it("logs route templates, never the idempotency key or the job id", async () => {
    const entries: Entry[] = [];
    const api = new ImportsApi(tracedFake(entries));
    await api.create(KEY, "statement.csv", "/tmp/statement.csv");
    await api.findByKey(KEY);
    await api.getJob(JOB_ID);
    await api.remove(JOB_ID, DELETE_KEY);

    expect(entries.map((entry) => entry.fields.path)).toEqual([
      "/imports",
      "/imports/by-key",
      "/imports/{id}",
      "/imports/{id}",
    ]);
    for (const entry of entries) {
      expect(entry.event).toBe("http_request");
      expect(entry.fields.status).toBe(202);
      expect(typeof entry.fields.durationMs).toBe("number");
      const line = JSON.stringify(entry);
      for (const secret of [KEY, DELETE_KEY, JOB_ID, "statement.csv"])
        expect(line).not.toContain(secret);
    }
  });

  it("maps every other path to a fixed template", () => {
    expect(pathTemplate("/__test/scenario")).toBe("/__test/scenario");
    expect(pathTemplate("/__test/state")).toBe("/__test/state");
    expect(pathTemplate(`/imports/${JOB_ID}?x=1`)).toBe("/imports/{id}");
    expect(pathTemplate(`/unknown/${KEY}`)).toBe("other");
  });

  it.each([
    [
      "timeout",
      true,
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    ],
    [
      "aborted",
      false,
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    ],
    ["network", false, new TypeError("Network request failed")],
  ] as const)(
    "logs errorKind %s and rethrows",
    async (kind, timedOut, error) => {
      const entries: SafeFields[] = [];
      const call = traced(
        (_event, fields = {}) => entries.push(fields),
        "GET",
        `/imports/by-key/${KEY}`,
        () => timedOut,
        () => Promise.reject(error),
      );
      await expect(call).rejects.toBe(error);
      expect(entries).toEqual([
        {
          method: "GET",
          path: "/imports/by-key",
          errorKind: kind,
          durationMs: expect.any(Number),
        },
      ]);
    },
  );
});
