import { ScenarioButton } from "./ScenarioButton";

export const SCENARIOS = [
  "happy",
  "lost_ack",
  "stale_status",
  "delete_failure",
] as const;

export type Scenario = (typeof SCENARIOS)[number];

export function ScenarioList({
  onSelect,
}: {
  onSelect: (mode: Scenario) => void;
}) {
  return (
    <>
      {SCENARIOS.map((mode) => (
        <ScenarioButton key={mode} mode={mode} onSelect={onSelect} />
      ))}
    </>
  );
}
