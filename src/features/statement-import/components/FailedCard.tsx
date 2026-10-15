import { StyleSheet, Text } from "react-native";
import type { Operation } from "@/core/types";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { colors, type } from "@/ui/theme";

export function FailedCard({
  operation,
  busy,
  onReset,
}: {
  operation: Operation;
  busy: boolean;
  onReset: () => void;
}) {
  return (
    <Card title="Upload refused">
      <Text style={styles.error}>
        The server did not accept this file ({operation.error}).
      </Text>
      <Button label="Start over" onPress={onReset} disabled={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: type.body },
});
