import type { Inspected } from "../core/controller";
import { Button, Card, Row } from "./components";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ConfirmCard({
  pending,
  busy,
  onConfirm,
  onCancel,
}: {
  pending: Inspected;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Card title="Send this file?">
      <Row label="Name" value={pending.file.name} />
      <Row label="Size" value={formatSize(pending.size)} />
      <Row
        label="Format"
        value={pending.check.ok ? pending.check.format.toUpperCase() : "-"}
      />
      <Button label="Send" onPress={onConfirm} disabled={busy} />
      <Button
        label="Cancel"
        kind="secondary"
        onPress={onCancel}
        disabled={busy}
      />
    </Card>
  );
}
