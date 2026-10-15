import { StyleSheet, Text } from "react-native";
import { Card } from "@/ui/Card";
import { colors, type } from "@/ui/theme";

export function SendingCard() {
  return (
    <Card title="Sending...">
      <Text style={styles.text}>Uploading the statement.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: type.body },
});
