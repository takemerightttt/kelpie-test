import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { formatMoney, isServerDeleted, monthlyTotalMinor } from '../core/rules';
import type { Operation, RecurringItem } from '../core/types';
import { Busy, Button, Card, Row, styles } from './components';
import { Diagnostics } from './Diagnostics';
import { useImport } from './useImport';

const STATUS_TEXT: Record<string, string> = {
  queued: 'Queued - waiting for processing',
  processing: 'Processing your statement',
  ready: 'Report ready',
  deleting: 'Deletion requested - waiting for the server to confirm',
  deleted: 'Deleted on the server',
  error: 'The server could not process this statement',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ImportScreen() {
  const s = useImport();
  const [details, setDetails] = useState<RecurringItem | null>(null);
  const [diag, setDiag] = useState(false);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56 }} style={{ backgroundColor: '#f3f4f7' }}>
      <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 12, color: '#111' }} accessibilityRole="header">
        Statement import
      </Text>

      {s.notice ? (
        <Card>
          <Text style={styles.error}>{s.notice}</Text>
        </Card>
      ) : null}

      {s.pending ? (
        <Card title="Send this file?">
          <Row label="Name" value={s.pending.file.name} />
          <Row label="Size" value={formatSize(s.pending.size)} />
          <Row label="Format" value={s.pending.check.ok ? s.pending.check.format.toUpperCase() : '-'} />
          <Button label="Send" onPress={s.confirm} disabled={s.busy} />
          <Button label="Cancel" kind="secondary" onPress={s.cancel} disabled={s.busy} />
        </Card>
      ) : s.op ? (
        <OperationView op={s.op} busy={s.busy} actions={s} onDetails={setDetails} />
      ) : (
        <Card title="Import a bank statement">
          <Text style={styles.text}>Choose a PDF or CSV statement. It is checked on this device before anything is sent.</Text>
          <Button label="Choose file" onPress={s.pick} disabled={s.busy} />
        </Card>
      )}

      {s.busy ? <Busy /> : null}

      <Button label={diag ? 'Hide diagnostics' : 'Diagnostics'} kind="secondary" onPress={() => setDiag(!diag)} />
      {diag ? <Diagnostics api={s.api} /> : null}

      <Modal visible={details !== null} transparent animationType="fade" onRequestClose={() => setDetails(null)}>
        <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 16 }}>
          {details ? (
            <Card title={details.merchant}>
              <Row label="Amount" value={formatMoney(details.amountMinor, s.op?.job?.currency ?? '')} />
              <Row label="Cadence" value={details.cadence} />
              <Row label="Last seen" value={details.lastSeen} />
              <Button label="Close" kind="secondary" onPress={() => setDetails(null)} />
            </Card>
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

type Actions = ReturnType<typeof useImport>;

function OperationView({ op, busy, actions, onDetails }: { op: Operation; busy: boolean; actions: Actions; onDetails: (i: RecurringItem) => void }) {
  if (op.phase === 'sending') {
    return <Card title="Sending..."><Text style={styles.text}>Uploading the statement.</Text></Card>;
  }
  if (op.phase === 'uncertain') {
    return (
      <Card title="Not sure the upload arrived">
        <Text style={styles.text}>
          The connection dropped before the server answered. Your file was not sent again. You can ask the server whether it got
          the upload, or send the same file again - it will not be imported twice.
        </Text>
        <Button label="Check again" onPress={actions.checkByKey} disabled={busy} />
        {op.localCopyUri ? <Button label="Send the same file again" kind="secondary" onPress={actions.retrySend} disabled={busy} /> : null}
        <Button label="Start over" kind="secondary" onPress={actions.reset} disabled={busy} />
      </Card>
    );
  }
  if (op.phase === 'failed') {
    return (
      <Card title="Upload refused">
        <Text style={styles.error}>The server did not accept this file ({op.error}).</Text>
        <Button label="Start over" onPress={actions.reset} disabled={busy} />
      </Card>
    );
  }

  const job = op.job;
  const deleted = isServerDeleted(op);
  return (
    <Card title={job ? STATUS_TEXT[job.status] ?? job.status : 'Waiting for the server'}>
      {job?.status === 'ready' && !op.deleteKey ? <Report op={op} onDetails={onDetails} /> : null}
      {op.deleteError ? (
        <Text style={styles.error}>Deletion failed - your data is still on the server. Try again.</Text>
      ) : null}
      {job?.status === 'ready' ? (
        <Button label={op.deleteKey ? 'Retry deletion' : 'Delete this import'} kind="danger" onPress={actions.requestDelete} disabled={busy} />
      ) : null}
      {deleted ? <Button label="New import" onPress={actions.reset} disabled={busy} /> : null}
      {!deleted ? <Button label="Refresh" kind="secondary" onPress={actions.refresh} disabled={busy} /> : null}
    </Card>
  );
}

function Report({ op, onDetails }: { op: Operation; onDetails: (i: RecurringItem) => void }) {
  const job = op.job;
  if (!job?.items) return null;
  const currency = job.currency ?? '';
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.text}>Recurring charges found: {job.items.length}</Text>
      {job.items.map((item) => (
        <View key={item.id} style={{ gap: 4, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 }}>
          <Row label={item.merchant} value={`${formatMoney(item.amountMinor, currency)} / month`} />
          <Button label="Details" kind="secondary" onPress={() => onDetails(item)} />
        </View>
      ))}
      <Row label="Total per month" value={formatMoney(monthlyTotalMinor(job), currency)} />
    </View>
  );
}
