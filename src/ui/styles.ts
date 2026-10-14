import { StyleSheet } from "react-native";
import { theme } from "./theme";

export const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.card,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: theme.colors.textStrong,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  rowLabel: { color: theme.colors.textMuted, fontSize: 15 },
  rowValue: {
    color: theme.colors.textStrong,
    fontSize: 15,
    fontWeight: "500",
    flexShrink: 1,
  },
  text: { color: theme.colors.text, fontSize: 15 },
  hint: { color: theme.colors.textHint, fontSize: 13 },
  error: { color: theme.colors.danger, fontSize: 15 },
  button: {
    minHeight: 48,
    borderRadius: theme.radius.button,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  primary: { backgroundColor: theme.colors.primary },
  secondary: { backgroundColor: theme.colors.secondarySurface },
  danger: { backgroundColor: theme.colors.danger },
  dim: { opacity: 0.6 },
  buttonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  secondaryText: { color: theme.colors.textStrong },
  busy: { marginVertical: theme.spacing.sm },
  screen: { backgroundColor: theme.colors.background },
  screenContent: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.screenTop,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: theme.spacing.md,
    color: theme.colors.textStrong,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  report: { gap: theme.spacing.sm },
  reportItem: {
    gap: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: theme.spacing.sm,
  },
});
