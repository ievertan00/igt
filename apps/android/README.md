# ClearWrite for Android

[简体中文](README.zh.md)

The Android development app has a mobile layout with five bottom destinations and in-page controls for Grammar, Express, lookup, review and saved words. It runs in a WebView and connects to the Windows Local Runtime through ADB reverse. Writing, Vocabulary, Practice, Ask and My Learning use the same learning records and model settings as the desktop workspace. The computer must be running ClearWrite while the app is in use.

## Build and run

Use PowerShell 7, JDK 17, Android SDK Platform 36, Build Tools 36.0.0 and Platform Tools. Set `ANDROID_HOME` to the SDK directory and make `adb` available on PATH. The app supports Android 8.0 and newer.

From the repository root, with the project's normal `.env` configured, run:

```powershell
npm run android:build
npm run web:build
npm run web:start
```

Keep the runtime bound to `127.0.0.1`. In the startup output, note the port shown on the `Ready on` line. Connect a phone with USB debugging enabled, approve the computer on the phone, or start an Android emulator. In a second terminal, run:

```powershell
adb devices -l
adb install -r apps\android\build\ClearWrite-debug.apk
$clearWritePort = Read-Host 'Port shown on the ClearWrite Ready on line'
adb reverse tcp:5173 "tcp:$clearWritePort"
```

If several devices are connected, add `-s DEVICE_SERIAL` after `adb` for both install and reverse. Open **ClearWrite** from the app launcher. If the forwarding rule disappears after reconnecting, rerun `adb reverse` and tap **Retry**.

For Vite development, forward to the Web port printed by `npm run web:dev`. Port `5173` on the Android side is fixed in both commands. Rebuild the Web client after changing frontend code when using `npm run web:start`. Rebuild and reinstall the APK after changing Android code.

## Device checks

Confirm the app opens Grammar, then use the bottom bar to visit Words, Practice, Ask and Learning. Check that Android Back returns to the previous screen and that the bottom bar hides while the soft keyboard is open. With the app closed, remove the forwarding rule with `adb reverse --remove tcp:5173`, reopen it, then restore forwarding and tap **Retry**. The APK uses a local debug signing key kept in the ignored build directory.
