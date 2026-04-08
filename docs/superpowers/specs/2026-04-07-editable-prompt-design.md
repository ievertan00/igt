# Spec: Editable System Prompt for IGT

**Topic:** Moving the hardcoded system prompt into an editable external file.
**Date:** 2026-04-07

## 1. Goal
The Interactive Grammar Tool (IGT) currently hardcodes the "Linguistic Validator" prompt inside its PowerShell scripts (`igt.ps1` and `profile_igt.ps1`). This makes it difficult to customize the tool's behavior without editing the code. This spec moves the prompt into a plain text file, making it easily editable.

## 2. Architecture

### 2.1. File Structure
- **New File**: `C:\Users\Evertan\.igt\system_prompt.txt`
  - Purpose: Contains the raw text of the system prompt.
- **Config Update**: `C:\Users\Evertan\.igt\igt_config.json`
  - New Key: `"SystemPromptPath": "system_prompt.txt"`

### 2.2. Loading Logic
1. Both `igt.ps1` and `profile_igt.ps1` will load the `SystemPromptPath` from the configuration.
2. If the path is relative, it will be resolved against the directory where the script is located.
3. The scripts will use `Get-Content -Raw` to read the prompt file into memory.

### 2.3. Fallback Mechanism (Safety)
To prevent the tool from breaking if the file is accidentally deleted or moved:
- If `SystemPromptPath` is missing or the file cannot be read, the scripts will fall back to the **current hardcoded prompt** as a hardcoded string.
- This ensures the tool remains functional even with an invalid configuration.

## 3. Performance Impact
- **Reading File**: ~1ms to 3ms using `Get-Content -Raw`.
- **Total Overhead**: Less than 5ms (negligible compared to the 1s+ Gemini API call).

## 4. Success Criteria
- Editing `system_prompt.txt` changes Gemini's output behavior immediately.
- Deleting `system_prompt.txt` does not crash the tool (falls back to hardcoded default).
- `profile_igt.ps1` accurately measures the time taken to load the prompt from the file.
