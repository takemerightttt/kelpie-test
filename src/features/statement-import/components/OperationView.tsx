import type { Operation, RecurringItem } from "@/core/types";
import type { ImportActions } from "../useImport";
import { FailedCard } from "./FailedCard";
import { JobCard } from "./JobCard";
import { MissingCard } from "./MissingCard";
import { SendingCard } from "./SendingCard";
import { UncertainCard } from "./UncertainCard";

export function OperationView({
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
  if (operation.phase === "sending") return <SendingCard />;
  if (operation.phase === "uncertain") {
    return (
      <UncertainCard operation={operation} busy={busy} actions={actions} />
    );
  }
  if (operation.phase === "missing") {
    return <MissingCard busy={busy} onReset={actions.reset} />;
  }
  if (operation.phase === "failed") {
    return (
      <FailedCard operation={operation} busy={busy} onReset={actions.reset} />
    );
  }
  return (
    <JobCard
      operation={operation}
      busy={busy}
      actions={actions}
      onDetails={onDetails}
    />
  );
}
