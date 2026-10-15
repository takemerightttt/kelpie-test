import { isServerDeleted } from "@/core/rules";
import type { Operation, RecurringItem } from "@/core/types";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import type { ImportActions } from "../useImport";
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
  operation,
  busy,
  actions,
  onDetails,
}: {
  operation: Operation;
  busy: boolean;
  actions: ImportActions;
  onDetails: (item: RecurringItem) => void;
}) {
  const job = operation.job;
  const deleted = isServerDeleted(operation);
  return (
    <Card
      title={
        job ? (STATUS_TEXT[job.status] ?? job.status) : "Waiting for the server"
      }
    >
      {job?.status === "ready" && !operation.deleteKey ? (
        <ReportCard operation={operation} onDetails={onDetails} />
      ) : null}
      <DeleteState
        operation={operation}
        busy={busy}
        deleted={deleted}
        actions={actions}
      />
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
