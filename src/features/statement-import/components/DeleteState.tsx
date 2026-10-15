import { StyleSheet, Text } from "react-native";
import type { Operation } from "@/core/types";
import { Button } from "@/ui/Button";
import { colors, type } from "@/ui/theme";
import type { ImportActions } from "../useImport";

/** Shown above the report: a failed delete leaves the data on the server and on screen. */
export function DeleteError({ operation }: { operation: Operation }) {
  return operation.deleteError ? (
    <Text style={styles.error}>
      Deletion failed - your data is still on the server. Try again.
    </Text>
  ) : null;
}

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
      {operation.job?.status === "ready" ? (
        <Button
          label={operation.deleteKey ? "Retry deletion" : "Delete this import"}
          kind="danger"
          onPress={actions.requestDelete}
          disabled={busy}
        />
      ) : null}
      {deleted ? (
        <Button label="New import" onPress={actions.reset} disabled={busy} />
      ) : (
        <Button
          label="Start over"
          kind="secondary"
          onPress={actions.reset}
          disabled={busy}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: type.body },
});
