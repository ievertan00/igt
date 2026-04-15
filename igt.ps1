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

# 6. LLM Provider management
function Get-CurrentProvider {
    try {
        $llmScript = Join-Path $scriptDir "lib\llm-switch.mjs"
        $output = node $llmScript current 2>&1 | Out-String
        if ($output -match "Current LLM Provider:\s*(\w+)") {
            return $matches[1].ToLower()
        }
    } catch {
        # Fallback to config
        return $config.LLMProvider
    }
    return $config.LLMProvider
}

function Get-CurrentModelName {
    $provider = Get-CurrentProvider
    $modelMap = @{
        gemini = $config.GeminiFlashModel
        qwen = $config.QwenFlashModel
        deepseek = $config.DeepseekFlashModel
    }
    return $modelMap[$provider]
}

function Switch-LLMProvider {
    param([string]$providerName)
    
    $llmScript = Join-Path $scriptDir "lib\llm-switch.mjs"
    node $llmScript switch $providerName
}

function Invoke-GrammarCheck {
    param([string]$inputText)

    # Ensure server is running
    if (!$script:serverProcess -or $script:serverProcess.HasExited) {
        if (!(Start-IGTServer)) {
            return $null
        }
    }

    try {
        $body = @{ text = $inputText } | ConvertTo-Json
        $response = Invoke-WebRequest -Uri "$serverBaseUrl/grammar" -Method POST -Body $body -ContentType "application/json; charset=utf-8" -TimeoutSec 60 -UseBasicParsing
        
        $jsonData = $response.Content | ConvertFrom-Json
        return $jsonData
    } catch {
        Write-Host "`nError: Request failed - $_" -ForegroundColor Red
        return $null
    }
}

# 7. Main loop
Write-Host "--- Interactive Grammar Tool (IGT) ---" -ForegroundColor Yellow
Write-Host "Type /qwen, /gemini, /deepseek to switch model" -ForegroundColor DarkGray
Write-Host "Type 'handbook' to generate personalized error handbook from your review history" -ForegroundColor DarkGray
Write-Host "Type 'practice' to start interactive grammar exercises with targeted questions" -ForegroundColor DarkGray
Write-Host "Type 'assess' to evaluate your English proficiency level (CEFR A1-C2)" -ForegroundColor DarkGray
Write-Host "Type 'exit' to quit.`n" -ForegroundColor Gray

# Get initial model name
$currentModel = Get-CurrentModelName

while ($true) {
    # Display prompt with current model
    Write-Host -NoNewline "[$currentModel] Grammar Input > " -ForegroundColor Cyan
    $userInput = Read-Host

    if ($userInput -eq "exit" -or $userInput -eq "quit") {
        Stop-IGTServer
        break
    }
    if ([string]::IsNullOrWhiteSpace($userInput)) { continue }

    # Handle LLM switching commands
    if ($userInput -eq "/qwen" -or $userInput -eq "/Qwen") {
        Switch-LLMProvider "qwen"
        $currentModel = Get-CurrentModelName
        continue
    }
    if ($userInput -eq "/gemini" -or $userInput -eq "/Gemini") {
        Switch-LLMProvider "gemini"
        $currentModel = Get-CurrentModelName
        continue
    }
    if ($userInput -eq "/deepseek" -or $userInput -eq "/Deepseek") {
        Switch-LLMProvider "deepseek"
        $currentModel = Get-CurrentModelName
        continue
    }

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
        # Update current model after llm switch
        $currentModel = Get-CurrentModelName
        Write-Host ""
        continue
    }

    Write-Host -NoNewline "Processing..." -ForegroundColor Gray
    $sw = [System.Diagnostics.Stopwatch]::StartNew()

    # Use HTTP server for grammar check
    $response = Invoke-GrammarCheck -inputText $userInput
    $sw.Stop()

    if (!$response) {
        Write-Host "`nError: Failed to get response" -ForegroundColor Red
        continue
    }

    $fullData = $response

    # Print all sections at once
    if ($fullData.content) {
        Write-Host "`n$($fullData.content)" -ForegroundColor White
    }

    Write-Host ""
    if ($fullData.perf) {
        Write-Host "  [LLM: $($fullData.perf.llm_ms.ToString('N0'))ms | Total: $($fullData.perf.total_ms.ToString('N0'))ms]" -ForegroundColor DarkGray
    }

    # Format for logging
    $finalOutput = $fullData.content

    Log-Result -targetPath $targetPath -userInput $userInput -cleanOutput $finalOutput
}
