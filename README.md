# Импорт банковской выписки - мобильный фрагмент

React Native + TypeScript, Expo SDK 57 (development build, нативный запуск - не web и не Expo Go).
Набор кандидата лежит в `mock-kit/` без изменений.

## Что нужно на машине

- macOS с Xcode (iOS-симулятор) и Android Studio (Android-эмулятор).
- Node.js 20+ (проверено на 22).
- Для Android: `adb` в PATH (идёт с Android Studio).

## Запуск с чистого checkout

```bash
git clone <repo> && cd kelpie-statement-import
npm ci

# 1. mock API (отдельный терминал)
npm run mock                 # http://127.0.0.1:8787
npm run mock:oversize        # создать fixtures/oversize.csv (>10 МиБ) - один раз

# 2a. iOS
npm run ios                  # соберёт dev build и откроет в симуляторе

# 2b. Android
adb reverse tcp:8787 tcp:8787
npm run android              # соберёт dev build и откроет в эмуляторе
```

Тестовые файлы нужно положить в симулятор/эмулятор, чтобы выбрать их в системном picker:
- iOS: перетащить файлы из `mock-kit/fixtures/` на окно симулятора - они появятся в «Файлы».
- Android: `adb push mock-kit/fixtures/statement.csv /sdcard/Download/` (так же для остальных).

Физическое устройство: в `app.json -> expo.extra.apiBaseUrl` указать LAN-адрес Mac
(например `http://192.168.1.10:8787`) и запустить mock с `HOST=0.0.0.0 npm run mock`.
Наружу в интернет API не открывать.

## Проверки

```bash
npm test            # Jest: unit + матрица приёмки против настоящего mock (поднимает его сам)
npm run typecheck   # tsc для приложения и тестов
npm run lint        # expo lint
npm run check       # всё вместе
```

`npm test` прогоняет каждую строку матрицы на неизменённом mock-сервере и сверяет счётчики
`/__test/state`:

| Сценарий | Что проверяет тест |
|---|---|
| happy (CSV и PDF) | байты реально ушли (acceptedBytes > 0), 202 = queued без отчёта, после ready - 2 позиции, временная копия удалена |
| lost_ack | первый POST без ответа -> job найден по ключу; после «перезапуска» (новый контроллер на том же хранилище) тот же job, `newJobs = 1`, `createRequests = 1` |
| lost_ack + ручной повтор | повтор с тем же ключом и байтами -> тот же job, `newJobs = 1`, `duplicateHits = 1` |
| stale_status | ready/3, затем processing/2 - состояние остаётся ready/3 |
| delete_failure | 503 -> «не удалено», ключ удаления сохранён; поздний ready не отменяет намерение; после happy тот же ключ -> deleting -> deleted/5 |
| spoofed + oversize | оба отклонены до POST, `createRequests` не изменился, временные копии удалены |
| ключ до отправки | первое сохранение операции происходит до upload |

Результат на сервере разработки (Linux, Node 22): **21/21 тестов, tsc и lint без ошибок**,
JS-бандлы iOS и Android собираются (`npx expo export`), нативные проекты генерируются (`npx expo prebuild`).

## Ручная проверка на устройствах

Сценарии переключаются на экране «Diagnostics» в приложении (кнопки `Scenario: ...`,
`Read counters`) - исходники между прогонами не меняются.

| Платформа | Устройство / ОС | Выбор файла | Полный импорт | lost_ack + relaunch | stale_status | delete_failure | spoofed / oversize |
|---|---|---|---|---|---|---|---|
| iOS | не проверено | - | - | - | - | - | - |
| Android | не проверено | - | - | - | - | - | - |

Таблица обновляется по фактическому запуску; непроверенная платформа остаётся «не проверено».

## Как устроено

- `src/core/` - логика без React Native: проверка файла по байтам, правила ревизий, поток импорта,
  HTTP-контракт, безопасный логгер. Тот же код работает в Jest против mock.
- `src/platform/` - `expo-file-system` (размер из метаданных, первые 32 байта через `FileHandle`,
  отправка файла потоком `File.upload` без загрузки в память), AsyncStorage, адрес API.
- `src/ui/` - экран импорта и экран диагностики.

Подробнее о решениях и рисках - `SELF_REVIEW.md`, о разрешениях и выкатке - `RELEASE_NOTES.md`.
