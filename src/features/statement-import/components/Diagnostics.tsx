import { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";
import type { ImportsApi, MockState } from "@/core/api";
import type { SafeLog } from "@/core/log";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { colors, type } from "@/ui/theme";
import { CountersList } from "./CountersList";
import { ScenarioList, type Scenario } from "./ScenarioList";

type DiagnosticsProps = {
  api: ImportsApi;
  log: SafeLog;
  /** Clears the app's own operation: after a mock reset the server knows no job. */
  onReset: () => void;
};

export function Diagnostics({ api, log, onReset }: DiagnosticsProps) {
  const [state, setState] = useState<MockState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await api.mockState();
      const { createRequests, newJobs, duplicateHits, deleteRequests } =
        next.stats;
      log("counters_read", {
        createRequests,
        newJobs,
        duplicateHits,
        deleteRequests,
      });
      setState(next);
      setError(null);
    } catch {
      setError("Mock server is not reachable");
    }
  }, [api, log]);

  const handleScenario = useCallback(
    async (mode: Scenario) => {
      await api
        .setScenario(mode)
        .then(() => log("scenario_switched", { mode }))
        .catch(() => undefined);
      await load();
    },
    [api, load, log],
  );

  const handleResetMock = useCallback(async () => {
    try {
      await api.resetMock();
      log("mock_reset");
      onReset();
    } catch {
      setError("Mock server is not reachable");
      return;
    }
    await load();
  }, [api, load, log, onReset]);

  return (
    <Card title="Mock diagnostics">
      <ScenarioList onSelect={handleScenario} />
      <Button label="Read counters" kind="secondary" onPress={load} />
      <Button label="Reset mock" kind="danger" onPress={handleResetMock} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <CountersList state={state} />
    </Card>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, fontSize: type.body },
});
