import { z } from 'zod';

export const JobStatusSchema = z.enum(['queued', 'processing', 'ready', 'deleting', 'deleted', 'error']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const RecurringItemSchema = z.object({
  id: z.string(),
  merchant: z.string(),
  amountMinor: z.number().int(),
  cadence: z.string(),
  lastSeen: z.string(),
});
export type RecurringItem = z.infer<typeof RecurringItemSchema>;

/** Every job response from the server: GET, POST 202, DELETE 202. */
export const JobViewSchema = z.object({
  jobId: z.string(),
  status: JobStatusSchema,
  revision: z.number().int(),
  currency: z.string().optional(),
  items: z.array(RecurringItemSchema).optional(),
});
export type JobView = z.infer<typeof JobViewSchema>;

/**
 * What the app remembers about the one import in progress. Saved before every
 * network call that changes server state, so a relaunch knows where it stopped.
 * Never holds file bytes; `fileName` stays on the device and is never logged.
 */
export type Phase =
  | 'sending' // POST may be in flight or its answer was lost
  | 'uncertain' // POST outcome unknown and the job was not found by key yet
  | 'created' // the server has the job
  | 'failed'; // the server refused the upload (409 / 4xx)

export type Operation = {
  key: string;
  fileName: string;
  size: number;
  format: 'pdf' | 'csv';
  localCopyUri: string | null;
  phase: Phase;
  jobId: string | null;
  job: JobView | null;
  /** Set when the user asked to delete; from then on nothing may bring the job back. */
  deleteKey: string | null;
  deleteError: string | null;
  error: string | null;
};
