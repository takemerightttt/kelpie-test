import { useCallback, useState } from "react";
import { Text } from "react-native";
import type { ImportsApi, MockState } from "../core/api";
import { Button, Card } from "./components";
import { CountersList } from "./CountersList";
import { ScenarioList, type Scenario } from "./ScenarioList";
import { styles } from "./styles";

export function Diagnostics({ api }: { api: ImportsApi }) {
  const [state, setState] = useState<MockState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setState(await api.mockState());
      setError(null);
    } catch {
      setError("Mock server is not reachable");
    }
  }, [api]);

  const handleScenario = useCallback(
    async (mode: Scenario) => {
      await api.setScenario(mode).catch(() => undefined);
      await load();
    },
    [api, load],
  );

  return (
    <Card title="Mock diagnostics">
      <ScenarioList onSelect={handleScenario} />
      <Button label="Read counters" kind="secondary" onPress={load} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <CountersList state={state} />
    </Card>
  );
}
