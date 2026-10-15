import { z as zod } from "zod";

export const JobStatusSchema = zod.enum([
  "queued",
  "processing",
  "ready",
  "deleting",
  "deleted",
  "error",
]);
export type JobStatus = zod.infer<typeof JobStatusSchema>;

export const RecurringItemSchema = zod.object({
  id: zod.string(),
  merchant: zod.string(),
  amountMinor: zod.number().int(),
  cadence: zod.string(),
  lastSeen: zod.string(),
});
export type RecurringItem = zod.infer<typeof RecurringItemSchema>;

/** Every job response from the server: GET, POST 202, DELETE 202. */
export const JobViewSchema = zod.object({
  jobId: zod.string(),
  status: JobStatusSchema,
  revision: zod.number().int(),
  currency: zod.string().optional(),
  items: zod.array(RecurringItemSchema).optional(),
});
export type JobView = zod.infer<typeof JobViewSchema>;

/**
 * What the app remembers about the one import in progress. Saved before every
 * network call that changes server state, so a relaunch knows where it stopped.
 * Never holds file bytes; `fileName` stays on the device and is never logged.
 */
export type Phase =
  | "sending" // POST may be in flight or its answer was lost
  | "uncertain" // POST outcome unknown and the job was not found by key yet
  | "created" // the server has the job
  | "failed" // the server refused the upload (409 / 4xx)
  | "missing"; // the job was created, but the server now answers 404 for it - not a deletion

export type Operation = {
  key: string;
  fileName: string;
  size: number;
  format: "pdf" | "csv";
  localCopyUri: string | null;
  phase: Phase;
  jobId: string | null;
  job: JobView | null;
  /** Set when the user asked to delete; from then on nothing may bring the job back. */
  deleteKey: string | null;
  deleteError: string | null;
  error: string | null;
};
