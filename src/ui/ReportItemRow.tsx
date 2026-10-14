import { View } from "react-native";
import { formatMoney } from "../core/rules";
import type { RecurringItem } from "../core/types";
import { Button, Row } from "./components";
import { styles } from "./styles";

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
    <View style={styles.reportItem}>
      <Row
        label={item.merchant}
        value={`${formatMoney(item.amountMinor, currency)} / month`}
      />
      <Button label="Details" kind="secondary" onPress={handleDetails} />
    </View>
  );
}
