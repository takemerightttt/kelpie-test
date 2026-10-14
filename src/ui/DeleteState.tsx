import { Text } from "react-native";
import type { Operation } from "../core/types";
import type { ImportActions } from "./actions";
import { Button } from "./components";
import { styles } from "./styles";

export function DeleteState({
  op,
  busy,
  deleted,
  actions,
}: {
  op: Operation;
  busy: boolean;
  deleted: boolean;
  actions: ImportActions;
}) {
  return (
    <>
      {op.deleteError ? (
        <Text style={styles.error}>
          Deletion failed - your data is still on the server. Try again.
        </Text>
      ) : null}
      {op.job?.status === "ready" ? (
        <Button
          label={op.deleteKey ? "Retry deletion" : "Delete this import"}
          kind="danger"
          onPress={actions.requestDelete}
          disabled={busy}
        />
      ) : null}
      {deleted ? (
        <Button label="New import" onPress={actions.reset} disabled={busy} />
      ) : null}
    </>
  );
}
