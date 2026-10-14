import type { JobView, Operation } from './types';

const AFTER_DELETE = new Set(['deleting', 'deleted']);

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
export function acceptView(op: Operation, view: JobView): boolean {
  if (op.jobId && view.jobId !== op.jobId) return false;
  if (op.deleteKey && !AFTER_DELETE.has(view.status)) return false;
  if (op.job && view.revision < op.job.revision) return false;
  return true;
}

export function applyView(op: Operation, view: JobView): Operation {
  if (!acceptView(op, view)) return op;
  return { ...op, jobId: view.jobId, job: view, phase: 'created' };
}

/** The server confirmed the deletion - only now may the UI say the data is gone. */
export function isServerDeleted(op: Operation): boolean {
  return op.job?.status === 'deleted';
}

/** Statuses that still change on their own, so the app keeps asking. */
export function needsPolling(op: Operation): boolean {
  const status = op.job?.status;
  return status === 'queued' || status === 'processing' || status === 'deleting';
}

/** Monthly total of the ready result in minor units (151.99 AUD -> 15199). */
export function monthlyTotalMinor(view: JobView | null): number {
  return (view?.items ?? []).reduce((sum, item) => sum + item.amountMinor, 0);
}

export function formatMoney(minor: number, currency: string): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')} ${currency}`;
}
