# ClearWrite for Android

[简体中文](README.zh.md)

The Android app has its **own mobile-first interface** (`apps/mobile`). It is not a scaled-down copy of the desktop Web client: the layout system, components, navigation and screens were built independently for one-handed phone use. Its **colour palette follows the desktop ClearWrite Design System** — cool slate canvas, white cards, obsidian primary actions and brand green, plus a dark variant derived from the same hues (`apps/mobile/src/styles.css`). No desktop CSS or components are imported. Only colour values and the Local Runtime HTTP API are shared, so learning records and model settings stay identical to the desktop workspace.

A WebView shell (`apps/android`) loads the mobile build from `http://127.0.0.1:5173/mobile/`, which the Windows Local Runtime serves over ADB reverse. The computer must be running ClearWrite while the app is in use.

## What's in the app

- **Today** — due-review count, quick starts, 7-day activity, recent records and connection status.
- **Write** — Refine (correction / more natural / why / remember, save to Handbook, follow-up into Ask) and Express (two-way Chinese ↔ English), with paste, share, copy, read-aloud and auto-saved drafts.
- **Ask** — multi-turn usage questions, saved notes, read/delete, language choice.
- **Words** — lookup, saved-word library with filters and history, and the full four-rating spaced-review session.
- **Practice** — sentence production with difficulty/style/context filters, progressive hints, evaluation and reference answers.
- **My learning** — overview and growth metrics, Handbook with filters, Coach reports and explanations, saved notes.
- **Settings** — language, theme, haptics, model profiles, Markdown paths and runtime status.

Mobile-only behaviour: five-destination bottom bar with a raised Ask action, full-screen focus modes, bottom sheets, pull-to-refresh, offline cache of the last learning state, drafts that survive a WebView reload, safe-area/inset handling, bottom bar hiding while the keyboard is open, Android Back navigation, system dark-mode sync, native haptics, clipboard, system TTS with a Runtime TTS fallback, screen-on control, and a **Share to ClearWrite** (`ACTION_SEND text/plain`) entry that opens text directly in the composer. A native connection panel with **Retry** appears when the Local Runtime is unreachable.

## Build and run

Use PowerShell 7, JDK 17, Android SDK Platform 36, Build Tools 36.0.0 and Platform Tools. Set `ANDROID_HOME` to the SDK directory and make `adb` available on PATH. The app supports Android 8.0 and newer.

From the repository root, with the project's normal `.env` configured:

```powershell
npm ci
npm run android:build
npm run client:build
npm run web:start
```

`npm run client:build` builds **both** clients: desktop into `apps/web/dist/` and mobile into `apps/web/dist/mobile/`. Running only `web:build` is not enough — it clears `dist/` and the phone would get no `/mobile/` build. Keep the runtime bound to `127.0.0.1` and note the port on the `Ready on` line.

Connect a phone with USB debugging enabled, approve the computer on the phone, or start an emulator. In a second terminal:

```powershell
adb devices -l
adb install -r apps\android\build\ClearWrite-debug.apk
$clearWritePort = Read-Host 'Port shown on the ClearWrite Ready on line'
adb reverse tcp:5173 "tcp:$clearWritePort"
```

If several devices are connected, add `-s DEVICE_SERIAL` after `adb` for install and reverse. Open **ClearWrite** from the launcher. If forwarding disappears after reconnecting, rerun `adb reverse` and tap **Retry**. Port `5173` on the Android side is fixed.

### UI development without rebuilding

Terminal 1 starts the Local Runtime (API on `IGT_DEV_API_PORT`, default `18964`) and the desktop Vite server:

```powershell
npm run web:dev
```

Terminal 2 starts the mobile Vite server (default port `5174`, API proxied to `18964`):

```powershell
npm run mobile:dev
```

Then forward to the mobile Vite port instead of the runtime port:

```powershell
adb reverse tcp:5173 tcp:5174
```

Use `IGT_MOBILE_PORT` / `IGT_DEV_API_PORT` in `.env` to change those ports. Frontend edits hot-reload; Android shell edits still require `npm run android:build` and reinstalling the APK.

### Checks

```powershell
npm run mobile:typecheck
npm run test:mobile-app
```

`test:mobile-app` verifies `/mobile/` static routing, renders all 12 screens at 320/360/390/430 px (no horizontal overflow, ≥44 px navigation targets, WCAG 2.5.8 target minimum, 16 px text fields), and checks dark mode, safe-area insets, keyboard handling, Back navigation, draft persistence and the share bridge. It uses synthetic API payloads only — no database and no model calls.

## Device checks

Confirm the app opens **Today**, then use the bottom bar to visit Write, Ask, Words and Practice, and the top-right avatar for My learning and Settings. Check that Android Back returns to the previous screen, the bottom bar hides while the soft keyboard is open, system dark mode changes the theme, and **Share → ClearWrite** from another app lands in the Write composer. With the app closed, remove forwarding with `adb reverse --remove tcp:5173`, reopen the app to see the connection panel, then restore forwarding and tap **Retry**. The APK uses a local debug signing key kept in the ignored build directory.
