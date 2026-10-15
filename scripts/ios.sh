#!/bin/sh
# Run the dev build on a fixed simulator: expo reuses any already booted one, so shut them down first.
set -eu

IOS_DEVICE="${IOS_DEVICE:-iPhone 18 Pro}"

if ! curl -s http://127.0.0.1:8787/health >/dev/null; then
  echo "mock не запущен: npm run mock в отдельном терминале" >&2
  exit 1
fi

xcrun simctl shutdown all
exec npx expo run:ios --device "$IOS_DEVICE"
