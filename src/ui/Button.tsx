import { Pressable, StyleSheet, Text } from "react-native";
import { colors, opacity, radius, size, spacing, type, weight } from "./theme";

export function Button({
  label,
  onPress,
  kind = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[kind],
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Text
        style={[styles.label, kind === "secondary" && styles.secondaryLabel]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: size.touchTarget,
    borderRadius: radius.button,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    justifyContent: "center",
    alignItems: "center",
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondarySurface },
  danger: { backgroundColor: colors.danger },
  dim: { opacity: opacity.dim },
  label: {
    color: colors.onPrimary,
    fontSize: type.button,
    fontWeight: weight.semibold,
    textAlign: "center",
  },
  secondaryLabel: { color: colors.textStrong },
});
