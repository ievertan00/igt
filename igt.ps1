# Interactive Grammar Tool (IGT) - v2.3
# Features: animated spinner, color-coded output, input history, multiline mode, vocab builder
$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$configPath = Join-Path $scriptDir "lib\igt_config.json"

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
function Get-CurrentProvider {
    try {
        $llmScript = Join-Path $scriptDir "lib\llm-switch.mjs"
        $output    = node $llmScript current 2>&1 | Out-String
        if ($output -match "Current LLM Provider:\s*(\w+)") { return $matches[1].ToLower() }
    } catch {}
    return $config.LLMProvider
}

function Get-CurrentModelName {
    $provider = Get-CurrentProvider
    $map = @{ gemini = $config.GeminiFlashModel; qwen = $config.QwenFlashModel; deepseek = $config.DeepseekFlashModel }
    return $map[$provider]
}

function Switch-LLMProvider {
    param([string]$providerName)
    $llmScript = Join-Path $scriptDir "lib\llm-switch.mjs"
    node $llmScript switch $providerName
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

# ── Compact header ────────────────────────────────────────────────────────────────
$currentModel = Get-CurrentModelName
Write-Host ""
Write-Host "  IGT  |  $currentModel" -ForegroundColor Yellow
Write-Host '  handbook  practice  assess  vocab  /qwen  /gemini  /deepseek  exit  (""" = multiline)' -ForegroundColor DarkGray
Write-Host ""

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

    # LLM switching
    if ($userInput -match '^/(qwen|gemini|deepseek)$') {
        Switch-LLMProvider $Matches[1]
        $currentModel = Get-CurrentModelName
        Write-Host "  Switched to $currentModel" -ForegroundColor DarkGray
        continue
    }

    # Named commands — use $handled flag (switch continue goes to next case, not while)
    $handled = $false

    if ($userInput -eq "handbook") {
        Write-Host ""
        node (Join-Path $scriptDir "tools\igt-handbook.mjs")
        Write-Host ""; $handled = $true
    } elseif ($userInput -eq "practice") {
        Write-Host ""
        node (Join-Path $scriptDir "tools\igt-practice.mjs")
        Write-Host ""; $handled = $true
    } elseif ($userInput -eq "assess") {
        Write-Host ""
        node (Join-Path $scriptDir "tools\igt-assess.mjs")
        Write-Host ""; $handled = $true
    } elseif ($userInput -eq "vocab") {
        Write-Host ""
        node (Join-Path $scriptDir "tools\igt-vocab.mjs")
        Write-Host ""; $handled = $true
    } elseif ($userInput -eq "vocab --list") {
        Write-Host ""
        node (Join-Path $scriptDir "tools\igt-vocab.mjs") "--list"
        Write-Host ""; $handled = $true
    } elseif ($userInput -eq "llm" -or $userInput.StartsWith("llm ")) {
        $llmScript = Join-Path $scriptDir "lib\llm-switch.mjs"
        if ($userInput -eq "llm") { node $llmScript }
        else { node $llmScript $userInput.Substring(4).Trim().Split(' ') }
        $currentModel = Get-CurrentModelName
        Write-Host ""; $handled = $true
    }

    if ($handled) { continue }

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
