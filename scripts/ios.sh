#!/bin/sh
# Run the dev build: expo picks an available simulator unless IOS_DEVICE pins one.
# With IOS_DEVICE set, shut booted simulators down first, since expo reuses any already booted one.
set -eu

if ! curl -s http://127.0.0.1:8787/health >/dev/null; then
  echo "mock не запущен: npm run mock в отдельном терминале" >&2
  exit 1
fi

if [ -z "${IOS_DEVICE:-}" ]; then
  exec npx expo run:ios
fi

xcrun simctl shutdown all
exec npx expo run:ios --device "$IOS_DEVICE"
