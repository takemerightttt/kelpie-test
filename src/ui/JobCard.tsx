import { isServerDeleted } from "../core/rules";
import type { Operation, RecurringItem } from "../core/types";
import type { ImportActions } from "./actions";
import { Button, Card } from "./components";
import { DeleteState } from "./DeleteState";
import { ReportCard } from "./ReportCard";

const STATUS_TEXT: Record<string, string> = {
  queued: "Queued - waiting for processing",
  processing: "Processing your statement",
  ready: "Report ready",
  deleting: "Deletion requested - waiting for the server to confirm",
  deleted: "Deleted on the server",
  error: "The server could not process this statement",
};

export function JobCard({
  op,
  busy,
  actions,
  onDetails,
}: {
  op: Operation;
  busy: boolean;
  actions: ImportActions;
  onDetails: (item: RecurringItem) => void;
}) {
  const job = op.job;
  const deleted = isServerDeleted(op);
  return (
    <Card
      title={
        job ? (STATUS_TEXT[job.status] ?? job.status) : "Waiting for the server"
      }
    >
      {job?.status === "ready" && !op.deleteKey ? (
        <ReportCard op={op} onDetails={onDetails} />
      ) : null}
      <DeleteState op={op} busy={busy} deleted={deleted} actions={actions} />
      {!deleted ? (
        <Button
          label="Refresh"
          kind="secondary"
          onPress={actions.refresh}
          disabled={busy}
        />
      ) : null}
    </Card>
  );
}
