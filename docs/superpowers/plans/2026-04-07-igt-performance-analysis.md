# IGT Workflow Performance Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instrument `igt.ps1` to measure wall-clock time for startup, Gemini execution, processing, and logging.

**Architecture:** Inject `[System.Diagnostics.Stopwatch]` timers into the existing `igt.ps1` workflow and automate two test cases (Short and Long).

**Tech Stack:** PowerShell, .NET Stopwatch, Gemini CLI.

---

### Task 1: Preparation and Instrumented Script Skeleton

**Files:**
- Modify: `C:\Users\Evertan\.igt\igt.ps1`

- [ ] **Step 1: Backup and overwrite `igt.ps1` with the instrumented version**

```powershell
# IGT Performance Analysis Version
$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$configPath = Join-Path $scriptDir "igt_config.json"

# --- PHASE: STARTUP ---
$startupSw = [System.Diagnostics.Stopwatch]::StartNew()

if (-not (Test-Path $configPath)) {
    Write-Host "Error: igt_config.json not found" -ForegroundColor Red
    exit 1
}
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$model = if ([string]::IsNullOrWhiteSpace($config.Model)) { "gemini-2.5-flash" } else { $config.Model }
$targetPath = $config.ReviewPath
$logWriter = $null

if ($targetPath) {
    try {
        $logWriter = [System.IO.StreamWriter]::new($targetPath, $true, [System.Text.Encoding]::UTF8)
        $logWriter.AutoFlush = $true
    } catch { $targetPath = $null }
}

$noisePattern = [regex]::new('YOLO mode|Loaded cached|Loading extension|Scheduling MCP|Executing MCP|MCP context|Warning:', [System.Text.RegularExpressions.RegexOptions]::Compiled)

$startupSw.Stop()
$startupMs = $startupSw.Elapsed.TotalMilliseconds

# --- TEST HARNESS ---
$testInputs = @(
    @{ Name = "Short"; Text = "Hello, how are you?" },
    @{ Name = "Long";  Text = "The Interactive Grammar Tool (IGT) is a specialized PowerShell utility designed to facilitate rapid linguistic validation and professional text refinement. By leveraging the advanced capabilities of the Gemini large language model, IGT provides users with a seamless interface for auditing grammatical structures, enhancing prose for clarity and conciseness, and generating polished alternatives that maintain the original intent. The system architecture prioritizes performance through optimized environment configurations and surgical output filtering, ensuring that the latency between user input and model response is minimized. Furthermore, IGT incorporates robust error handling and transient logging modes to maintain operational resilience even in environments with restrictive file system permissions or missing configuration files. This tool serves as an essential companion for writers, editors, and technical professionals seeking to elevate the quality of their written communication with high-speed, AI-driven insights." }
)

$results = @()

foreach ($test in $testInputs) {
    Write-Host "Running Test: $($test.Name)..." -ForegroundColor Cyan
    
    $systemPrompt = "Act as an expert Linguistic Validator. Review the input text."
    $promptTemplate = "$systemPrompt`n`nInput Text: {0}"
    $fullPrompt = $promptTemplate -f $test.Text

    # --- PHASE: GEMINI CALL ---
    $geminiSw = [System.Diagnostics.Stopwatch]::StartNew()
    $rawOutput = $fullPrompt | & gemini -p - -m $model --extensions none --approval-mode yolo 2>&1
    $geminiSw.Stop()
    $geminiMs = $geminiSw.Elapsed.TotalMilliseconds

    if ($LASTEXITCODE -ne 0) {
        $results += [PSCustomObject]@{ Input = $test.Name; Status = "FAILED" }
        continue
    }

    # --- PHASE: PROCESSING ---
    $procSw = [System.Diagnostics.Stopwatch]::StartNew()
    $cleanLines = $rawOutput | Where-Object { -not $noisePattern.IsMatch($_.ToString()) }
    $cleanOutput = ($cleanLines -join "`n").Trim()
    $procSw.Stop()
    $procMs = $procSw.Elapsed.TotalMilliseconds

    # --- PHASE: LOGGING ---
    $logMs = 0
    if ($logWriter) {
        $logSw = [System.Diagnostics.Stopwatch]::StartNew()
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $logEntry = "`n---`n### [$timestamp]`n**User Input**: $($test.Text)`n**Gemini Output**:`n$cleanOutput"
        $logWriter.WriteLine($logEntry)
        $logSw.Stop()
        $logMs = $logSw.Elapsed.TotalMilliseconds
    }

    $results += [PSCustomObject]@{
        Input      = $test.Name
        Startup    = "{0:N2}ms" -f $startupMs
        Gemini     = "{0:N2}ms" -f $geminiMs
        Processing = "{0:N2}ms" -f $procMs
        Logging    = "{0:N2}ms" -f $logMs
        Total      = "{0:N2}ms" -f ($geminiMs + $procMs + $logMs)
    }
}

if ($logWriter) { $logWriter.Close() }

Write-Host "`n--- Performance Results ---" -ForegroundColor Yellow
$results | Format-Table -AutoSize
```

- [ ] **Step 2: Run the performance test**

Run: `powershell -File C:\Users\Evertan\.igt\igt.ps1`
Expected: A table showing the timing for "Short" and "Long" inputs.
