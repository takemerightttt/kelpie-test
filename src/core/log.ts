// The only logger the app uses. Its field type has no slot for file bytes, file
// names or transaction descriptions, so they cannot end up in logs, crash
// reports or analytics by accident.

export type PathTemplate =
  | "/imports"
  | "/imports/by-key"
  | "/imports/{id}"
  | "/__test/scenario"
  | "/__test/state"
  | "/__test/reset"
  | "other";

export type HttpErrorKind = "timeout" | "network" | "aborted";

export type SafeFields = {
  jobId?: string | null;
  /** Job status, or the HTTP status in http_request. */
  status?: string | number;
  revision?: number;
  httpStatus?: number;
  phase?: string;
  format?: string;
  sizeBucket?: "lt_1mb" | "lt_10mb" | "over_10mb";
  reason?: string;
  method?: "GET" | "POST" | "DELETE";
  path?: PathTemplate;
  errorKind?: HttpErrorKind;
  durationMs?: number;
};

export type SafeLog = (event: string, fields?: SafeFields) => void;

export function sizeBucket(size: number): SafeFields["sizeBucket"] {
  if (size < 1024 * 1024) return "lt_1mb";
  if (size <= 10 * 1024 * 1024) return "lt_10mb";
  return "over_10mb";
}

export const consoleLog: SafeLog = (event, fields = {}) => {
  console.log(`[import] ${event}`, JSON.stringify(fields));
};

export const silentLog: SafeLog = () => undefined;
