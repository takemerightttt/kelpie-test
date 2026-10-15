import { StyleSheet, Text } from "react-native";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { colors, type } from "@/ui/theme";

/** The server answered 404 for a job it had created. Not a deletion, so nothing says "deleted". */
export function MissingCard({
  busy,
  onReset,
}: {
  busy: boolean;
  onReset: () => void;
}) {
  return (
    <Card title="Import not found">
      <Text style={styles.text}>
        The server no longer knows this import. It may have been removed
        elsewhere.
      </Text>
      <Button label="Start over" onPress={onReset} disabled={busy} />
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: type.body },
});
