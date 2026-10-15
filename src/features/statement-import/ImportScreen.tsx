import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import type { RecurringItem } from "@/core/types";
import { Button } from "@/ui/Button";
import { colors, spacing, type, weight } from "@/ui/theme";
import { Busy } from "./components/Busy";
import { ConfirmCard } from "./components/ConfirmCard";
import { DetailsModal } from "./components/DetailsModal";
import { Diagnostics } from "./components/Diagnostics";
import { NoticeCard } from "./components/NoticeCard";
import { OperationView } from "./components/OperationView";
import { PickCard } from "./components/PickCard";
import { useImport } from "./useImport";

export function ImportScreen() {
  const importState = useImport();
  const [details, setDetails] = useState<RecurringItem | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const handleToggleDiagnostics = () => setDiagnosticsOpen(!diagnosticsOpen);
  const handleCloseDetails = () => setDetails(null);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        Statement import
      </Text>

      {importState.notice ? <NoticeCard message={importState.notice} /> : null}

      {importState.pending ? (
        <ConfirmCard
          pending={importState.pending}
          busy={importState.busy}
          onConfirm={importState.confirm}
          onCancel={importState.cancel}
        />
      ) : importState.operation ? (
        <OperationView
          operation={importState.operation}
          busy={importState.busy}
          actions={importState}
          onDetails={setDetails}
        />
      ) : (
        <PickCard busy={importState.busy} onPick={importState.pick} />
      )}

      {importState.busy ? <Busy /> : null}

      <Button
        label={diagnosticsOpen ? "Hide diagnostics" : "Diagnostics"}
        kind="secondary"
        onPress={handleToggleDiagnostics}
      />
      {diagnosticsOpen ? (
        <Diagnostics
          api={importState.api}
          log={importState.log}
          onReset={importState.reset}
        />
      ) : null}

      <DetailsModal
        item={details}
        currency={importState.operation?.job?.currency ?? ""}
        onClose={handleCloseDetails}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background },
  content: { padding: spacing.large, paddingTop: spacing.screenTop },
  title: {
    fontSize: type.title,
    fontWeight: weight.bold,
    marginBottom: spacing.medium,
    color: colors.textStrong,
  },
});
