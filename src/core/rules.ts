import type { JobView, Operation } from "./types";

const AFTER_DELETE = new Set(["deleting", "deleted"]);

/**
 * Decides whether a job response may replace what the app shows. Pure, so
 * every rule is unit-tested without a server.
 *
 * - A response for another job is ignored.
 * - An older revision never replaces a newer one (stale_status: ready/3 then
 *   processing/2 must not roll the screen back).
 * - Once the user asked to delete, only deleting/deleted are accepted: a late
 *   "ready" must not bring a deleted import back.
 */
export function acceptView(operation: Operation, view: JobView): boolean {
  if (operation.jobId && view.jobId !== operation.jobId) return false;
  if (operation.deleteKey && !AFTER_DELETE.has(view.status)) return false;
  if (operation.job && view.revision < operation.job.revision) return false;
  return true;
}

export function applyView(operation: Operation, view: JobView): Operation {
  if (!acceptView(operation, view)) return operation;
  return { ...operation, jobId: view.jobId, job: view, phase: "created" };
}

/** The server confirmed the deletion - only now may the UI say the data is gone. */
export function isServerDeleted(operation: Operation): boolean {
  return operation.job?.status === "deleted";
}

/** Statuses that still change on their own, so the app keeps asking. */
export function needsPolling(operation: Operation): boolean {
  if (operation.phase !== "created") return false;
  const status = operation.job?.status;
  return (
    status === "queued" || status === "processing" || status === "deleting"
  );
}

const POLL_MS = 700;
const POLL_MAX_MS = 15_000;

/** Fixed pace while the server answers; doubles after each failed check, capped at 15 s. */
export function pollDelay(failures: number): number {
  return failures === 0
    ? POLL_MS
    : Math.min(POLL_MS * 2 ** failures, POLL_MAX_MS);
}

/** Monthly total of the ready result in minor units (151.99 AUD -> 15199). */
export function monthlyTotalMinor(view: JobView | null): number {
  return (view?.items ?? []).reduce((sum, item) => sum + item.amountMinor, 0);
}

export function formatMoney(minor: number, currency: string): string {
  const sign = minor < 0 ? "-" : "";
  const absoluteMinor = Math.abs(minor);
  return `${sign}${Math.floor(absoluteMinor / 100)}.${String(absoluteMinor % 100).padStart(2, "0")} ${currency}`;
}
