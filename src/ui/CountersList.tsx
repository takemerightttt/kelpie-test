import type { MockState } from "../core/api";
import { Row } from "./components";

export function CountersList({ state }: { state: MockState | null }) {
  if (!state) return null;
  return (
    <>
      <Row label="mode" value={state.mode} />
      {Object.entries(state.stats).map(([name, value]) => (
        <Row key={name} label={name} value={String(value)} />
      ))}
    </>
  );
}
