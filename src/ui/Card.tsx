import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, type, weight } from "./theme";

export function Card({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      {title ? (
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.large,
    marginBottom: spacing.medium,
    gap: spacing.small,
  },
  title: {
    fontSize: type.heading,
    fontWeight: weight.semibold,
    color: colors.textStrong,
  },
});
