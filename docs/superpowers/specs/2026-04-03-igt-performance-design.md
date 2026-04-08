# Design Spec: Interactive Grammar Tool (IGT) High-Performance v2

**Date:** 2026-04-03
**Status:** Draft
**Topic:** Performance optimization and bug prevention for the IGT PowerShell CLI.

## 1. Overview
The Interactive Grammar Tool (IGT) is a PowerShell-based CLI that leverages the `gemini` command-line tool to provide rapid text reviews. The goal of v2 is to address critical reliability issues (silent failures, unvalidated paths) and performance bottlenecks (disk churn, slow string processing).

## 2. Objectives
- **Zero Silent Failures:** Ensure all errors from the `gemini` CLI are captured and displayed.
- **Improved Responsiveness:** Reduce the overhead of output cleaning and logging.
- **Environment Resilience:** Handle missing configuration, missing log directories, and missing dependency files gracefully.
- **Safer Input Handling:** Prevent PowerShell variable expansion or injection from user input.

## 3. Technical Design

### 3.1. Architecture Changes
- **Configuration:** Externalize the model name to `igt_config.json`.
- **Logging:** Replace `Add-Content` with a persistent `System.IO.StreamWriter` to minimize file I/O overhead.
- **Error Handling:** Use `$LASTEXITCODE` and `2>&1` with a dedicated error display block to show raw diagnostics when Gemini fails.

### 3.2. Performance Optimizations
- **Compiled Regex:** Use `[regex]::new(..., 'Compiled')` for the noise filter to speed up output cleaning.
- **Transient Mode:** If the `ReviewPath` directory is missing or inaccessible, the tool will automatically switch to "Transient Mode" (running without logging) instead of crashing.

### 3.3. Security & Safety
- **Prompt Construction:** Use single-quoted here-strings and safe concatenation to ensure user input is treated as literal text, not PowerShell code.
- **CMD Guard:** Add existence checks in the `.cmd` wrapper to prevent silent exits when the `.ps1` is missing.

## 4. Components

### 4.1. `igt_config.json`
Update the schema to include:
```json
{
    "ReviewPath": "D:\\Library\\-06Notes\\Obsidian Vault\\02_Knowledge\\EnglishGrammar\\Review_&_Feedback.md",
    "Model": "gemini-2.5-flash"
}
```

### 4.2. `igt.ps1` Refactor
- **Setup Phase:** Validate config, set up `StreamWriter`, and compile regex.
- **Main Loop:**
    - Capture input.
    - Call `gemini` and capture both streams.
    - Check `$LASTEXITCODE`.
    - Apply compiled regex filter.
    - Display result and write to `StreamWriter`.
- **Cleanup Phase:** Close `StreamWriter` on exit.

### 4.3. `igt.cmd` Refactor
- Add `if not exist` check for the PowerShell script.

## 5. Testing Strategy
1.  **Positive Test:** Verify normal grammar review still works and logs correctly.
2.  **Negative Test (Config):** Delete `igt_config.json` and verify a clear error message.
3.  **Negative Test (Log Path):** Point `ReviewPath` to a non-existent directory and verify "Transient Mode" activation.
4.  **Negative Test (Gemini Failure):** Temporarily break the `gemini` command or API key and verify the raw error is displayed.
5.  **Performance Test:** Compare perceived latency between v1 and v2 for a single sentence.
