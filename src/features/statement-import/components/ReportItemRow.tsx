import { StyleSheet, Text, View } from "react-native";
import { formatMoney } from "@/core/rules";
import type { RecurringItem } from "@/core/types";
import { Button } from "@/ui/Button";
import { Row } from "@/ui/Row";
import { colors, size, spacing, type } from "@/ui/theme";

export function ReportItemRow({
  item,
  currency,
  onDetails,
}: {
  item: RecurringItem;
  currency: string;
  onDetails: (item: RecurringItem) => void;
}) {
  const handleDetails = () => onDetails(item);
  return (
    <View style={styles.item}>
      <Row
        label={item.merchant}
        value={`${formatMoney(item.amountMinor, currency)} / month`}
      />
      <Text style={styles.meta}>
        {item.cadence}, last seen {item.lastSeen}
      </Text>
      <Button label="Details" kind="secondary" onPress={handleDetails} />
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    gap: spacing.extraSmall,
    borderTopWidth: size.hairline,
    borderTopColor: colors.divider,
    paddingTop: spacing.small,
  },
  meta: { color: colors.textMuted, fontSize: type.body },
});
