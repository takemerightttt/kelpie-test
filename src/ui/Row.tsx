import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, type, weight } from "./theme";

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.small,
  },
  label: { color: colors.textMuted, fontSize: type.body },
  value: {
    color: colors.textStrong,
    fontSize: type.body,
    fontWeight: weight.medium,
    flexShrink: 1,
  },
});
