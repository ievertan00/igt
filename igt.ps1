# Interactive Grammar Tool (IGT) - v2.3
# Features: animated spinner, color-coded output, input history, multiline mode, vocab builder
$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$configPath = Join-Path $scriptDir "lib\igt_config.json"

# Intercept Ctrl+C as a keypress so CMD.exe never sees the signal.
# Without this, cmd.exe shows "Terminate batch job (Y/N)?" on every exit.
[System.Console]::TreatControlCAsInput = $true

if (-not (Test-Path $configPath)) {
    Write-Host "Error: igt_config.json not found in $scriptDir\lib" -ForegroundColor Red
    exit 1
}
$config = Get-Content $configPath -Raw | ConvertFrom-Json

$envPath = Join-Path $scriptDir ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | Where-Object { $_ -match '^([^=]+)=(.*)$' } | ForEach-Object {
        $key = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        if (($value.StartsWith("'") -and $value.EndsWith("'")) -or ($value.StartsWith('"') -and $value.EndsWith('"'))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        Set-Content -Path "Env:$key" -Value $value
    }
}

$targetPath = if ($env:IGT_REVIEW_PATH) { $env:IGT_REVIEW_PATH } else { $config.ReviewPath }

$env:GEMINI_SYSTEM_MD = "false"
$env:GEMINI_TELEMETRY_ENABLED = "false"
$env:NO_COLOR = "1"

$serverPort = 18964
$serverHost = "127.0.0.1"
$serverBaseUrl = "http://$serverHost`:$serverPort"
$serverProcess = $null

# ── Input History ──────────────────────────────────────────────────────────────
$script:inputHistory = [System.Collections.Generic.List[string]]::new()

function Read-LineWithHistory {
    param([string]$Prompt)

    Write-Host -NoNewline $Prompt -ForegroundColor Cyan
    $promptLen = $Prompt.Length
    $maxCol    = [System.Console]::WindowWidth - 1

    $buf     = [System.Text.StringBuilder]::new()
    $cur     = 0
    $histIdx = $script:inputHistory.Count
    $saved   = ""

    function Set-Col([int]$col) {
        $safe = [Math]::Max(0, [Math]::Min($col, $maxCol))
        [System.Console]::CursorLeft = $safe
    }

    function Redraw([string]$newLine) {
        $old = $buf.ToString()
        $buf.Clear() | Out-Null
        $buf.Append($newLine) | Out-Null
        Set-Col $promptLen
        $pad = " " * [Math]::Max(0, $old.Length - $newLine.Length)
        Write-Host -NoNewline ($newLine + $pad)
        Set-Col ($promptLen + $newLine.Length)
    }

    while ($true) {
        $k = [System.Console]::ReadKey($true)

        # Ctrl+C — clean exit
        if ($k.Key -eq [System.ConsoleKey]::C -and ($k.Modifiers -band [System.ConsoleModifiers]::Control)) {
            Write-Host ""
            Stop-IGTServer
            Stop-Spinner
            exit 0
        }

        switch ($k.Key) {
            ([System.ConsoleKey]::Enter) {
                Write-Host ""
                return $buf.ToString()
            }
            ([System.ConsoleKey]::Backspace) {
                if ($cur -gt 0) {
                    $buf.Remove($cur - 1, 1) | Out-Null
                    $cur--
                    $rest = $buf.ToString().Substring($cur)
                    Set-Col ($promptLen + $cur)
                    Write-Host -NoNewline ($rest + " ")
                    Set-Col ($promptLen + $cur)
                }
            }
            ([System.ConsoleKey]::Delete) {
                if ($cur -lt $buf.Length) {
                    $buf.Remove($cur, 1) | Out-Null
                    $rest = $buf.ToString().Substring($cur)
                    Set-Col ($promptLen + $cur)
                    Write-Host -NoNewline ($rest + " ")
                    Set-Col ($promptLen + $cur)
                }
            }
            ([System.ConsoleKey]::LeftArrow) {
                if ($cur -gt 0) { $cur--; Set-Col ($promptLen + $cur) }
            }
            ([System.ConsoleKey]::RightArrow) {
                if ($cur -lt $buf.Length) { $cur++; Set-Col ($promptLen + $cur) }
            }
            ([System.ConsoleKey]::Home) {
                $cur = 0; Set-Col $promptLen
            }
            ([System.ConsoleKey]::End) {
                $cur = $buf.Length; Set-Col ($promptLen + $cur)
            }
            ([System.ConsoleKey]::UpArrow) {
                if ($histIdx -gt 0) {
                    if ($histIdx -eq $script:inputHistory.Count) { $saved = $buf.ToString() }
                    $histIdx--
                    Redraw $script:inputHistory[$histIdx]
                    $cur = $buf.Length
                }
            }
            ([System.ConsoleKey]::DownArrow) {
                if ($histIdx -lt $script:inputHistory.Count) {
                    $histIdx++
                    $line = if ($histIdx -eq $script:inputHistory.Count) { $saved } else { $script:inputHistory[$histIdx] }
                    Redraw $line
                    $cur = $buf.Length
                }
            }
            default {
                if ($k.KeyChar -ne "`0" -and -not [System.Char]::IsControl($k.KeyChar)) {
                    $buf.Insert($cur, $k.KeyChar) | Out-Null
                    $cur++
                    Set-Col ($promptLen + $cur - 1)
                    Write-Host -NoNewline $buf.ToString().Substring($cur - 1)
                    Set-Col ($promptLen + $cur)
                }
            }
        }
    }
}

# ── Spinner ─────────────────────────────────────────────────────────────────────
$script:spinnerSync = $null
$script:spinnerPS   = $null
$script:spinnerRS   = $null

function Start-Spinner {
    param([string]$Message = "Thinking")

    $syncHash = [hashtable]::Synchronized(@{ Stop = $false; Message = $Message })
    $script:spinnerSync = $syncHash

    $rs = [runspacefactory]::CreateRunspace()
    $rs.ApartmentState = [System.Threading.ApartmentState]::STA
    $rs.Open()
    $rs.SessionStateProxy.SetVariable("syncHash", $syncHash)

    $ps = [powershell]::Create()
    $ps.Runspace = $rs
    [void]$ps.AddScript({
        $f = @('-', '\', '|', '/')
        $i = 0
        while (-not $syncHash.Stop) {
            [System.Console]::Write("`r$($f[$i % 4]) $($syncHash.Message)... ")
            Start-Sleep -Milliseconds 100
            $i++
        }
        [System.Console]::Write("`r" + (" " * ($syncHash.Message.Length + 10)) + "`r")
    })

    $script:spinnerPS    = $ps
    $script:spinnerRS    = $rs
    $script:spinnerAsync = $ps.BeginInvoke()
}

function Stop-Spinner {
    if ($script:spinnerSync) {
        $script:spinnerSync.Stop = $true
        Start-Sleep -Milliseconds 200
        try {
            $script:spinnerPS.EndInvoke($script:spinnerAsync) | Out-Null
            $script:spinnerPS.Dispose()
            $script:spinnerRS.Close()
            $script:spinnerRS.Dispose()
        } catch {}
        $script:spinnerSync = $null
    }
}

# ── Color-coded output renderer ─────────────────────────────────────────────────
function Write-ColoredResponse {
    param([string]$Content)

    $section = "default"
    foreach ($line in ($Content -split "`n")) {
        if     ($line -match '^\*\*Review\*\*')    { $section = "review";     Write-Host $line -ForegroundColor Yellow }
        elseif ($line -match '^\*\*Correction\*\*') { $section = "correction"; Write-Host $line -ForegroundColor Green }
        elseif ($line -match '^\*\*Refine\*\*')     { $section = "refine";     Write-Host $line -ForegroundColor Cyan }
        elseif ($line -match '^\*\*Diagnosis\*\*')  { $section = "diagnosis";  Write-Host $line -ForegroundColor DarkGray }
        elseif ($line -match '^\*\*Rule\*\*')       { $section = "rule";       Write-Host $line -ForegroundColor DarkGray }
        elseif ($line -match '^\*\*Tip\*\*')        { $section = "tip";        Write-Host $line -ForegroundColor DarkGray }
        elseif ($section -eq "diagnosis" -and $line -match '\(Major\)')    { Write-Host $line -ForegroundColor Red }
        elseif ($section -eq "diagnosis" -and $line -match '\(Moderate\)') { Write-Host $line -ForegroundColor Yellow }
        elseif ($section -eq "diagnosis" -and $line -match '\(Minor\)')    { Write-Host $line -ForegroundColor DarkYellow }
        else {
            switch ($section) {
                "review"     { Write-Host $line -ForegroundColor Yellow }
                "correction" { Write-Host $line -ForegroundColor Green }
                "refine"     { Write-Host $line -ForegroundColor Cyan }
                "rule"       { Write-Host $line -ForegroundColor DarkGray }
                "tip"        { Write-Host $line -ForegroundColor DarkGray }
                "diagnosis"  { Write-Host $line -ForegroundColor DarkGray }
                default      { Write-Host $line -ForegroundColor White }
            }
        }
    }
}

# ── Logging ──────────────────────────────────────────────────────────────────────
function Log-Result {
    param([string]$targetPath, [string]$userInput, [string]$cleanOutput)
    if (-not $targetPath) { return }

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry  = "`n---`n### [$timestamp]`n**User Input**: $userInput`n**Output**:`n$cleanOutput"

    $retryCount = 0
    $success    = $false
    while (-not $success -and $retryCount -le 2) {
        try {
            Add-Content -Path $targetPath -Value $logEntry -Encoding utf8 -ErrorAction Stop
            $success = $true
        } catch {
            $retryCount++
            if ($retryCount -le 2) { Start-Sleep -Milliseconds 100 }
            else { Write-Host "Warning: Could not log entry. File locked." -ForegroundColor Yellow }
        }
    }
}

# ── Server ───────────────────────────────────────────────────────────────────────
function Start-IGTServer {
    $serverPath = Join-Path $scriptDir "lib\igt-http-server.mjs"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName    = "node"
    $psi.Arguments   = $serverPath
    $psi.UseShellExecute        = $false
    $psi.RedirectStandardError  = $true
    $psi.StandardErrorEncoding  = [System.Text.Encoding]::UTF8
    $psi.CreateNoWindow         = $true
    $psi.EnvironmentVariables["IGT_SERVER_PORT"] = $serverPort
    $psi.EnvironmentVariables["IGT_SERVER_HOST"] = $serverHost

    $script:serverProcess = New-Object System.Diagnostics.Process
    $script:serverProcess.StartInfo         = $psi
    $script:serverProcess.EnableRaisingEvents = $true
    $script:serverProcess.Start() | Out-Null

    $timeout = [DateTime]::Now.AddSeconds(8)
    $ready   = $false
    while ([DateTime]::Now -lt $timeout) {
        if ($script:serverProcess.HasExited) {
            Write-Host "Error: Server failed to start" -ForegroundColor Red
            return $false
        }
        try {
            $r = Invoke-WebRequest -Uri "$serverBaseUrl/health" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
            if ($r.StatusCode -eq 200) { $ready = $true; break }
        } catch {}
        Start-Sleep -Milliseconds 100
    }

    if ($ready) { Write-Host "[Server] Started (port $serverPort)" -ForegroundColor DarkGray; return $true }
    Write-Host "Error: Server startup timeout" -ForegroundColor Red
    return $false
}

function Stop-IGTServer {
    if ($script:serverProcess -and !$script:serverProcess.HasExited) {
        $script:serverProcess.Kill()
        Start-Sleep -Milliseconds 50
        $script:serverProcess.Dispose()
    }
}

# ── LLM Provider ─────────────────────────────────────────────────────────────────
$script:modelMap = @{
    gemini   = $config.GeminiFlashModel
    qwen     = $config.QwenFlashModel
    deepseek = $config.DeepseekFlashModel
}

function Get-CurrentModelName {
    # Read from env var (set by .env loader) or re-read config file — no Node spawn.
    $provider = if ($env:IGT_LLM_PROVIDER) {
        $env:IGT_LLM_PROVIDER.ToLower()
    } else {
        try { (Get-Content $configPath -Raw | ConvertFrom-Json).LLMProvider.ToLower() }
        catch { $config.LLMProvider.ToLower() }
    }
    $name = $script:modelMap[$provider]
    if ($name) { return $name } else { return $provider }
}

function Switch-LLMProvider {
    param([string]$providerName)
    $llmScript = Join-Path $scriptDir "lib\llm-switch.mjs"
    node $llmScript switch $providerName
    # Persist new provider into env so Get-CurrentModelName picks it up without re-reading the file.
    $env:IGT_LLM_PROVIDER = $providerName
}

function Invoke-GrammarCheck {
    param([string]$inputText)
    if (!$script:serverProcess -or $script:serverProcess.HasExited) {
        if (!(Start-IGTServer)) { return $null }
    }
    try {
        $body     = @{ text = $inputText } | ConvertTo-Json
        $response = Invoke-WebRequest -Uri "$serverBaseUrl/grammar" -Method POST -Body $body -ContentType "application/json; charset=utf-8" -TimeoutSec 60 -UseBasicParsing
        return $response.Content | ConvertFrom-Json
    } catch {
        Write-Host "`nError: Request failed - $_" -ForegroundColor Red
        return $null
    }
}

# ── Header ───────────────────────────────────────────────────────────────────────
function Show-Header {
    param([string]$Model)
    Write-Host ""
    Write-Host "  IGT  Interactive Grammar Tool" -ForegroundColor Yellow
    Write-Host "  ──────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  Model  " -NoNewline -ForegroundColor DarkGray
    Write-Host $Model -ForegroundColor Cyan
    Write-Host '  Usage  type text to check · /help for commands · """ for multiline' -ForegroundColor DarkGray
    Write-Host ""
}

function Show-Help {
    Write-Host ""
    Write-Host "  Commands" -ForegroundColor Yellow
    Write-Host "  ──────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host "  /handbook         " -NoNewline -ForegroundColor Cyan
    Write-Host "Generate your personal error handbook" -ForegroundColor White
    Write-Host "  /practice         " -NoNewline -ForegroundColor Cyan
    Write-Host "Targeted grammar exercises (CEFR-aware)" -ForegroundColor White
    Write-Host "  /practice B2 10   " -NoNewline -ForegroundColor Cyan
    Write-Host "Shorthand for --level=B2 --count=10" -ForegroundColor DarkGray
    Write-Host "  /assess           " -NoNewline -ForegroundColor Cyan
    Write-Host "Estimate your CEFR proficiency level" -ForegroundColor White
    Write-Host "  /vocab            " -NoNewline -ForegroundColor Cyan
    Write-Host "Quiz yourself on saved word choices" -ForegroundColor White
    Write-Host "  /vocab list       " -NoNewline -ForegroundColor Cyan
    Write-Host "Browse all saved vocabulary items" -ForegroundColor White
    Write-Host "  /gemini           " -NoNewline -ForegroundColor Cyan
    Write-Host "Switch to Gemini model" -ForegroundColor White
    Write-Host "  /qwen             " -NoNewline -ForegroundColor Cyan
    Write-Host "Switch to Qwen model" -ForegroundColor White
    Write-Host "  /deepseek         " -NoNewline -ForegroundColor Cyan
    Write-Host "Switch to Deepseek model" -ForegroundColor White
    Write-Host '  """               ' -NoNewline -ForegroundColor Cyan
    Write-Host "Enter multiline input mode" -ForegroundColor White
    Write-Host "  exit              " -NoNewline -ForegroundColor Cyan
    Write-Host "Quit IGT" -ForegroundColor White
    Write-Host ""
}

$currentModel = Get-CurrentModelName
Show-Header -Model $currentModel

# ── Main loop ─────────────────────────────────────────────────────────────────────
while ($true) {
    $userInput = Read-LineWithHistory -Prompt "[$currentModel] > "

    if ($userInput -eq "exit" -or $userInput -eq "quit") {
        Stop-IGTServer
        break
    }
    if ([string]::IsNullOrWhiteSpace($userInput)) { continue }

    # Multiline mode
    if ($userInput -eq '"""') {
        Write-Host '  [Multiline — type """ on its own line to submit]' -ForegroundColor DarkGray
        $lines = [System.Collections.Generic.List[string]]::new()
        while ($true) {
            $line = Read-LineWithHistory -Prompt "  > "
            if ($line -eq '"""') { break }
            $lines.Add($line)
        }
        $userInput = ($lines | Where-Object { $null -ne $_ }) -join "`n"
        if ([string]::IsNullOrWhiteSpace($userInput)) { continue }
    }

    # All commands start with /
    if ($userInput.StartsWith("/")) {
        $parts   = $userInput.TrimStart('/').Trim() -split '\s+', 2
        $cmd     = $parts[0].ToLower()
        $cmdArgs = if ($parts.Count -gt 1) { $parts[1] } else { "" }

        if ($cmd -eq "help") {
            Show-Help

        } elseif ($cmd -eq "handbook") {
            Write-Host ""
            node (Join-Path $scriptDir "tools\igt-handbook.mjs")
            Write-Host ""

        } elseif ($cmd -eq "practice") {
            Write-Host ""
            # Shorthand: /practice B2 10  →  --level=B2 --count=10
            $nodeArgs = @()
            if ($cmdArgs -match '^([A-Ca-c][12])\s+(\d+)$') {
                $nodeArgs = @("--level=$($Matches[1].ToUpper())", "--count=$($Matches[2])")
            } elseif ($cmdArgs -ne "") {
                $nodeArgs = $cmdArgs -split '\s+'
            }
            node (Join-Path $scriptDir "tools\igt-practice.mjs") @nodeArgs
            Write-Host ""

        } elseif ($cmd -eq "assess") {
            Write-Host ""
            node (Join-Path $scriptDir "tools\igt-assess.mjs")
            Write-Host ""

        } elseif ($cmd -eq "vocab") {
            Write-Host ""
            if ($cmdArgs -eq "list") {
                node (Join-Path $scriptDir "tools\igt-vocab.mjs") "--list"
            } else {
                node (Join-Path $scriptDir "tools\igt-vocab.mjs")
            }
            Write-Host ""

        } elseif ($cmd -in @("gemini", "qwen", "deepseek")) {
            Switch-LLMProvider $cmd
            $currentModel = $script:modelMap[$cmd]
            Write-Host "  Switched to $currentModel" -ForegroundColor DarkGray

        } elseif ($cmd -eq "llm") {
            $llmScript = Join-Path $scriptDir "lib\llm-switch.mjs"
            if ($cmdArgs -eq "") { node $llmScript }
            else { node $llmScript $cmdArgs.Split(' ') }
            $currentModel = Get-CurrentModelName
            Write-Host ""

        } elseif ($cmd -eq "exit" -or $cmd -eq "quit") {
            Stop-IGTServer; break

        } else {
            Write-Host "  Unknown command /$cmd — type /help for a list." -ForegroundColor Yellow
        }
        continue
    }

    # Grammar check
    Start-Spinner -Message "Thinking"
    $response = Invoke-GrammarCheck -inputText $userInput
    Stop-Spinner

    if (!$response) {
        Write-Host "Error: Failed to get response" -ForegroundColor Red
        continue
    }

    Write-Host ""
    Write-ColoredResponse $response.content
    Write-Host ""

    if ($response.perf) {
        Write-Host "  [LLM: $($response.perf.llm_ms.ToString('N0'))ms | Total: $($response.perf.total_ms.ToString('N0'))ms]" -ForegroundColor DarkGray
    }

    # Add to history (skip consecutive duplicates)
    if ($script:inputHistory.Count -eq 0 -or $script:inputHistory[$script:inputHistory.Count - 1] -ne $userInput) {
        $script:inputHistory.Add($userInput)
    }

    Log-Result -targetPath $targetPath -userInput $userInput -cleanOutput $response.content
}
