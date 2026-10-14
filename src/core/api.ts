import { JobViewSchema, type JobView } from "./types";

export type HttpResult = { status: number; body: string };

/**
 * The only network surface the core needs. The app implements it with
 * expo-file-system upload + fetch, the tests with Node fetch against the real
 * mock server - so the same core code runs in both.
 */
export interface Http {
  request(
    method: "GET" | "POST" | "DELETE",
    path: string,
    headers?: Record<string, string>,
    json?: unknown,
  ): Promise<HttpResult>;
  /** POST the raw bytes of a local file (application/octet-stream), streamed, never loaded whole. */
  uploadFile(
    path: string,
    fileUri: string,
    headers: Record<string, string>,
  ): Promise<HttpResult>;
}

export type CreateResult =
  | { kind: "accepted"; view: JobView }
  | { kind: "conflict" }
  | { kind: "rejected"; status: number }
  | { kind: "server_error"; status: number };

export type FetchResult =
  | { kind: "found"; view: JobView }
  | { kind: "not_found" }
  | { kind: "error"; status: number };

export type DeleteResult =
  { kind: "accepted"; view: JobView } | { kind: "failed"; status: number };

export type MockState = {
  mode: string;
  stats: {
    createRequests: number;
    newJobs: number;
    duplicateHits: number;
    acceptedBytes: number;
    deleteRequests: number;
  };
};

/** The server answered, but not in the agreed shape - not the same as "no answer". */
export class ResponseFormatError extends Error {}

function parseView(body: string): JobView {
  try {
    return JobViewSchema.parse(JSON.parse(body));
  } catch {
    throw new ResponseFormatError("unexpected response format");
  }
}

export class ImportsApi {
  constructor(private readonly http: Http) {}

  async create(
    key: string,
    fileName: string,
    fileUri: string,
  ): Promise<CreateResult> {
    const res = await this.http.uploadFile("/imports", fileUri, {
      "Content-Type": "application/octet-stream",
      "Idempotency-Key": key,
      "X-File-Name": fileName,
    });
    if (res.status === 202)
      return { kind: "accepted", view: parseView(res.body) };
    if (res.status === 409) return { kind: "conflict" };
    if (res.status >= 500) return { kind: "server_error", status: res.status };
    return { kind: "rejected", status: res.status };
  }

  async findByKey(key: string): Promise<FetchResult> {
    return this.fetchView(`/imports/by-key/${encodeURIComponent(key)}`);
  }

  async getJob(jobId: string): Promise<FetchResult> {
    return this.fetchView(`/imports/${encodeURIComponent(jobId)}`);
  }

  async remove(jobId: string, deleteKey: string): Promise<DeleteResult> {
    const res = await this.http.request(
      "DELETE",
      `/imports/${encodeURIComponent(jobId)}`,
      { "Idempotency-Key": deleteKey },
    );
    if (res.status === 202)
      return { kind: "accepted", view: parseView(res.body) };
    return { kind: "failed", status: res.status };
  }

  // Test-control routes of the mock - used by the diagnostics screen only.
  async setScenario(
    mode: "happy" | "lost_ack" | "stale_status" | "delete_failure",
  ): Promise<void> {
    await this.http.request(
      "POST",
      "/__test/scenario",
      { "Content-Type": "application/json" },
      { mode },
    );
  }

  async mockState(): Promise<MockState> {
    const res = await this.http.request("GET", "/__test/state");
    return JSON.parse(res.body) as MockState;
  }

  private async fetchView(path: string): Promise<FetchResult> {
    const res = await this.http.request("GET", path);
    if (res.status === 200) return { kind: "found", view: parseView(res.body) };
    if (res.status === 404) return { kind: "not_found" };
    return { kind: "error", status: res.status };
  }
}
