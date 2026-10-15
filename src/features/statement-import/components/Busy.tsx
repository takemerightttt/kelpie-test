import { ActivityIndicator, StyleSheet } from "react-native";
import { spacing } from "@/ui/theme";

export function Busy() {
  return <ActivityIndicator accessibilityLabel="Loading" style={styles.busy} />;
}

const styles = StyleSheet.create({
  busy: { marginVertical: spacing.small },
});
