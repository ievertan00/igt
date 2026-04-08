# IGT Profiler
$scriptDir = $PSScriptRoot
$configPath = Join-Path $scriptDir "igt_config.json"

# 1. Load Config & Prompt (Track Performance)
$sw_step = [System.Diagnostics.Stopwatch]::StartNew()
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$model = if ([string]::IsNullOrWhiteSpace($config.Model)) { "gemini-2.5-flash" } else { $config.Model }
$targetPath = $config.ReviewPath

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
        } catch { }
    }
}
$time_config_prompt = $sw_step.Elapsed.TotalMilliseconds

$userInput = "This is a simple sentence to test the performance of the interactive grammar tool."
$noisePattern = [regex]::new('YOLO mode|Loaded cached|Loading extension|Scheduling MCP|Executing MCP|MCP context|Warning:', [System.Text.RegularExpressions.RegexOptions]::Compiled)

$sw = [System.Diagnostics.Stopwatch]::StartNew()

# 2. Prompt Construction
$sw_step.Restart()
$fullPrompt = "$systemPrompt`n`nInput Text: $userInput"
$time_prompt = $sw_step.Elapsed.TotalMilliseconds

# 3. Gemini CLI Call (The likely bottleneck)
$sw_step.Restart()
$rawOutput = $fullPrompt | & gemini -p - -m $model --extensions none --approval-mode yolo 2>&1
$time_gemini = $sw_step.Elapsed.TotalMilliseconds

# 4. Regex Filtering
$sw_step.Restart()
$cleanLines = $rawOutput | Where-Object { -not $noisePattern.IsMatch($_.ToString()) }
$cleanOutput = ($cleanLines -join "`n").Trim()
$time_filter = $sw_step.Elapsed.TotalMilliseconds

# 5. Logging (StreamWriter simulation)
$sw_step.Restart()
if ($targetPath -and (Test-Path (Split-Path $targetPath -Parent))) {
    $logWriter = [System.IO.StreamWriter]::new($targetPath, $true, [System.Text.Encoding]::UTF8)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "`n---`n### [$timestamp]`n**User Input**: $userInput`n**Gemini Output**:`n$cleanOutput"
    $logWriter.WriteLine($logEntry)
    $logWriter.Close()
}
$time_log = $sw_step.Elapsed.TotalMilliseconds

$total_time = $sw.Elapsed.TotalMilliseconds + $time_config_prompt

Write-Host "`n--- IGT Workflow Performance Analysis ---" -ForegroundColor Yellow
Write-Host ("{0,-30} : {1,10:F2} ms" -f "Config & Prompt Loading", $time_config_prompt)
Write-Host ("{0,-30} : {1,10:F2} ms" -f "Prompt Construction", $time_prompt)
Write-Host ("{0,-30} : {1,10:F2} ms" -f "Gemini CLI Execution", $time_gemini) -ForegroundColor Cyan
Write-Host ("{0,-30} : {1,10:F2} ms" -f "Regex Filtering", $time_filter)
Write-Host ("{0,-30} : {1,10:F2} ms" -f "Logging (I/O)", $time_log)
Write-Host ("-" * 45)
Write-Host ("{0,-30} : {1,10:F2} ms" -f "Total Processing Time", $total_time) -ForegroundColor Yellow

$bottleneck = "Gemini CLI Execution"
$percent = ($time_gemini / $total_time) * 100
Write-Host "`nPrimary Bottleneck: $bottleneck ({0:F1}%)" -ForegroundColor Red
