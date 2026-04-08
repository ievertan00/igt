# Design Spec: IGT Reliability and Bug Fix (v2.1)

**Date:** 2026-04-07
**Status:** Approved
**Topic:** Resolving Obsidian file locking, prompt injection, and PowerShell formatting bugs.

## 1. Overview
The Interactive Grammar Tool (IGT) currently keeps a persistent file handle to the Obsidian log file, causing access conflicts. It also uses the `-f` operator for prompt construction, which crashes on specific user inputs (e.g., `{0}`).

## 2. Goals
- **Eliminate File Locking**: Obsidian and other apps must be able to read/write the log file while IGT is running.
- **Robust Input Handling**: Inputs containing `{0}`, `$var`, or other special characters must not crash the script or cause unintended behavior.
- **Transient-to-Active Auto-Recovery**: If a log file is locked, IGT should skip logging for *that entry* but retry on the next one instead of staying in "Transient Mode" for the whole session.

## 3. Technical Changes

### 3.1. Logging: "Surgical Append"
- **Remove**: Persistent `[System.IO.StreamWriter]` and `$logWriter.Close()`.
- **Implement**: A dedicated `Log-Result` function that uses `Add-Content -Path $targetPath -Value $logEntry -Encoding utf8`. 
- **Wait/Retry Logic**: If `Add-Content` fails due to a lock, wait 100ms and retry once. If it still fails, notify the user and continue (skip logging for that one entry).

### 3.2. Prompt Construction: String Concatenation
- **Remove**: `$promptTemplate -f $userInput`.
- **Implement**: A simple string join: `$fullPrompt = "$systemPrompt`n`nInput Text: $userInput"`. This avoids PowerShell's `-f` operator limitations.

### 3.3. Input Sanitation
- **Validation**: Ensure `$userInput` is treated as a literal string in the `gemini` call. (PowerShell's `Read-Host` already handles most of this, but we'll ensure no additional expansion happens in the string join).

## 4. Components

### 4.1. `igt.ps1` Refactor
- **Setup**: Remove `StreamWriter` initialization.
- **Loop**: Replace `-f` with direct string interpolation.
- **Log Block**: Replace `$logWriter.WriteLine` with the new `Log-Result` function.

## 5. Testing Strategy
1.  **Lock Test**: Open the log file in an app that takes an exclusive lock (e.g., `[System.IO.File]::Open($path, 'Open', 'Read', 'None')` in another PowerShell window) and verify IGT continues to function (skipping or retrying the log).
2.  **Format Test**: Provide `{0}` as input and verify the script does not crash.
3.  **Variable Test**: Provide `$env:COMPUTERNAME` as input and verify Gemini receives the literal string, not the computer's name.
4.  **Recovery Test**: Unlock the file during a session and verify the *next* entry is logged successfully.
