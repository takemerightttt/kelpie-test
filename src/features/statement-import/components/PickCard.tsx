import { StyleSheet, Text } from "react-native";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { colors, type } from "@/ui/theme";

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

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: type.body },
});
