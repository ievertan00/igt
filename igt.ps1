# Interactive Grammar Tool (IGT) - Reliability v2.2
# Optimized: HTTP resident server + Qwen default + JSON-to-text rendering
$scriptDir = Split-Path $MyInvocation.MyCommand.Path -Parent
$configPath = Join-Path $scriptDir "lib\igt_config.json"

# 1. Load Config Once
if (-not (Test-Path $configPath)) {
    Write-Host "Error: igt_config.json not found in $scriptDir\lib" -ForegroundColor Red
    exit 1
}
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$targetPath = $config.ReviewPath

# 2. Optimization Environment Variables
$env:GEMINI_SYSTEM_MD = "false"
$env:GEMINI_TELEMETRY_ENABLED = "false"
$env:NO_COLOR = "1"

# 3. Server configuration
$serverPort = 18964
$serverHost = "127.0.0.1"
$serverBaseUrl = "http://$serverHost`:$serverPort"
$serverProcess = $null

# 4. Helper Function: Surgical Logging
function Log-Result {
    param([string]$targetPath, [string]$userInput, [string]$cleanOutput)
    if (-not $targetPath) { return }

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "`n---`n### [$timestamp]`n**User Input**: $userInput`n**Output**:`n$cleanOutput"

    $maxRetries = 2
    $retryCount = 0
    $success = $false

    while (-not $success -and $retryCount -le $maxRetries) {
        try {
            Add-Content -Path $targetPath -Value $logEntry -Encoding utf8 -ErrorAction Stop
            $success = $true
        } catch {
            $retryCount++
            if ($retryCount -le $maxRetries) {
                Start-Sleep -Milliseconds 100
            } else {
                Write-Host "Warning: Could not log entry. File locked." -ForegroundColor Yellow
            }
        }
    }
}

# 5. Server management functions
function Start-IGTServer {
    $serverPath = Join-Path $scriptDir "lib\igt-http-server.mjs"
    
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "node"
    $psi.Arguments = "$serverPath"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardError = $true
    $psi.StandardErrorEncoding = [System.Text.Encoding]::UTF8
    $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables["IGT_SERVER_PORT"] = $serverPort
    $psi.EnvironmentVariables["IGT_SERVER_HOST"] = $serverHost
    
    $script:serverProcess = New-Object System.Diagnostics.Process
    $script:serverProcess.StartInfo = $psi
    $script:serverProcess.EnableRaisingEvents = $true
    
    $script:serverProcess.Start() | Out-Null
    
    # Wait for server to be ready
    $timeout = [DateTime]::Now.AddSeconds(8)
    $ready = $false
    
    while ([DateTime]::Now -lt $timeout) {
        if ($script:serverProcess.HasExited) {
            Write-Host "Error: Server failed to start" -ForegroundColor Red
            return $false
        }
        
        # Try health check
        try {
            $response = Invoke-WebRequest -Uri "$serverBaseUrl/health" -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
            # Server not ready yet
        }
        
        Start-Sleep -Milliseconds 100
    }
    
    if ($ready) {
        Write-Host "[Server] Started (port $serverPort)" -ForegroundColor DarkGray
        return $true
    } else {
        Write-Host "Error: Server startup timeout" -ForegroundColor Red
        return $false
    }
}

function Stop-IGTServer {
    if ($script:serverProcess -and !$script:serverProcess.HasExited) {
        $script:serverProcess.Kill()
        Start-Sleep -Milliseconds 50
        $script:serverProcess.Dispose()
    }
}

function Invoke-ParallelGrammarCheck {
    param([string]$inputText)
    
    # Ensure server is running
    if (!$script:serverProcess -or $script:serverProcess.HasExited) {
        if (!(Start-IGTServer)) {
            return $null
        }
    }
    
    $result = @{ 
        FastText = ""
        FullData = $null
        Perf = @()
    }

    try {
        $body = @{ text = $inputText } | ConvertTo-Json
        $request = [System.Net.WebRequest]::Create("$serverBaseUrl/grammar/parallel")
        $request.Method = "POST"
        $request.ContentType = "application/json; charset=utf-8"
        $request.Timeout = 60000 # 60 seconds
        
        $requestStream = $request.GetRequestStream()
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $requestStream.Write($bytes, 0, $bytes.Length)
        $requestStream.Close()

        $response = $request.GetResponse()
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())

        while (!$reader.EndOfStream) {
            $line = $reader.ReadLine()
            if ($line.StartsWith("data: ")) {
                $jsonData = $line.Substring(6) | ConvertFrom-Json
                
                if ($jsonData.type -eq "fast_correction") {
                    $result.FastText = $jsonData.text
                    Write-Host "`n**Correction**: " -NoNewline -ForegroundColor Green
                    Write-Host $result.FastText -ForegroundColor White
                    Write-Host "  [LLM Fast: $($jsonData.ms.ToString('N0'))ms]" -ForegroundColor DarkGray
                    Write-Host "Analyzing detailed grammar rules..." -NoNewline -ForegroundColor DarkYellow
                }
                elseif ($jsonData.type -eq "full_analysis") {
                    # Clear the "Analyzing..." line
                    Write-Host "`r                                    `r" -NoNewline
                    $result.FullData = $jsonData
                    $result.Perf += "LLM Full: $($jsonData.ms.ToString('N0'))ms"
                }
                elseif ($jsonData.type -eq "complete") {
                    if ($jsonData.perf -and $jsonData.perf.total_ms) {
                        $result.Perf += "Total: $($jsonData.perf.total_ms.ToString('N0'))ms"
                    }
                }
            }
        }
        $reader.Close()
        $response.Close()

        return $result
    } catch {
        Write-Host "`nError: Request failed - $_" -ForegroundColor Red
        return $null
    }
}

# 7. Main loop
Write-Host "--- Interactive Grammar Tool (IGT) Started [HTTP Server + Qwen Default] ---" -ForegroundColor Yellow
Write-Host "Logging to: $targetPath" -ForegroundColor Gray
Write-Host "Server: HTTP resident mode (port $serverPort) - eliminates startup overhead" -ForegroundColor DarkGreen
Write-Host "Type 'exit' to quit." -ForegroundColor Gray
Write-Host "Type 'handbook' to generate personal error handbook." -ForegroundColor DarkGray
Write-Host "Type 'practice' to start practice exercises." -ForegroundColor DarkGray
Write-Host "Type 'assess' to view proficiency assessment." -ForegroundColor DarkGray
Write-Host "Type 'llm' to manage LLM providers (switch, status, setup).`n" -ForegroundColor DarkCyan

while ($true) {
    Write-Host -NoNewline "Grammar Input > " -ForegroundColor Cyan
    $userInput = Read-Host

    if ($userInput -eq "exit" -or $userInput -eq "quit") { 
        Stop-IGTServer
        break 
    }
    if ([string]::IsNullOrWhiteSpace($userInput)) { continue }

    # Handle special commands
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

    # Use Parallel HTTP server for grammar check
    $response = Invoke-ParallelGrammarCheck -inputText $userInput
    $sw.Stop()

    if (!$response) {
        Write-Host "`nError: Failed to get response" -ForegroundColor Red
        continue
    }

    $fullData = $response.FullData
    $perfInfo = $response.Perf

    if (!$fullData) {
        Write-Host "`nWarning: Failed to get full analysis." -ForegroundColor Yellow
        continue
    }

    # Print remaining sections (Correction was already printed)
    if ($fullData.refine) {
        Write-Host "**Refine**: " -NoNewline -ForegroundColor Cyan
        Write-Host $fullData.refine -ForegroundColor White
    }
    
    if ($fullData.diagnoses -and $fullData.diagnoses.Count -gt 0) {
        Write-Host "`n**Diagnoses**:" -ForegroundColor White
        foreach ($d in $fullData.diagnoses) {
            Write-Host "- $($d.error_type) ($($d.severity)): $($d.explanation)" -ForegroundColor White
        }
    }
    
    if ($fullData.rule) {
        Write-Host "`n**Rule**: " -NoNewline -ForegroundColor Yellow
        Write-Host $fullData.rule -ForegroundColor White
    }
    
    if ($fullData.tip) {
        Write-Host "`n**Tip**: " -NoNewline -ForegroundColor Magenta
        Write-Host $fullData.tip -ForegroundColor White
    }

    Write-Host ""
    if ($perfInfo) {
        $perfStr = $perfInfo -join " | "
        Write-Host "  [$perfStr]" -ForegroundColor DarkGray
    }

    # Format for logging
    $finalOutput = "**Correction**: $($response.FastText)`n"
    if ($fullData.refine) { $finalOutput += "**Refine**: $($fullData.refine)`n" }
    
    $diagnosesText = ""
    if ($fullData.diagnoses) {
        $diagLines = @()
        foreach ($d in $fullData.diagnoses) {
            $diagLines += "- $($d.error_type) ($($d.severity)): $($d.explanation)"
        }
        $diagnosesText = "`n**Diagnoses**:`n" + ($diagLines -join "`n")
    }
    $finalOutput += $diagnosesText
    
    if ($fullData.rule) { $finalOutput += "`n**Rule**: $($fullData.rule)" }
    if ($fullData.tip) { $finalOutput += "`n**Tip**: $($fullData.tip)" }

    Log-Result -targetPath $targetPath -userInput $userInput -cleanOutput $finalOutput
}
