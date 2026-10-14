import { useState } from "react";
import { ScrollView, Text } from "react-native";
import type { RecurringItem } from "../core/types";
import { Busy, Button, Card } from "./components";
import { ConfirmCard } from "./ConfirmCard";
import { DetailsModal } from "./DetailsModal";
import { Diagnostics } from "./Diagnostics";
import { OperationView } from "./OperationView";
import { PickCard } from "./PickCard";
import { styles } from "./styles";
import { useImport } from "./useImport";

export function ImportScreen() {
  const s = useImport();
  const [details, setDetails] = useState<RecurringItem | null>(null);
  const [diag, setDiag] = useState(false);

  const handleToggleDiagnostics = () => setDiag(!diag);
  const handleCloseDetails = () => setDetails(null);

  return (
    <ScrollView
      contentContainerStyle={styles.screenContent}
      style={styles.screen}
    >
      <Text style={styles.screenTitle} accessibilityRole="header">
        Statement import
      </Text>

      {s.notice ? (
        <Card>
          <Text style={styles.error}>{s.notice}</Text>
        </Card>
      ) : null}

      {s.pending ? (
        <ConfirmCard
          pending={s.pending}
          busy={s.busy}
          onConfirm={s.confirm}
          onCancel={s.cancel}
        />
      ) : s.op ? (
        <OperationView
          op={s.op}
          busy={s.busy}
          actions={s}
          onDetails={setDetails}
        />
      ) : (
        <PickCard busy={s.busy} onPick={s.pick} />
      )}

      {s.busy ? <Busy /> : null}

      <Button
        label={diag ? "Hide diagnostics" : "Diagnostics"}
        kind="secondary"
        onPress={handleToggleDiagnostics}
      />
      {diag ? <Diagnostics api={s.api} /> : null}

      <DetailsModal
        item={details}
        currency={s.op?.job?.currency ?? ""}
        onClose={handleCloseDetails}
      />
    </ScrollView>
  );
}
