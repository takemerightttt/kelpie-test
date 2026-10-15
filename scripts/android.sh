#!/bin/sh
# Boot an Android emulator if none is connected, forward the mock API port and run the dev build.
set -eu

SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
AVD="${AVD:-Medium_Phone_API_37.0}"
ADB="$SDK/platform-tools/adb"
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
  if ! "$SDK/emulator/emulator" -list-avds | grep -qx "$AVD"; then
    echo "AVD не найден: $AVD (список: $SDK/emulator/emulator -list-avds)" >&2
    exit 1
  fi
  echo "Запуск эмулятора $AVD..."
  "$SDK/emulator/emulator" -avd "$AVD" >/dev/null 2>&1 &
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
