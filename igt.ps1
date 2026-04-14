# Interactive Grammar Tool (IGT) - API Mode
$scriptDir = $PSScriptRoot
$configPath = Join-Path $scriptDir "lib\igt_config.json"
$envPath = Join-Path $scriptDir ".env"

# 1. Load Config Once
if (-not (Test-Path $configPath)) {
    Write-Host "Error: lib\igt_config.json not found" -ForegroundColor Red
    exit 1
}
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$systemPrompt = $config.Prompts.SystemPrompt
$targetPath = $config.ReviewPath

# 2. Load .env for API keys
$apiKeys = @{}
if (Test-Path $envPath) {
    Get-Content $envPath | Where-Object { $_ -match '^([^=]+)=(.*)$' } | ForEach-Object {
        $key = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        # Split by comma to support primary and backup keys
        $apiKeys[$key] = @($value -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
} else {
    Write-Host "Warning: .env file not found." -ForegroundColor Yellow
}

# Provider and Model selection
$script:currentProvider = if ($config.LLMProvider) { $config.LLMProvider } else { "gemini" }
$script:currentModel = $config.GeminiFlashModel

function Set-Provider {
    param([string]$provider)
    $script:currentProvider = $provider.ToLower()
    switch ($script:currentProvider) {
        "gemini" { $script:currentModel = $config.GeminiFlashModel }
        "qwen" { $script:currentModel = $config.QwenFlashModel }
        "deepseek" { $script:currentModel = $config.DeepseekFlashModel }
        default { Write-Host "Unknown provider: $provider" -ForegroundColor Red }
    }
    Write-Host "Switched to provider: $script:currentProvider (Model: $script:currentModel)" -ForegroundColor Green
}

Set-Provider $script:currentProvider

function Invoke-LLMAPI {
    param([string]$systemPrompt, [string]$userInput)
    
    $provider = $script:currentProvider
    $model = $script:currentModel
    
    $apiKeyEnvVar = switch ($provider) {
        "gemini" { "GOOGLE_API_KEYS" }
        "qwen" { "DASHSCOPE_API_KEYS" }
        "deepseek" { "DEEPSEEK_API_KEYS" }
    }
    
    $keys = $apiKeys[$apiKeyEnvVar]
    if (-not $keys -or $keys.Count -eq 0) {
        throw "No API key found for provider $provider in .env ($apiKeyEnvVar)"
    }
    
    $primaryKey = $keys[0]
    $backupKey = if ($keys.Count -gt 1) { $keys[1] } else { $null }

    $tryApiCall = {
        param([string]$key)
        
        # Ensure TLS 1.2 is used for API calls
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        
        switch ($provider) {
            "gemini" {
                $uri = "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=$key"
                $body = @{
                    system_instruction = @{ parts = @( @{ text = $systemPrompt } ) }
                    contents = @(
                        @{ parts = @( @{ text = $userInput } ) }
                    )
                } | ConvertTo-Json -Depth 10 -Compress
                $response = Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType "application/json"
                
                if ($response.candidates -and $response.candidates.Count -gt 0) {
                    return $response.candidates[0].content.parts[0].text
                } else {
                    throw "Unexpected response from Gemini API"
                }
            }
            "qwen" {
                $uri = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
                $headers = @{ "Authorization" = "Bearer $key" }
                $messages = @(
                    @{ role = "system"; content = $systemPrompt },
                    @{ role = "user"; content = $userInput }
                )
                $body = @{
                    model = $model
                    messages = $messages
                } | ConvertTo-Json -Depth 10 -Compress
                $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ContentType "application/json"
                return $response.choices[0].message.content
            }
            "deepseek" {
                $uri = "https://api.deepseek.com/chat/completions"
                $headers = @{ "Authorization" = "Bearer $key" }
                $messages = @(
                    @{ role = "system"; content = $systemPrompt },
                    @{ role = "user"; content = $userInput }
                )
                $body = @{
                    model = $model
                    messages = $messages
                } | ConvertTo-Json -Depth 10 -Compress
                $response = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ContentType "application/json"
                return $response.choices[0].message.content
            }
        }
    }
    
    try {
        return &$tryApiCall $primaryKey
    } catch {
        if ($backupKey) {
            Write-Host "Primary key failed, trying backup key..." -ForegroundColor Yellow
            return &$tryApiCall $backupKey
        } else {
            throw $_
        }
    }
}

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
            $dir = Split-Path $targetPath -Parent
            if (-not (Test-Path $dir)) {
                New-Item -ItemType Directory -Force -Path $dir | Out-Null
            }
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

Write-Host "--- Interactive Grammar Tool (IGT) API Mode ---" -ForegroundColor Yellow
Write-Host "Logging to: $targetPath" -ForegroundColor Gray
Write-Host "Commands: /gemini, /qwen, /deepseek, /exit`n" -ForegroundColor Gray

while ($true) {
    Write-Host -NoNewline "[$script:currentProvider] Grammar Input > " -ForegroundColor Cyan
    $userInput = Read-Host
    
    if ($userInput -eq "/exit" -or $userInput -eq "exit" -or $userInput -eq "quit") { break }
    if ($userInput -eq "/gemini" -or $userInput -eq "/qwen" -or $userInput -eq "/deepseek") {
        Set-Provider $userInput.Substring(1)
        continue
    }
    if ([string]::IsNullOrWhiteSpace($userInput)) { continue }

    Write-Host "Processing..." -ForegroundColor Gray
    
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $cleanOutput = Invoke-LLMAPI -systemPrompt $systemPrompt -userInput $userInput
        $sw.Stop()
        
        Write-Host "`n$($cleanOutput.Trim())`n" -ForegroundColor White
        Write-Host "[Time taken: $($sw.ElapsedMilliseconds) ms]" -ForegroundColor DarkGray
        
        Log-Result -targetPath $targetPath -userInput $userInput -cleanOutput $cleanOutput
    } catch {
        Write-Host "`nError: API call failed" -ForegroundColor Red
        Write-Host $_ -ForegroundColor DarkRed
        if ($_.Exception -and $_.Exception.Response) {
            try {
                $errBody = (new-object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd()
                Write-Host $errBody -ForegroundColor DarkRed
            } catch {}
        }
    }
}
