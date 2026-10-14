import { Modal, View } from "react-native";
import { formatMoney } from "../core/rules";
import type { RecurringItem } from "../core/types";
import { Button, Card, Row } from "./components";
import { styles } from "./styles";

export function DetailsModal({
  item,
  currency,
  onClose,
}: {
  item: RecurringItem | null;
  currency: string;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={item !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        {item ? (
          <Card title={item.merchant}>
            <Row
              label="Amount"
              value={formatMoney(item.amountMinor, currency)}
            />
            <Row label="Cadence" value={item.cadence} />
            <Row label="Last seen" value={item.lastSeen} />
            <Button label="Close" kind="secondary" onPress={onClose} />
          </Card>
        ) : null}
      </View>
    </Modal>
  );
}
