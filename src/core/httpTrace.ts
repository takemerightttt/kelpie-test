import type { HttpResult } from "./api";
import type { HttpErrorKind, PathTemplate, SafeLog } from "./log";

/** Collapses a request path to its route, so keys and job ids never reach the log. */
export function pathTemplate(path: string): PathTemplate {
  const route = path.split("?")[0];
  if (route === "/imports") return "/imports";
  if (route.startsWith("/imports/by-key/")) return "/imports/by-key";
  if (route.startsWith("/imports/")) return "/imports/{id}";
  if (
    route === "/__test/scenario" ||
    route === "/__test/state" ||
    route === "/__test/reset"
  )
    return route;
  return "other";
}

export function errorKind(error: unknown, timedOut: boolean): HttpErrorKind {
  if (timedOut) return "timeout";
  if (error instanceof Error && error.name === "AbortError") return "aborted";
  return "network";
}

/** Runs one HTTP call and logs it as http_request: route, status or error kind, duration. */
export async function traced(
  log: SafeLog,
  method: "GET" | "POST" | "DELETE",
  path: string,
  timedOut: () => boolean,
  send: () => Promise<HttpResult>,
): Promise<HttpResult> {
  const started = Date.now();
  const fields = { method, path: pathTemplate(path) };
  try {
    const result = await send();
    log("http_request", {
      ...fields,
      status: result.status,
      durationMs: Date.now() - started,
    });
    return result;
  } catch (error) {
    log("http_request", {
      ...fields,
      errorKind: errorKind(error, timedOut()),
      durationMs: Date.now() - started,
    });
    throw error;
  }
}
