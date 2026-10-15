import { StyleSheet, Text } from "react-native";
import { Card } from "@/ui/Card";
import { colors, type } from "@/ui/theme";

export function NoticeCard({ message }: { message: string }) {
  return (
    <Card>
      <Text style={styles.error}>{message}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: type.body },
});
