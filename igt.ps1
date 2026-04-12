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

# 2. Optimized System Prompt (Load with Fallback)
$defaultPrompt = @"
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

$systemPrompt = $defaultPrompt
if (-not [string]::IsNullOrWhiteSpace($config.SystemPromptPath)) {
    $fullPromptPath = if ([System.IO.Path]::IsPathRooted($config.SystemPromptPath)) { $config.SystemPromptPath } else { Join-Path $scriptDir $config.SystemPromptPath }
    if (Test-Path $fullPromptPath) {
        try {
            $systemPrompt = Get-Content -Path $fullPromptPath -Raw -ErrorAction Stop
            Write-Host "[Loaded system prompt from: $($config.SystemPromptPath)]" -ForegroundColor DarkGray
        } catch {
            Write-Host "Warning: Could not read system prompt file. Using default." -ForegroundColor Yellow
        }
    }
}

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

Write-Host "--- Interactive Grammar Tool (IGT) Started [Learning Mode] ---" -ForegroundColor Yellow
Write-Host "Logging to: $targetPath" -ForegroundColor Gray
Write-Host "Type 'exit' to quit." -ForegroundColor Gray
Write-Host "Type 'cards' to export Anki flashcards." -ForegroundColor DarkGray
Write-Host "Type 'handbook' to generate personal error handbook." -ForegroundColor DarkGray
Write-Host "Type 'practice' to start practice exercises." -ForegroundColor DarkGray
Write-Host "Type 'assess' to view proficiency assessment." -ForegroundColor DarkGray
Write-Host "Type 'llm' to manage LLM providers (switch, status, setup).`n" -ForegroundColor DarkCyan

$noisePattern = [regex]::new('YOLO mode|Loaded cached|Loading extension|Scheduling MCP|Executing MCP|MCP context|Warning:', [System.Text.RegularExpressions.RegexOptions]::Compiled)

while ($true) {
    Write-Host -NoNewline "Grammar Input > " -ForegroundColor Cyan
    $userInput = Read-Host

    if ($userInput -eq "exit" -or $userInput -eq "quit") { break }
    if ([string]::IsNullOrWhiteSpace($userInput)) { continue }

    # Handle special commands
    if ($userInput -eq "cards") {
        Write-Host "`n[Exporting Anki cards...]" -ForegroundColor Yellow
        node (Join-Path $scriptDir "tools\igt-cards.mjs")
        Write-Host ""
        continue
    }
    if ($userInput -eq "handbook") {
        Write-Host "`n[Generating personal error handbook...]" -ForegroundColor Yellow
        node (Join-Path $scriptDir "tools\igt-handbook.mjs")
        Write-Host ""
        continue
    }
    if ($userInput -eq "practice") {
        Write-Host "`n[Starting practice mode...]" -ForegroundColor Yellow
        node (Join-Path $scriptDir "tools\igt-practice.mjs")
        Write-Host ""
        continue
    }
    if ($userInput -eq "assess") {
        Write-Host "`n[Generating proficiency assessment...]" -ForegroundColor Yellow
        node (Join-Path $scriptDir "tools\igt-assess.mjs")
        Write-Host ""
        continue
    }
    if ($userInput -eq "llm" -or $userInput.StartsWith("llm ")) {
        Write-Host "" -ForegroundColor DarkCyan
        $llmScript = Join-Path $scriptDir "lib\llm-switch.mjs"
        if ($userInput -eq "llm") {
            node $llmScript
        } else {
            $llmArgs = $userInput.Substring(4).Trim()
            node $llmScript $llmArgs.Split(' ')
        }
        Write-Host ""
        continue
    }

    Write-Host -NoNewline "Processing..." -ForegroundColor Gray
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    
    # Use Node.js bridge for high-speed API access
    $bridgePath = Join-Path $scriptDir "lib\igt-bridge.mjs"
    $rawOutput = $userInput | node $bridgePath 2>&1
    $sw.Stop()

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nError: Bridge failed (Exit Code $LASTEXITCODE)" -ForegroundColor Red
        $rawOutput | ForEach-Object { Write-Host $_ -ForegroundColor DarkRed }
        continue
    }

    $cleanOutput = if ($rawOutput -is [array]) { $rawOutput -join "`n" } else { $rawOutput }

    Write-Host " Done ($($sw.Elapsed.TotalMilliseconds.ToString("N0"))ms)" -ForegroundColor Gray

    if ([string]::IsNullOrWhiteSpace($cleanOutput)) {
        Write-Host "Warning: No content returned from Gemini." -ForegroundColor Yellow
        continue
    }

    Write-Host "`n$cleanOutput`n" -ForegroundColor White
    Log-Result -targetPath $targetPath -userInput $userInput -cleanOutput $cleanOutput
}
