import type { Operation, RecurringItem } from "../core/types";
import type { ImportActions } from "./actions";
import { FailedCard } from "./FailedCard";
import { JobCard } from "./JobCard";
import { SendingCard } from "./SendingCard";
import { UncertainCard } from "./UncertainCard";

export function OperationView({
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
  if (op.phase === "sending") return <SendingCard />;
  if (op.phase === "uncertain") {
    return <UncertainCard op={op} busy={busy} actions={actions} />;
  }
  if (op.phase === "failed") {
    return <FailedCard op={op} busy={busy} onReset={actions.reset} />;
  }
  return (
    <JobCard op={op} busy={busy} actions={actions} onDetails={onDetails} />
  );
}
