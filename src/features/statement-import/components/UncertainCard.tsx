import { StyleSheet, Text } from "react-native";
import type { Operation } from "@/core/types";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { colors, type } from "@/ui/theme";
import type { ImportActions } from "../useImport";

export function UncertainCard({
  operation,
  busy,
  actions,
}: {
  operation: Operation;
  busy: boolean;
  actions: ImportActions;
}) {
  return (
    <Card title="Not sure the upload arrived">
      <Text style={styles.text}>
        The connection dropped before the server answered. Your file was not
        sent again. You can ask the server whether it got the upload, or send
        the same file again - it will not be imported twice.
      </Text>
      <Button
        label="Check again"
        onPress={actions.checkByKey}
        disabled={busy}
      />
      {operation.localCopyUri ? (
        <Button
          label="Send the same file again"
          kind="secondary"
          onPress={actions.retrySend}
          disabled={busy}
        />
      ) : null}
      <Button
        label="Start over"
        kind="secondary"
        onPress={actions.reset}
        disabled={busy}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: type.body },
});
