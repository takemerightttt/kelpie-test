import Constants from "expo-constants";

/**
 * The mock API address. Emulator/simulator: 127.0.0.1 (Android needs
 * `adb reverse tcp:8787 tcp:8787`). Physical device: set "apiBaseUrl" in
 * app.json -> expo.extra to the Mac's LAN address, never a public host.
 */
export const API_BASE_URL: string =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  "http://127.0.0.1:8787";
