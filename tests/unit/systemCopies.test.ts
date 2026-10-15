// The picker's own copy (iOS Inbox) is cleaned up after every local check and on every start;
// a failing cleanup never breaks the flow and logs no paths.
import type { ImportsApi } from "@/core/api";
import { ImportController } from "@/core/controller";
import type { SafeFields } from "@/core/log";
import { MemoryStore, NodeFiles, newKey, pickFixture } from "../support/node";

class CountingFiles extends NodeFiles {
  systemCopyCleanups = 0;
  constructor(private readonly failCleanup = false) {
    super();
  }
  async removeSystemCopies(): Promise<void> {
    this.systemCopyCleanups += 1;
    if (this.failCleanup) throw new Error(`cannot delete ${this.directory}`);
  }
}

function createController(files: NodeFiles) {
  const events: { event: string; fields?: SafeFields }[] = [];
  const controller = new ImportController({
    api: {} as ImportsApi, // inspect() and resume() without an operation never reach the server
    files,
    store: new MemoryStore(),
    newKey,
    log: (event, fields) => events.push({ event, fields }),
  });
  return { controller, events };
}

it("inspect() of an accepted file removes system copies once", async () => {
  const files = new CountingFiles();
  const { controller } = createController(files);
  const inspected = await controller.inspect(pickFixture("statement.pdf"));
  expect(inspected.check.ok).toBe(true);
  expect(files.systemCopyCleanups).toBe(1);
});

it("inspect() of a rejected file removes system copies once", async () => {
  const files = new CountingFiles();
  const { controller } = createController(files);
  const inspected = await controller.inspect(pickFixture("spoofed.pdf"));
  expect(inspected.check.ok).toBe(false);
  expect(files.systemCopyCleanups).toBe(1);
});

it("resume() removes system copies once", async () => {
  const files = new CountingFiles();
  const { controller } = createController(files);
  await expect(controller.resume()).resolves.toBeNull();
  expect(files.systemCopyCleanups).toBe(1);
});

it("a failing cleanup does not break inspect() and logs no paths", async () => {
  const files = new CountingFiles(true);
  const { controller, events } = createController(files);
  const inspected = await controller.inspect(pickFixture("statement.pdf"));
  expect(inspected.check.ok).toBe(true);
  expect(inspected.privateUri).not.toBeNull();
  const failures = events.filter(
    ({ event }) => event === "system_copy_cleanup_failed",
  );
  expect(failures).toEqual([{ event: "system_copy_cleanup_failed" }]);
  expect(JSON.stringify(events)).not.toContain(files.directory);
});
