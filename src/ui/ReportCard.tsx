import { Text, View } from "react-native";
import { formatMoney, monthlyTotalMinor } from "../core/rules";
import type { Operation, RecurringItem } from "../core/types";
import { Row } from "./components";
import { ReportItemsList } from "./ReportItemsList";
import { styles } from "./styles";

export function ReportCard({
  op,
  onDetails,
}: {
  op: Operation;
  onDetails: (item: RecurringItem) => void;
}) {
  const job = op.job;
  if (!job?.items) return null;
  const currency = job.currency ?? "";
  return (
    <View style={styles.report}>
      <Text style={styles.text}>
        Recurring charges found: {job.items.length}
      </Text>
      <ReportItemsList
        items={job.items}
        currency={currency}
        onDetails={onDetails}
      />
      <Row
        label="Total per month"
        value={formatMoney(monthlyTotalMinor(job), currency)}
      />
    </View>
  );
}
