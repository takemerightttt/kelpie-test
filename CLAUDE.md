# Kelpie statement import (mobile test task)

React Native + TypeScript (Expo SDK 57, dev build - not Expo Go). One flow: pick a PDF/CSV
statement -> check it locally -> send the raw bytes to the local mock API -> follow the async job ->
survive a lost response and a relaunch -> delete safely.

## Commands

- `npm run mock` - start the unmodified mock API from `mock-kit/` on http://127.0.0.1:8787
- `npm run mock:oversize` - create `mock-kit/fixtures/oversize.csv` (>10 MiB)
- `npm run ios` / `npm run android` - native dev build in the simulator / emulator
- `npm start` - Metro for an already installed dev build
- `npm test` - Jest: unit tests + the acceptance matrix against the real mock (starts it itself)
- `npm run typecheck` / `npm run lint` / `npm run check` (all three)

## Structure

```
src/core/       pure TypeScript, no React Native - tested in Node
  fileCheck.ts  size from metadata, format from the first 32 bytes (never the extension/MIME)
  rules.ts      which server response may replace the screen (revisions, no resurrection)
  controller.ts the flow; saves the operation before every server-changing request
  api.ts        HTTP contract of the mock; transport injected (Http)
  log.ts        the only logger - its type has no slot for bytes, file names, descriptions
src/platform/   expo-file-system (files, upload), AsyncStorage, config
src/features/statement-import/
  ImportScreen.tsx  composition of sections only; useImport.ts binds core to React
  components/       sections (cards, report, details modal, diagnostics)
src/ui/         shared: theme.ts (all raw style values), Button, Card, Row
tests/          unit/ + integration/ (spawns mock-kit/mock-server.mjs)
mock-kit/       the candidate kit, byte-for-byte as received - never edit
```

## Rules for changes

- Never edit `mock-kit/`. Never re-send a file automatically: after a lost answer look the job up
  by key; a second POST only on user action, same key, same bytes.
- Persist before you send: the idempotency key and the delete key are saved first.
- A response with a lower revision, or anything but deleting/deleted after a delete request, is
  ignored (`rules.ts`). Do not say "deleted" before the server returns `status=deleted`.
- Private file copies: `Paths.document/imports/<key>`, removed once the server has the job, on
  reject, cancel and reset.
- Logs: only `SafeLog` from `src/core/log.ts`.
- Styles: one `StyleSheet.create` per component file, below the component; values only from
  `src/ui/theme.ts`. Inline style only for a props/state value next to a static one.
- `src/core` must not import `react-native` / `expo-*` (enforced by ESLint).
- Imports across layers use the `@/` alias (`@/core/...`, `@/ui/Row`); inside one feature or layer
  stay relative (`./`, `../useImport`).
- Expo changes between SDKs: check `https://docs.expo.dev/versions/v57.0.0/` before using an API;
  add native modules with `npx expo install`. `ios/` and `android/` are generated - do not edit.
- Done = `npm run check` green + a manual run on iOS and Android for UI changes.
