# IGT High-Performance v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Interactive Grammar Tool (IGT) for zero silent failures, improved responsiveness, and environment resilience.

**Architecture:** A single-process PowerShell loop with persistent logging via `StreamWriter`, fast regex-based output filtering, and explicit exit-code checking for the `gemini` CLI.

**Tech Stack:** PowerShell, Gemini CLI.

---

### Task 1: Configuration & Model Externalization

**Files:**
- Modify: `C:\Users\Evertan\.igt\igt_config.json`
- Modify: `C:\Users\Evertan\.igt\igt.ps1`

- [ ] **Step 1: Update `igt_config.json` with Model field**

```json
{
    "ReviewPath": "D:\\Library\\-06Notes\\Obsidian Vault\\02_Knowledge\\EnglishGrammar\\Review_&_Feedback.md",
    "Model": "gemini-2.5-flash"
}
```

- [ ] **Step 2: Update `igt.ps1` to load Model from config**

```powershell
# Replace hardcoded model with:
$config = Get-Content $configPath | ConvertFrom-Json
if (-not $config.Model) { $config | Add-Member -MemberType NoteProperty -Name "Model" -Value "gemini-2.5-flash" }
$model = $config.Model
```

- [ ] **Step 3: Run script to verify config loads**

Run: `.\igt.ps1` (Press Ctrl+C immediately after startup)
Expected: No "Property not found" errors.

- [ ] **Step 4: Commit**

```bash
git add igt_config.json igt.ps1
git commit -m "feat: externalize model to config"
```

---

### Task 2: Robust Logging & Transient Mode

**Files:**
- Modify: `C:\Users\Evertan\.igt\igt.ps1`

- [ ] **Step 1: Implement directory validation and StreamWriter setup**

```powershell
$targetPath = $config.ReviewPath
$logWriter = $null

if ($targetPath) {
    $logDir = Split-Path $targetPath -Parent
    if (-not (Test-Path $logDir)) {
        Write-Host "Warning: Log directory not found: $logDir. Running in Transient Mode (no logging)." -ForegroundColor Yellow
        $targetPath = $null
    } else {
        try {
            $logWriter = [System.IO.StreamWriter]::new($targetPath, $true, [System.Text.Encoding]::UTF8)
            $logWriter.AutoFlush = $true
        } catch {
            Write-Host "Warning: Could not open log file. Running in Transient Mode." -ForegroundColor Yellow
            $targetPath = $null
        }
    }
}
```

- [ ] **Step 2: Update main loop to use `$logWriter` and close it on exit**

```powershell
# Inside loop:
if ($logWriter) { $logWriter.WriteLine($logEntry) }

# Wrap the while loop in try/finally to ensure closure:
try {
    while ($true) { ... }
} finally {
    if ($logWriter) { $logWriter.Close() }
}
```

- [ ] **Step 3: Verify "Transient Mode" by changing config to a fake path**

Change `ReviewPath` to `Z:\fake\path.md`. Run `.\igt.ps1`.
Expected: Yellow warning shown, tool starts normally.

- [ ] **Step 4: Commit**

```bash
git add igt.ps1
git commit -m "feat: add robust logging and transient mode"
```

---

### Task 3: Optimized Execution & Error Handling

**Files:**
- Modify: `C:\Users\Evertan\.igt\igt.ps1`

- [ ] **Step 1: Replace backtick expansion with safe prompt construction**

```powershell
# Replace $fullPrompt line with:
$promptTemplate = @"
$systemPrompt

Input Text: {0}
"@
$fullPrompt = $promptTemplate -f $userInput
```

- [ ] **Step 2: Implement explicit exit code checking**

```powershell
$rawOutput = $fullPrompt | & gemini -p - -m $model --extensions none --approval-mode yolo 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nError: Gemini failed (Exit Code $LASTEXITCODE)" -ForegroundColor Red
    $rawOutput | ForEach-Object { Write-Host $_ -ForegroundColor DarkRed }
    continue
}
```

- [ ] **Step 3: Verify error handling by using a fake model name**

Set `Model` to `non-existent-model` in `igt_config.json`. Run `.\igt.ps1`.
Expected: Red error message showing Gemini's actual error output.

- [ ] **Step 4: Task Complete**

(No git commit per user request)

---

### Task 4: High-Performance Output Filtering

**Files:**
- Modify: `C:\Users\Evertan\.igt\igt.ps1`

- [ ] **Step 1: Compile noise regex outside the loop**

```powershell
$noisePattern = [regex]::new('YOLO mode|Loaded cached|Loading extension|Scheduling MCP|Executing MCP|MCP context|Warning:', [System.Text.RegularExpressions.RegexOptions]::Compiled)
```

- [ ] **Step 2: Replace `foreach` filter with high-performance filter**

```powershell
$cleanLines = $rawOutput | Where-Object { -not $noisePattern.IsMatch($_.ToString()) }
$cleanOutput = ($cleanLines -join "`n").Trim()
```

- [ ] **Step 3: Verify filtering still removes noise**

Run `.\igt.ps1` and provide a simple sentence.
Expected: Only the "Review/Correction/Refine" sections are shown, no "YOLO mode" lines.

- [ ] **Step 4: Commit**

```bash
git add igt.ps1
git commit -m "perf: use compiled regex for faster output filtering"
```

---

### Task 5: CMD Wrapper Guard

**Files:**
- Modify: `C:\Users\Evertan\.igt\igt.cmd`

- [ ] **Step 1: Add existence check to `igt.cmd`**

```cmd
@echo off
if not exist "%~dp0igt.ps1" (
    echo Error: igt.ps1 not found in %~dp0
    pause
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0igt.ps1"
```

- [ ] **Step 2: Verify by temporarily renaming `igt.ps1`**

Rename `igt.ps1` to `igt.ps1.bak`. Run `igt.cmd`.
Expected: "Error: igt.ps1 not found" message.

- [ ] **Step 3: Commit**

```bash
git add igt.cmd
git commit -m "fix: add existence guard to cmd wrapper"
```
r"
```
