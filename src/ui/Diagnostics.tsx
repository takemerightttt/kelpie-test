import { useState } from 'react';
import { Text } from 'react-native';
import type { ImportsApi, MockState } from '../core/api';
import { Button, Card, Row, styles } from './components';

const MODES = ['happy', 'lost_ack', 'stale_status', 'delete_failure'] as const;

/** Reviewer-only screen for the mock's test-control routes. */
export function Diagnostics({ api }: { api: ImportsApi }) {
  const [state, setState] = useState<MockState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setState(await api.mockState());
      setError(null);
    } catch {
      setError('Mock server is not reachable');
    }
  };

  return (
    <Card title="Mock diagnostics">
      {MODES.map((mode) => (
        <Button key={mode} label={`Scenario: ${mode}`} kind="secondary" onPress={async () => { await api.setScenario(mode).catch(() => undefined); await load(); }} />
      ))}
      <Button label="Read counters" kind="secondary" onPress={load} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {state ? (
        <>
          <Row label="mode" value={state.mode} />
          {Object.entries(state.stats).map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </>
      ) : null}
    </Card>
  );
}
