import { StyleSheet, Text, View } from "react-native";
import { formatMoney, monthlyTotalMinor } from "@/core/rules";
import type { Operation, RecurringItem } from "@/core/types";
import { Row } from "@/ui/Row";
import { colors, spacing, type } from "@/ui/theme";
import { ReportItemsList } from "./ReportItemsList";

export function ReportCard({
  operation,
  onDetails,
}: {
  operation: Operation;
  onDetails: (item: RecurringItem) => void;
}) {
  const job = operation.job;
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

const styles = StyleSheet.create({
  report: { gap: spacing.small },
  text: { color: colors.text, fontSize: type.body },
});
