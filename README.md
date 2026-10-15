# Импорт банковской выписки - мобильный фрагмент

React Native + TypeScript, Expo SDK 57 (development build, нативный запуск - не web и не Expo Go).
Набор кандидата лежит в `mock-kit/` без изменений.

## Что нужно на машине

- macOS с Xcode (iOS-симулятор) и Android Studio (Android-эмулятор).
- Node.js 20+ (проверено на 22).
- Для Android: SDK в `$ANDROID_HOME` или `~/Library/Android/sdk` (ставится с Android Studio).

## Запуск с чистого checkout

```bash
git clone https://github.com/takemerightttt/kelpie-test.git && cd kelpie-test
npm ci

npm run mock       # 1. mock API на http://127.0.0.1:8787 - в отдельном терминале
npm run android    # 2. поднимет эмулятор (если устройство не подключено), сделает adb reverse, соберёт dev build
npm run ios        # 3. соберёт dev build на симуляторе
```

По умолчанию берётся первый доступный симулятор/AVD (Android: если adb уже видит устройство, используется оно). Конкретное устройство: `IOS_DEVICE="iPhone 18 Pro Max" npm run ios` / `AVD=<имя AVD> npm run android` (список: `$ANDROID_HOME/emulator/emulator -list-avds`).

Тестовые файлы нужно положить в симулятор/эмулятор, чтобы выбрать их в системном picker:
- Android: `adb push mock-kit/fixtures/statement.csv /sdcard/Download/` (так же для остальных).
- iOS 26/27: перетаскивание на окно симулятора и загрузка через Safari не работают (ошибка Apple FB19888064).
  Рабочий способ - скопировать файлы в хранилище приложения «Файлы» загруженного симулятора:
  ```bash
  xcrun simctl launch booted com.apple.DocumentsApp   # один раз, чтобы появилась папка
  DEST=$(find ~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Containers/Shared/AppGroup -maxdepth 2 -type d -name "File Provider Storage" | head -1)
  rsync -av mock-kit/fixtures/ "$DEST/"
  ```
  UDID загруженного симулятора: `xcrun simctl list devices | grep Booted`. Файлы появятся в «Файлы» -> «На iPhone».
  Папок `File Provider Storage` может быть несколько - нужна та, чей AppGroup относится к
  `group.com.apple.FileProvider.LocalStorage` («На iPhone»).
- Xcode 27: приложения Simulator.app больше нет, его заменил DeviceHub (`/Applications/Xcode.app/Contents/Applications/DeviceHub.app`).
  Expo 57 открывает его сам; вручную окно симулятора открывается так: `open "devices://device/open?id=<UDID>"`.
  Если после `IOS_DEVICE=... npm run ios` приложение осталось за рабочим столом: `xcrun simctl launch booted com.kuliaev.kelpiestatementimport`.
- `oversize.csv` (>10 МиБ) не лежит в наборе - создать один раз: `npm run mock:oversize`.

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
| гонки состояния (stateRaces) | GET в полёте + Delete не возвращает job в ready; resume() во время POST не перетирает created; после stale-ответа отчёт остаётся на экране; relaunch в фазе sending находит job по ключу без второго POST |
| логи (logs) | в happy, lost_ack и delete_failure ни одна запись логгера не содержит имя файла, мерчантов, суммы и заголовок CSV |
| приватные копии (privateCopies) | при старте удаляются копии, не относящиеся к текущей операции; копия на экране подтверждения не трогается; пустая папка после «Start over» |
| системные копии iOS (systemCopies) | после проверки файла и при старте вызывается очистка Inbox; её ошибка не ломает поток и не пишет путей в лог |
| имя файла (fileNameHeader) | `X-File-Name` percent-encoded, кириллическое имя доходит до mock и принимается, длина укладывается в 255 |

Результат на сервере разработки (Linux, Node 22): **46/46 тестов, tsc и lint без ошибок**,
JS-бандлы iOS и Android собираются (`npx expo export`), нативные проекты генерируются (`npx expo prebuild`).

## Ручная проверка на устройствах

Сценарии переключаются на экране «Diagnostics» в приложении (кнопки `Scenario: ...`,
`Read counters`) - исходники между прогонами не меняются.

### Ручной прогон матрицы (5 минут)

Все кнопки сценариев и счётчики - на экране «Diagnostics» (`Scenario: ...`, `Read counters`, `Reset mock`).
Счётчики ниже - значения `/__test/state` после каждого шага, если начать с `Reset mock`.

1. **Reset mock** -> `Read counters`: все нули.
2. **happy**: `Choose file` -> `statement.pdf` -> `Confirm`. Экран: Queued -> Processing -> «Report ready», 2 позиции, Total 151.99 AUD. Счётчики: `createRequests 1, newJobs 1`.
3. **stale_status**: `Scenario: stale_status` -> на карточке `Refresh` дважды. Второй ответ mock - processing/2; экран остаётся «Report ready» с позициями, в логе `stale_response_ignored`.
4. **delete_failure**: `Scenario: delete_failure` -> `Delete this import`. Экран: «Deletion failed - your data is still on the server», отчёт остаётся виден. `Scenario: happy` -> `Retry deletion` -> «Deletion requested...» -> «Deleted on the server» -> `New import`. Счётчики: `deleteRequests` = число нажатий (503) + 1.
5. **lost_ack + relaunch**: `Scenario: lost_ack` -> `Choose file` -> `statement.csv` -> `Confirm`. POST остаётся без ответа, приложение находит job по ключу и показывает «Report ready» (в логе `import_uncertain` -> `import_recovered`). Убить процесс и запустить заново:
   - iOS: `xcrun simctl terminate booted com.kuliaev.kelpiestatementimport && xcrun simctl launch booted com.kuliaev.kelpiestatementimport`
   - Android: `adb shell am force-stop com.kuliaev.kelpiestatementimport && adb shell monkey -p com.kuliaev.kelpiestatementimport 1`
   На экране тот же отчёт без выбора файла. Счётчики: `createRequests 2, newJobs 2, duplicateHits 0` (второго POST нет). Затем `Delete this import` -> «Deleted on the server» -> `New import`.
6. **spoofed + oversize**: `Read counters` (запомнить `createRequests`) -> `Choose file` -> `spoofed.pdf`: «This is not a PDF or CSV statement.» -> `Choose file` -> `oversize.csv`: «This file is larger than 10 MiB.» -> `Read counters`: `createRequests` не изменился.

Если POST остался без ответа и job по ключу не найден (404), на экране «Not sure the upload arrived» с кнопками `Check again` (поиск по ключу) и `Send the same file again` (тот же ключ и байты - mock вернёт тот же job, `duplicateHits +1`).

| Платформа | Устройство / ОС | Выбор файла | Полный импорт | lost_ack + relaunch | stale_status | delete_failure | spoofed / oversize |
|---|---|---|---|---|---|---|---|
| iOS | симулятор iPhone 18 Pro Max / iOS 27.0 (Xcode 27, DeviceHub) | да | да (PDF и CSV, Report ready 151.99 AUD) | да (POST без ответа -> job найден по ключу -> terminate/launch -> тот же job, newJobs +1) | да (processing/2 после ready/3 проигнорирован, отчёт на экране) | да (503 -> «не удалено», повтор тем же ключом -> deleted) | да (оба отклонены до POST, createRequests не изменился) |
| Android | эмулятор Medium Phone API 37 / Android 17 (Android Studio) | да | да (PDF и CSV, Report ready 151.99 AUD) | да (POST без ответа -> job найден по ключу -> перезапуск процесса -> тот же job, newJobs +1) | да (processing/2 после ready/3 проигнорирован, отчёт на экране) | да (503 -> «не удалено», повтор тем же ключом -> deleted) | да (оба отклонены до POST, createRequests не изменился) |

Прогон 15.10.2026 на macOS, Node 22, после `npx expo prebuild --clean`. Лог каждого прогона: `[import] ...` строки в терминале
`npm run android` / `npm run ios` (события, счётчики mock, маршруты без параметров; имена файлов и содержимое отчёта в лог не попадают).

## Как устроено

- `src/core/` - логика без React Native: проверка файла по байтам, правила ревизий, поток импорта,
  HTTP-контракт, безопасный логгер. Тот же код работает в Jest против mock.
- `src/platform/` - `expo-file-system` (размер из метаданных, первые 32 байта через `FileHandle`,
  отправка файла потоком `File.upload` без загрузки в память), AsyncStorage, адрес API.
- `src/features/statement-import/` - экран импорта (`ImportScreen` - только композиция секций),
  хук `useImport` (связывает core с React), секции и диагностика в `components/`.
- `src/ui/` - общее: `theme.ts` (единственное место с цветами, отступами, размерами шрифта),
  `Button`, `Card`, `Row`. Стили - `StyleSheet.create` в файле каждого компонента.
- Импорт `react-native` / `expo-*` в `src/core` запрещён правилом ESLint (`npm run lint`).

Подробнее о решениях и рисках - `SELF_REVIEW.md`, о разрешениях и выкатке - `RELEASE_NOTES.md`.
