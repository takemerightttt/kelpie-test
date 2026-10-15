#!/bin/sh
# Boot an Android emulator if none is connected, forward the mock API port and run the dev build.
# AVD picks a specific emulator; by default the first one from -list-avds is used.
set -eu

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$SDK/platform-tools/adb"
EMULATOR="$SDK/emulator/emulator"
BOOT_TIMEOUT=180

if [ ! -x "$ADB" ]; then
  echo "adb не найден: $ADB (задайте ANDROID_HOME)" >&2
  exit 1
fi

if ! curl -s http://127.0.0.1:8787/health >/dev/null; then
  echo "mock не запущен: npm run mock в отдельном терминале" >&2
  exit 1
fi

if ! "$ADB" devices | awk 'NR > 1 && $2 == "device" { found = 1 } END { exit !found }'; then
  avds="$("$EMULATOR" -list-avds)"
  if [ -z "$avds" ]; then
    echo "AVD не найден: создайте AVD в Android Studio (Device Manager)" >&2
    exit 1
  fi
  AVD="${AVD:-$(printf '%s\n' "$avds" | head -n 1)}"
  if ! printf '%s\n' "$avds" | grep -qx "$AVD"; then
    echo "AVD не найден: $AVD (список: $EMULATOR -list-avds)" >&2
    exit 1
  fi
  echo "Запуск эмулятора $AVD..."
  "$EMULATOR" -avd "$AVD" >/dev/null 2>&1 &
fi

echo "Ожидание загрузки Android..."
"$ADB" wait-for-device
elapsed=0
until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
  if [ "$elapsed" -ge "$BOOT_TIMEOUT" ]; then
    echo "эмулятор не загрузился за ${BOOT_TIMEOUT} с" >&2
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed + 2))
done

"$ADB" reverse tcp:8787 tcp:8787 >/dev/null
if ! "$ADB" reverse --list | grep -q "tcp:8787 tcp:8787"; then
  echo "adb reverse tcp:8787 не установлен" >&2
  exit 1
fi

exec npx expo run:android
