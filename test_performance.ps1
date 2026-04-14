# Performance Test for IGT API Mode
$scriptDir = $PSScriptRoot
$configPath = Join-Path $scriptDir "lib\igt_config.json"
$envPath = Join-Path $scriptDir ".env"

# 1. Load Config
$config = Get-Content $configPath -Raw | ConvertFrom-Json
$systemPrompt = $config.Prompts.SystemPrompt
$userInput = "This is a simple test sentence to measure the wall time of the API response."

# 2. Load .env
$apiKeys = @{}
if (Test-Path $envPath) {
    Get-Content $envPath | Where-Object { $_ -match '^([^=]+)=(.*)$' } | ForEach-Object {
        $key = $Matches[1].Trim()
        $value = $Matches[2].Trim()
        $apiKeys[$key] = @($value -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
}

function Test-Provider {
    param([string]$provider, [string]$model)
    
    Write-Host "Testing $provider ($model)..." -NoNewline
    
    $apiKeyEnvVar = switch ($provider) {
        "gemini" { "GOOGLE_API_KEYS" }
        "qwen" { "DASHSCOPE_API_KEYS" }
        "deepseek" { "DEEPSEEK_API_KEYS" }
    }
    
    $keys = $apiKeys[$apiKeyEnvVar]
    if (-not $keys) { 
        Write-Host " Skipped (No API Key)" -ForegroundColor Yellow
        return 
    }
    
    $key = $keys[0]
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        switch ($provider) {
            "gemini" {
                $uri = "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=$key"
                $body = @{
                    system_instruction = @{ parts = @( @{ text = $systemPrompt } ) }
                    contents = @( @{ parts = @( @{ text = $userInput } ) } )
                } | ConvertTo-Json -Depth 10 -Compress
                $null = Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType "application/json"
            }
            "qwen" {
                $uri = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
                $headers = @{ "Authorization" = "Bearer $key" }
                $body = @{
                    model = $model
                    messages = @(
                        @{ role = "system"; content = $systemPrompt },
                        @{ role = "user"; content = $userInput }
                    )
                } | ConvertTo-Json -Depth 10 -Compress
                $null = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ContentType "application/json"
            }
            "deepseek" {
                $uri = "https://api.deepseek.com/chat/completions"
                $headers = @{ "Authorization" = "Bearer $key" }
                $body = @{
                    model = $model
                    messages = @(
                        @{ role = "system"; content = $systemPrompt },
                        @{ role = "user"; content = $userInput }
                    )
                } | ConvertTo-Json -Depth 10 -Compress
                $null = Invoke-RestMethod -Uri $uri -Method Post -Headers $headers -Body $body -ContentType "application/json"
            }
        }
        $sw.Stop()
        Write-Host " Done: $($sw.ElapsedMilliseconds) ms" -ForegroundColor Green
    } catch {
        $sw.Stop()
        Write-Host " Failed after $($sw.ElapsedMilliseconds) ms" -ForegroundColor Red
        Write-Host $_ -ForegroundColor DarkRed
    }
}

Write-Host "--- IGT Wall Time Performance Test ---`n" -ForegroundColor Yellow
Test-Provider "gemini" $config.GeminiFlashModel
Test-Provider "qwen" $config.QwenFlashModel
Test-Provider "deepseek" $config.DeepseekFlashModel
