
# Test script for IGT output filtering (Updated for High-Performance)

$noisePattern = [regex]::new('YOLO mode|Loaded cached|Loading extension|Scheduling MCP|Executing MCP|MCP context|Warning:', [System.Text.RegularExpressions.RegexOptions]::Compiled)

$testCases = @(
    @{
        Input = @("YOLO mode enabled", "Loaded cached session", "This is a real line", "Warning: something happened", "Another real line")
        Expected = "This is a real line`nAnother real line"
    },
    @{
        Input = @("Scheduling MCP", "Executing MCP", "MCP context loaded")
        Expected = ""
    },
    @{
        Input = @("Normal line 1", "Normal line 2")
        Expected = "Normal line 1`nNormal line 2"
    }
)

function Test-Filtering($lines, $pattern) {
    $cleanLines = $lines | Where-Object { -not $pattern.IsMatch($_.ToString()) }
    return ($cleanLines -join "`n").Trim()
}

$allPassed = $true
foreach ($testCase in $testCases) {
    $actual = Test-Filtering $testCase.Input $noisePattern
    if ($actual -ne $testCase.Expected) {
        Write-Host "Test Failed!" -ForegroundColor Red
        Write-Host "Input: $($testCase.Input -join ', ')"
        Write-Host "Expected: '$($testCase.Expected)'"
        Write-Host "Actual:   '$actual'"
        $allPassed = $false
    } else {
        Write-Host "Test Passed for input: $($testCase.Input[0])..." -ForegroundColor Green
    }
}

if ($allPassed) {
    Write-Host "`nAll tests passed successfully!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`nSome tests failed." -ForegroundColor Red
    exit 1
}
