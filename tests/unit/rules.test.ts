import {
  acceptView,
  applyView,
  formatMoney,
  monthlyTotalMinor,
  needsPolling,
  pollDelay,
} from "../../src/core/rules";
import type { JobView, Operation } from "../../src/core/types";

const base: Operation = {
  key: "k-0000000001",
  fileName: "x.csv",
  size: 1,
  format: "csv",
  localCopyUri: null,
  phase: "created",
  jobId: "job-demo-001",
  job: null,
  deleteKey: null,
  deleteError: null,
  error: null,
};
const view = (
  status: JobView["status"],
  revision: number,
  jobId = "job-demo-001",
): JobView => ({ jobId, status, revision });

describe("job state rules", () => {
  it("never rolls back to an older revision (stale_status)", () => {
    const ready = applyView(base, view("ready", 3));
    expect(acceptView(ready, view("processing", 2))).toBe(false);
    expect(applyView(ready, view("processing", 2)).job?.status).toBe("ready");
  });

  it("a late ready cannot bring back a job the user asked to delete", () => {
    const deleting = {
      ...applyView(base, view("ready", 3)),
      deleteKey: "d-0000000001",
    };
    expect(acceptView(deleting, view("ready", 3))).toBe(false);
    expect(acceptView(deleting, view("deleting", 4))).toBe(true);
    expect(acceptView(deleting, view("deleted", 5))).toBe(true);
  });

  it("ignores a response for another job", () => {
    expect(acceptView(base, view("ready", 3, "job-demo-999"))).toBe(false);
  });

  it("sums the ready result: 19.99 + 132.00 = 151.99 AUD", () => {
    const total = monthlyTotalMinor({
      jobId: "job-demo-001",
      status: "ready",
      revision: 3,
      currency: "AUD",
      items: [
        {
          id: "rec-001",
          merchant: "StreamBeam",
          amountMinor: 1999,
          cadence: "monthly",
          lastSeen: "2026-10-01",
        },
        {
          id: "rec-002",
          merchant: "BrightGrid",
          amountMinor: 13200,
          cadence: "monthly",
          lastSeen: "2026-10-03",
        },
      ],
    });
    expect(total).toBe(15199);
    expect(formatMoney(total, "AUD")).toBe("151.99 AUD");
  });

  it("stops polling a job the server no longer knows", () => {
    const processing = { ...base, job: view("processing", 2) };
    expect(needsPolling(processing)).toBe(true);
    expect(needsPolling({ ...processing, phase: "missing" })).toBe(false);
  });

  it("polls at a fixed pace while reachable and backs off with a cap after failures", () => {
    expect(pollDelay(0)).toBe(700);
    expect(pollDelay(1)).toBe(1400);
    expect(pollDelay(3)).toBe(5600);
    expect(pollDelay(10)).toBe(15000);
  });
});
