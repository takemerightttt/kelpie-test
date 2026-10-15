import { StyleSheet, Text } from "react-native";
import type { Operation } from "@/core/types";
import { Button } from "@/ui/Button";
import { colors, type } from "@/ui/theme";
import type { ImportActions } from "../useImport";

export function DeleteState({
  operation,
  busy,
  deleted,
  actions,
}: {
  operation: Operation;
  busy: boolean;
  deleted: boolean;
  actions: ImportActions;
}) {
  return (
    <>
      {operation.deleteError ? (
        <Text style={styles.error}>
          Deletion failed - your data is still on the server. Try again.
        </Text>
      ) : null}
      {operation.job?.status === "ready" ? (
        <Button
          label={operation.deleteKey ? "Retry deletion" : "Delete this import"}
          kind="danger"
          onPress={actions.requestDelete}
          disabled={busy}
        />
      ) : null}
      {operation.deleteError !== null && (
        <Button
          label="Start over"
          kind="secondary"
          onPress={actions.reset}
          disabled={busy}
        />
      )}
      {deleted ? (
        <Button label="New import" onPress={actions.reset} disabled={busy} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: type.body },
});
