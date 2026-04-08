# IGT Reliability and Bug Fix (v2.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve Obsidian file locking conflicts, fix prompt formatting crashes, and prevent unintended variable expansion.

**Architecture:** Switch to "Surgical Append" for logging to eliminate persistent file locks and use direct string concatenation for prompt construction to avoid PowerShell's `-f` operator limitations.

**Tech Stack:** PowerShell, Gemini CLI.

---

### Task 1: Refactor `igt.ps1` for Reliability

**Files:**
- Modify: `C:\Users\Evertan\.igt\igt.ps1`

- [ ] **Step 1: Replace persistent logging and formatting with surgical updates**

```powershell
# Interactive Grammar Tool (IGT) - Reliability v2.1
$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$configPath = Join-Path $scriptDir "igt_config.json"

# 1. Load Config Once
if (-not (Test-Path $configPath)) {
    Write-Host "Error: igt_config.json not found in $scriptDir" -ForegroundColor Red
    exit 1
}
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$model = if ([string]::IsNullOrWhiteSpace($config.Model)) { "gemini-2.5-flash" } else { $config.Model }
$targetPath = $config.ReviewPath

# 2. Optimized System Prompt
$systemPrompt = @"
Act as an expert 'Linguistic Validator,' 'Professional Editor,' and 'Master Wordsmith.' Your goal is to provide meticulous text reviews. Focus strictly on the latest input content; treat the input as a standalone text and ignore all historical conversation context.

Purpose and Goals:
Audit: Review user-provided text for all grammatical errors, including syntax, punctuation, spelling, and tense consistency.

Enhance: Improve clarity, conciseness, flow, and impact while strictly preserving the original meaning and intent.
Deliver: Provide a polished, professional, and error-free final version of the user's text.

Behaviors and Rules:
Initial Assessment:
State immediately if the text is 'Grammatically Correct' or 'Requires Corrections'.
List specific error types found (e.g., 'Subject-Verb Agreement', 'Punctuation', 'Typos').

You must strictly follow this Output Format:
**Review**: [State "The original sentence is grammatically correct/incorrect." List specific errors identified and briefly explain the reasoning.]
**Correction**: [Correct grammatical errors and generate the optimized, error-free version of the original sentence.]
**Refine**: [Generate a polished version of the original sentence that is more natural, precise, and professional.]
"@

# 3. Optimization Environment Variables
$env:GEMINI_SYSTEM_MD = "false"
$env:GEMINI_TELEMETRY_ENABLED = "false"
$env:NO_COLOR = "1"

# 4. Helper Function: Surgical Logging
function Log-Result {
    param([string]$targetPath, [string]$userInput, [string]$cleanOutput)
    if (-not $targetPath) { return }

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "`n---`n### [$timestamp]`n**User Input**: $userInput`n**Gemini Output**:`n$cleanOutput"
    
    $maxRetries = 2
    $retryCount = 0
    $success = $false

    while (-not $success -and $retryCount -le $maxRetries) {
        try {
            Add-Content -Path $targetPath -Value $logEntry -Encoding utf8 -ErrorAction Stop
            $success = $true
            Write-Host "[Logged successfully]`n" -ForegroundColor DarkGray
        } catch {
            $retryCount++
            if ($retryCount -le $maxRetries) {
                Write-Host "Log file locked. Retrying in 100ms... ($retryCount/$maxRetries)" -ForegroundColor Gray
                Start-Sleep -Milliseconds 100
            } else {
                Write-Host "Warning: Could not log entry. File locked by another process." -ForegroundColor Yellow
            }
        }
    }
}

Write-Host "--- Interactive Grammar Tool (IGT) Started [Reliability Mode] ---" -ForegroundColor Yellow
Write-Host "Logging to: $targetPath" -ForegroundColor Gray
Write-Host "Type 'exit' to stop.`n" -ForegroundColor Gray

$noisePattern = [regex]::new('YOLO mode|Loaded cached|Loading extension|Scheduling MCP|Executing MCP|MCP context|Warning:', [System.Text.RegularExpressions.RegexOptions]::Compiled)

while ($true) {
    Write-Host -NoNewline "Grammar Input > " -ForegroundColor Cyan
    $userInput = Read-Host
    
    if ($userInput -eq "exit" -or $userInput -eq "quit") { break }
    if ([string]::IsNullOrWhiteSpace($userInput)) { continue }

    Write-Host "Processing..." -ForegroundColor Gray
    
    # Use direct concatenation to avoid -f operator formatting errors (like {0})
    $fullPrompt = "$systemPrompt`n`nInput Text: $userInput"
    
    $rawOutput = $fullPrompt | & gemini -p - -m $model --extensions none --approval-mode yolo 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nError: Gemini failed (Exit Code $LASTEXITCODE)" -ForegroundColor Red
        $rawOutput | ForEach-Object { Write-Host $_ -ForegroundColor DarkRed }
        continue
    }
    
    $cleanLines = $rawOutput | Where-Object { -not $noisePattern.IsMatch($_.ToString()) }
    $cleanOutput = ($cleanLines -join "`n").Trim()

    if ([string]::IsNullOrWhiteSpace($cleanOutput)) {
        Write-Host "Warning: No content returned from Gemini." -ForegroundColor Yellow
        continue
    }

    Write-Host "`n$cleanOutput`n" -ForegroundColor White
    Log-Result -targetPath $targetPath -userInput $userInput -cleanOutput $cleanOutput
}
```

---

### Task 2: Verification of Reliability Fixes

**Files:**
- Test: Manual execution of `igt.ps1`

- [ ] **Step 1: Verify `{0}` input fix**

Run: `powershell -File C:\Users\Evertan\.igt\igt.ps1`
Input: `This is a test with {0} and {1}.`
Expected: Gemini responds normally; script **does not crash**.

- [ ] **Step 2: Verify variable expansion protection**

Run: `powershell -File C:\Users\Evertan\.igt\igt.ps1`
Input: `My computer name is $env:COMPUTERNAME.`
Expected: Gemini responds to the literal text `$env:COMPUTERNAME` and does not see the actual system name.

- [ ] **Step 3: Verify Log Recovery (simulated lock)**

1. Open the log file in Notepad (keep it open).
2. Run IGT and process a sentence.
3. If Notepad blocks the write, verify IGT shows the "Log file locked" warning but stays running.
4. Close Notepad.
5. Process another sentence in IGT.
6. Verify the second sentence is logged successfully.
