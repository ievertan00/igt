# Interactive Grammar Tool (IGT) - v2.3
# Features: animated spinner, color-coded output, input history, multiline mode, vocab builder
$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent

# Ensure console and script output use UTF-8
[System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

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

    $w    = [System.Console]::WindowWidth
    $pLen = $Prompt.Length
    # script-scope so nested script blocks can both read and write it on scroll.
    $script:rlStartRow = [System.Console]::CursorTop

    $buf      = [System.Text.StringBuilder]::new()
    $cur      = 0
    $histIdx  = $script:inputHistory.Count
    $saved    = ""
    # Key queue lets us "unread" a non-printable key encountered mid-paste.
    $keyQueue = [System.Collections.Generic.Queue[System.ConsoleKeyInfo]]::new()

    # Move cursor to buffer position $pos, accounting for line wrapping.
    # After positioning, recalibrates rlStartRow from the actual CursorTop so
    # that any terminal scroll that occurred mid-session is absorbed.
    $GoTo = {
        param([int]$pos)
        $abs       = $pLen + $pos
        $targetRow = $script:rlStartRow + [Math]::Floor($abs / $w)
        $maxRow    = [System.Console]::BufferHeight - 1

        # If target row is beyond bottom, scroll until it fits
        while ($targetRow -gt $maxRow) {
            [System.Console]::SetCursorPosition(0, $maxRow)
            [System.Console]::Write("`n")
            $script:rlStartRow--
            $targetRow--
        }

        $col = $abs % $w
        [System.Console]::SetCursorPosition($col, [Math]::Max(0, $targetRow))
        # Keep rlStartRow in sync with actual cursor (absorbs scroll drift)
        $script:rlStartRow = [System.Console]::CursorTop - [Math]::Floor($abs / $w)
    }

    # Overwrite from buffer position $from to end, then erase $extra stale chars.
    # Writes in WindowWidth-sized chunks and repositions the cursor at the start
    # of each new row using the LIVE CursorTop (not a stored row offset), so
    # wrapping is correct even when BufferWidth > WindowWidth or after scroll.
    $DrawTail = {
        param([int]$from, [int]$extra = 0)
        & $GoTo $from
        $tail   = $buf.ToString().Substring($from) + (' ' * $extra)
        $endCol = ($pLen + $buf.Length + $extra) % $w
        if ($endCol -gt 0) { $tail += ' ' * ($w - $endCol) }

        $abs    = $pLen + $from          # logical column counter (wraps at $w)
        $maxRow = [System.Console]::BufferHeight - 1
        $i      = 0
        while ($i -lt $tail.Length) {
            $colNow   = $abs % $w
            $canWrite = $w - $colNow
            $take     = [Math]::Min($canWrite, $tail.Length - $i)
            [System.Console]::Write($tail.Substring($i, $take))
            $abs += $take
            $i   += $take
            # After filling a row exactly, force cursor to start of next row.
            # Use live CursorTop+1 instead of a stored offset — this handles
            # both BufferWidth==WindowWidth (delayed-wrap) and BufferWidth>WindowWidth.
            if ($take -eq $canWrite -and $i -lt $tail.Length) {
                if ([System.Console]::CursorTop -lt $maxRow) {
                    [System.Console]::SetCursorPosition(0, [System.Console]::CursorTop + 1)
                } else {
                    [System.Console]::Write("`n")
                    $script:rlStartRow--
                }
                $script:rlStartRow = [System.Console]::CursorTop - [Math]::Floor($abs / $w)
            }
        }
    }

    while ($true) {
        # Drain the re-queue first (keys displaced mid-paste), then read console.
        $k = if ($keyQueue.Count -gt 0) { $keyQueue.Dequeue() } else { [System.Console]::ReadKey($true) }

        # Ctrl+C — always clears the current input and returns to the prompt.
        # Use the 'exit' command to quit.
        if ($k.Key -eq [System.ConsoleKey]::C -and ($k.Modifiers -band [System.ConsoleModifiers]::Control)) {
            if ($buf.Length -eq 0) {
                [System.Console]::Write("^C")
                [System.Console]::WriteLine()
                return ""
            }
            $old = $buf.Length
            $buf.Clear() | Out-Null
            $cur = 0
            & $DrawTail 0 $old        # erase typed text
            & $GoTo 0                 # cursor back to start of input area
            [System.Console]::Write("^C")
            [System.Console]::WriteLine()
            return ""
        }

        switch ($k.Key) {
            ([System.ConsoleKey]::Enter) {
                # Move to end so the newline doesn't split a wrapped line visually.
                & $GoTo $buf.Length
                [System.Console]::WriteLine()
                return $buf.ToString()
            }
            ([System.ConsoleKey]::Backspace) {
                if ($cur -gt 0) {
                    $buf.Remove($cur - 1, 1) | Out-Null
                    $cur--
                    & $DrawTail $cur 1
                    & $GoTo $cur
                }
            }
            ([System.ConsoleKey]::Delete) {
                if ($cur -lt $buf.Length) {
                    $buf.Remove($cur, 1) | Out-Null
                    & $DrawTail $cur 1
                    & $GoTo $cur
                }
            }
            ([System.ConsoleKey]::Escape) {
                if ($buf.Length -gt 0) {
                    $old = $buf.Length
                    $buf.Clear() | Out-Null
                    $cur = 0
                    & $DrawTail 0 $old
                    & $GoTo 0
                }
            }
            ([System.ConsoleKey]::LeftArrow)  { if ($cur -gt 0)           { $cur--; & $GoTo $cur } }
            ([System.ConsoleKey]::RightArrow) { if ($cur -lt $buf.Length) { $cur++; & $GoTo $cur } }
            ([System.ConsoleKey]::Home)        { $cur = 0;           & $GoTo 0    }
            ([System.ConsoleKey]::End)         { $cur = $buf.Length; & $GoTo $cur }
            ([System.ConsoleKey]::UpArrow) {
                if ($histIdx -gt 0) {
                    if ($histIdx -eq $script:inputHistory.Count) { $saved = $buf.ToString() }
                    $histIdx--
                    $old = $buf.Length
                    $buf.Clear() | Out-Null; $buf.Append($script:inputHistory[$histIdx]) | Out-Null
                    & $DrawTail 0 ([Math]::Max(0, $old - $buf.Length))
                    $cur = $buf.Length; & $GoTo $cur
                }
            }
            ([System.ConsoleKey]::DownArrow) {
                if ($histIdx -lt $script:inputHistory.Count) {
                    $histIdx++
                    $old     = $buf.Length
                    $newLine = if ($histIdx -eq $script:inputHistory.Count) { $saved } else { $script:inputHistory[$histIdx] }
                    $buf.Clear() | Out-Null; $buf.Append($newLine) | Out-Null
                    & $DrawTail 0 ([Math]::Max(0, $old - $buf.Length))
                    $cur = $buf.Length; & $GoTo $cur
                }
            }
            default {
                if ($k.KeyChar -ne "`0" -and -not [System.Char]::IsControl($k.KeyChar)) {
                    # Batch all immediately available printable chars so a paste
                    # triggers one DrawTail instead of one per character.
                    $chars = [System.Text.StringBuilder]::new()
                    $chars.Append($k.KeyChar) | Out-Null
                    while ([System.Console]::KeyAvailable) {
                        $next = [System.Console]::ReadKey($true)
                        if ($next.KeyChar -ne "`0" -and -not [System.Char]::IsControl($next.KeyChar)) {
                            $chars.Append($next.KeyChar) | Out-Null
                        } elseif ($next.Key -eq [System.ConsoleKey]::Enter) {
                            $chars.Append(' ') | Out-Null  # collapse pasted newlines into spaces
                        } else {
                            $keyQueue.Enqueue($next)   # put non-printable back
                            break
                        }
                    }
                    $text = $chars.ToString()
                    $buf.Insert($cur, $text) | Out-Null
                    $cur += $text.Length
                    & $DrawTail ($cur - $text.Length) 0
                    & $GoTo $cur
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
        $f = @('⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏')
        $i = 0
        while (-not $syncHash.Stop) {
            [System.Console]::Write("`r$($f[$i % $f.Count]) $($syncHash.Message)... ")
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

# ── Word-wrap helper ─────────────────────────────────────────────────────────────
# $Prefix  = chars already printed on the current line (cursor offset)
# $HangIndent = spaces to indent continuation lines
function Write-WrappedLine {
    param([string]$Text, [string]$Color = "White", [int]$HangIndent = 0, [int]$Prefix = 0)
    $maxW  = [Math]::Max(40, [System.Console]::WindowWidth - 1)
    $avail = $maxW - $Prefix   # remaining space on the first line

    $words = $Text -split ' '
    $line  = ""

    foreach ($word in $words) {
        $candidate = if ($line) { "$line $word" } else { $word }
        if ($candidate.Length -gt $avail -and $line -ne "") {
            Write-Host $line -ForegroundColor $Color
            $line  = (" " * $HangIndent) + $word
            $avail = $maxW   # continuation lines get full width
        } else {
            $line = $candidate
        }
    }
    if ($line -ne "") { Write-Host $line -ForegroundColor $Color }
}

# ── Body line sanitizer ──────────────────────────────────────────────────────────
function Sanitize-BodyLine {
    param([string]$line, [string]$section)
    # Strip surrounding brackets or quotes the LLM sometimes wraps sentences in
    if ($line -match '^\[(.+)\]$')  { $line = $Matches[1].Trim() }
    if ($line -match '^"(.+)"$')    { $line = $Matches[1].Trim() }
    if ($line -match "^'(.+)'$")    { $line = $Matches[1].Trim() }
    # Ensure bullet prefix for list sections
    if ($section -in @("diagnosis","rule","tip") -and $line -ne "" -and $line -notmatch '^- ') {
        $line = "- $line"
    }
    return $line
}

# ── Color-coded output renderer ─────────────────────────────────────────────────
function Write-ColoredResponse {
    param([string]$Content)

    # Section header colors
    $headerColor = @{
        review     = "Yellow"
        correction = "Green"
        refine     = "Cyan"
        diagnosis  = "Magenta"
        rule       = "Blue"
        tip        = "DarkCyan"
    }
    # Body text colors (inherit from section)
    $bodyColor = @{
        review     = "Yellow"
        correction = "Green"
        refine     = "Cyan"
        diagnosis  = "Gray"
        rule       = "Blue"
        tip        = "DarkCyan"
    }
    $sectionOrder = @("review","correction","refine","diagnosis","rule","tip")

    $section     = "default"
    $prevSection = "default"

    foreach ($line in ($Content -split "`n")) {
        $newSection = $null
        if    ($line -match '^\*\*Review\*\*')      { $newSection = "review" }
        elseif ($line -match '^\*\*Correction\*\*') { $newSection = "correction" }
        elseif ($line -match '^\*\*Refine\*\*')     { $newSection = "refine" }
        elseif ($line -match '^\*\*Diagnosis\*\*')  { $newSection = "diagnosis" }
        elseif ($line -match '^\*\*Rule\*\*')       { $newSection = "rule" }
        elseif ($line -match '^\*\*Tip\*\*')        { $newSection = "tip" }

        if ($newSection) {
            # Always one blank line before every section except the first
            if ($prevSection -ne "default") { Write-Host "" }
            $section     = $newSection
            $prevSection = $newSection
            # Separate inline content from the header marker
            if ($line -match '^(\*\*\w+\*\*\:?\s*)(.+)$') {
                Write-Host $Matches[1].TrimEnd() -ForegroundColor $headerColor[$section]
                $remainder = $Matches[2].Trim()
                $remainder = Sanitize-BodyLine $remainder $section
                if ($remainder -ne "") {
                    Write-WrappedLine $remainder -Color $bodyColor[$section]
                }
            } else {
                Write-Host $line -ForegroundColor $headerColor[$section]
            }
            continue
        }

        # Drop all blank lines from LLM output — separators are added above
        if ($line.Trim() -eq "") { continue }

        # Body line — single color per section
        $cleanLine = Sanitize-BodyLine $line.Trim() $section
        if ($bodyColor.ContainsKey($section)) {
            Write-WrappedLine $cleanLine -Color $bodyColor[$section]
        } else {
            Write-WrappedLine $cleanLine -Color White
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

    if ($ready) { Write-Host "  ● server  port $serverPort" -ForegroundColor DarkGray; return $true }
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

    $script:lastRequestCancelled = $false

    if (!$script:serverProcess -or $script:serverProcess.HasExited) {
        if (!(Start-IGTServer)) { return $null }
    }

    $body = @{ text = $inputText } | ConvertTo-Json
    $url  = "$serverBaseUrl/grammar"

    # Run the HTTP call in a background runspace so the main thread stays free
    # to watch for Ctrl+C (TreatControlCAsInput=true means no OS signal fires).
    $shared = [hashtable]::Synchronized(@{ Result = $null; Error = $null; Done = $false })

    $rs = [runspacefactory]::CreateRunspace()
    $rs.Open()
    $rs.SessionStateProxy.SetVariable("shared", $shared)
    $rs.SessionStateProxy.SetVariable("body",   $body)
    $rs.SessionStateProxy.SetVariable("url",    $url)

    $ps = [powershell]::Create()
    $ps.Runspace = $rs
    [void]$ps.AddScript({
        try {
            $resp = Invoke-WebRequest -Uri $url -Method POST -Body $body `
                        -ContentType "application/json; charset=utf-8" `
                        -TimeoutSec 60 -UseBasicParsing
            
            # Explicitly decode as UTF-8 to avoid Windows-specific encoding issues
            $rawStream = $resp.RawContentStream
            $rawStream.Position = 0
            $reader = New-Object System.IO.StreamReader($rawStream, [System.Text.Encoding]::UTF8)
            $shared.Result = $reader.ReadToEnd()
        } catch {
            $errMsg = $null
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $errJson = (New-Object System.IO.StreamReader($stream)).ReadToEnd() | ConvertFrom-Json
                    $errMsg  = $errJson.error
                }
            } catch {}
            if (-not $errMsg) { $errMsg = $_.Exception.Message }
            $shared.Error = $errMsg
        } finally {
            $shared.Done = $true
        }
    })
    $ps.BeginInvoke() | Out-Null

    # Poll: yield to spinner; watch for Ctrl+C
    while (-not $shared.Done) {
        if ([Console]::KeyAvailable) {
            $k = [Console]::ReadKey($true)
            if ($k.Key -eq [ConsoleKey]::C -and ($k.Modifiers -band [ConsoleModifiers]::Control)) {
                $script:lastRequestCancelled = $true
                Stop-Spinner
                Write-Host ""
                Write-Host "  Cancelled." -ForegroundColor DarkGray
                try { $ps.Stop()    } catch {}
                try { $ps.Dispose() } catch {}
                try { $rs.Close()   } catch {}
                try { $rs.Dispose() } catch {}
                return $null
            }
        }
        Start-Sleep -Milliseconds 50
    }

    try { $ps.Dispose(); $rs.Close(); $rs.Dispose() } catch {}

    if ($shared.Error) {
        $errMsg = $shared.Error
        if ($errMsg -match "429|quota|rate.?limit|resource.*exhaust|too many request") {
            Write-Host "`n  API limit reached. Wait a moment and try again." -ForegroundColor Yellow
        } else {
            Write-Host "`n  Error: $errMsg" -ForegroundColor Red
        }
        return $null
    }

    return $shared.Result | ConvertFrom-Json
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
    $sep = "─" * [Math]::Min(54, [Math]::Max(30, [System.Console]::WindowWidth - 4))
    Write-Host ""
    Write-Host "  Commands" -ForegroundColor Yellow
    Write-Host "  $sep" -ForegroundColor DarkGray
    Write-Host "  /handbook         " -NoNewline -ForegroundColor Cyan
    Write-Host "Generate your personal error handbook" -ForegroundColor Gray
    Write-Host "  /practice         " -NoNewline -ForegroundColor Cyan
    Write-Host "Targeted grammar exercises (CEFR-aware)" -ForegroundColor Gray
    Write-Host "  /practice B2 10   " -NoNewline -ForegroundColor Cyan
    Write-Host "Shorthand for --level=B2 --count=10" -ForegroundColor Gray
    Write-Host "  /assess           " -NoNewline -ForegroundColor Cyan
    Write-Host "Estimate your CEFR proficiency level" -ForegroundColor Gray
    Write-Host "  /add <word>       " -NoNewline -ForegroundColor Cyan
    Write-Host "Add a word to your Obsidian vocabulary note" -ForegroundColor Gray
    Write-Host "  /vocab            " -NoNewline -ForegroundColor Cyan
    Write-Host "Review saved vocabulary (quiz or list)" -ForegroundColor Gray
    Write-Host "  /gemini           " -NoNewline -ForegroundColor Cyan
    Write-Host "Switch to Gemini model" -ForegroundColor Gray
    Write-Host "  /qwen             " -NoNewline -ForegroundColor Cyan
    Write-Host "Switch to Qwen model" -ForegroundColor Gray
    Write-Host "  /deepseek         " -NoNewline -ForegroundColor Cyan
    Write-Host "Switch to Deepseek model" -ForegroundColor Gray
    Write-Host '  """               ' -NoNewline -ForegroundColor Cyan
    Write-Host "Enter multiline input mode" -ForegroundColor Gray
    Write-Host "  exit              " -NoNewline -ForegroundColor Cyan
    Write-Host "Quit IGT" -ForegroundColor Gray
    Write-Host ""
}

$currentModel = Get-CurrentModelName
Show-Header -Model $currentModel

# ── Main loop ─────────────────────────────────────────────────────────────────────
while ($true) {
    $userInput = Read-LineWithHistory -Prompt " $currentModel ❯ "

    if ($userInput -eq "exit" -or $userInput -eq "quit") {
        Stop-IGTServer
        break
    }
    if ([string]::IsNullOrWhiteSpace($userInput)) { continue }

    # Multiline mode
    if ($userInput -eq '"""') {
        Write-Host '  multiline  ·  """ on its own line to submit' -ForegroundColor DarkGray
        $lines = [System.Collections.Generic.List[string]]::new()
        while ($true) {
            $line = Read-LineWithHistory -Prompt "  ❯ "
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

        } elseif ($cmd -eq "add") {
            if ($cmdArgs -eq "") {
                Write-Host ""
                Write-Host "  Usage: /add <word or phrase>" -ForegroundColor Yellow
                Write-Host ""
            } else {
                node (Join-Path $scriptDir "tools\igt-add.mjs") $cmdArgs
            }

        } elseif ($cmd -eq "vocab") {
            Write-Host ""
            $nodeArgs = if ($cmdArgs -ne "") { $cmdArgs -split '\s+' } else { @() }
            node (Join-Path $scriptDir "tools\igt-vocab.mjs") @nodeArgs
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

    if ($script:lastRequestCancelled) { continue }

    if (!$response) {
        Write-Host "Error: Failed to get response" -ForegroundColor Red
        continue
    }

    Write-Host ""
    Write-Host "  Input  " -NoNewline -ForegroundColor DarkGray
    Write-WrappedLine $userInput -Color White -HangIndent 10 -Prefix 9
    Write-Host ("  " + ("─" * [Math]::Min(44, [Math]::Max(20, [System.Console]::WindowWidth - 4)))) -ForegroundColor DarkGray
    Write-ColoredResponse $response.content
    Write-Host ""

    if ($response.perf) {
        Write-Host "  $($response.perf.llm_ms.ToString('N0'))ms llm  ·  $($response.perf.total_ms.ToString('N0'))ms total" -ForegroundColor DarkGray
    }

    # Add to history (skip consecutive duplicates)
    if ($script:inputHistory.Count -eq 0 -or $script:inputHistory[$script:inputHistory.Count - 1] -ne $userInput) {
        $script:inputHistory.Add($userInput)
    }

    Log-Result -targetPath $targetPath -userInput $userInput -cleanOutput $response.content
}
