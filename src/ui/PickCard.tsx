import { Text } from "react-native";
import { Button, Card } from "./components";
import { styles } from "./styles";

export function PickCard({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: () => void;
}) {
  return (
    <Card title="Import a bank statement">
      <Text style={styles.text}>
        Choose a PDF or CSV statement. It is checked on this device before
        anything is sent.
      </Text>
      <Button label="Choose file" onPress={onPick} disabled={busy} />
    </Card>
  );
}
