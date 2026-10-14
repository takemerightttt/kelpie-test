import { Button } from "./components";
import type { Scenario } from "./ScenarioList";

export function ScenarioButton({
  mode,
  onSelect,
}: {
  mode: Scenario;
  onSelect: (mode: Scenario) => void;
}) {
  const handleScenario = () => onSelect(mode);
  return (
    <Button
      label={`Scenario: ${mode}`}
      kind="secondary"
      onPress={handleScenario}
    />
  );
}
