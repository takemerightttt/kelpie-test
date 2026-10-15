import type { RecurringItem } from "@/core/types";
import { ReportItemRow } from "./ReportItemRow";

export function ReportItemsList({
  items,
  currency,
  onDetails,
}: {
  items: RecurringItem[];
  currency: string;
  onDetails: (item: RecurringItem) => void;
}) {
  return (
    <>
      {items.map((item) => (
        <ReportItemRow
          key={item.id}
          item={item}
          currency={currency}
          onDetails={onDetails}
        />
      ))}
    </>
  );
}
