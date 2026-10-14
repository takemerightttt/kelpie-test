import { Text } from "react-native";
import type { Operation } from "../core/types";
import { Button, Card } from "./components";
import { styles } from "./styles";

export function FailedCard({
  op,
  busy,
  onReset,
}: {
  op: Operation;
  busy: boolean;
  onReset: () => void;
}) {
  return (
    <Card title="Upload refused">
      <Text style={styles.error}>
        The server did not accept this file ({op.error}).
      </Text>
      <Button label="Start over" onPress={onReset} disabled={busy} />
    </Card>
  );
}
