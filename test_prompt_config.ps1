# IGT 配置提示词功能测试脚本

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "IGT 配置提示词功能测试" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# 测试1: 验证配置文件格式
Write-Host "[测试 1] 验证配置文件格式..." -ForegroundColor Yellow
try {
    $config = Get-Content "lib/igt_config.json" -Raw | ConvertFrom-Json
    Write-Host "✅ 配置文件格式正确" -ForegroundColor Green
    
    if ($config.Prompts) {
        Write-Host "✅ 找到 Prompts 字段" -ForegroundColor Green
        $promptCount = ($config.Prompts | Get-Member -MemberType NoteProperty).Count
        Write-Host "   包含 $promptCount 个提示词" -ForegroundColor Gray
        
        if ($config.Prompts.SystemPrompt) {
            Write-Host "  ✅ SystemPrompt" -ForegroundColor Green
        }
        if ($config.Prompts.HandbookGrammarRulePrompt) {
            Write-Host "  ✅ HandbookGrammarRulePrompt" -ForegroundColor Green
        }
        if ($config.Prompts.PracticeExercisePrompt) {
            Write-Host "  ✅ PracticeExercisePrompt" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ 未找到 Prompts 字段" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ 配置文件格式错误: $_" -ForegroundColor Red
}
Write-Host ""

# 测试2: 语法检查
Write-Host "[测试 2] JavaScript 语法检查..." -ForegroundColor Yellow
$files = @(
    "lib/igt-bridge.mjs",
    "tools/igt-handbook.mjs",
    "tools/igt-practice.mjs"
)

$allPassed = $true
foreach ($file in $files) {
    $result = node --check $file 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file" -ForegroundColor Red
        $allPassed = $false
    }
}
Write-Host ""

# 测试3: 检查旧文件
Write-Host "[测试 3] 检查旧提示词文件..." -ForegroundColor Yellow
$oldFiles = @(
    "prompts/practice_prompt.txt",
    "lib/system_prompt.txt",
    "prompts/system_prompt.txt"
)

foreach ($file in $oldFiles) {
    if (Test-Path $file) {
        Write-Host "⚠️  $file (仍然存在，但不影响功能)" -ForegroundColor Yellow
    } else {
        Write-Host "✅ $file (已删除)" -ForegroundColor Green
    }
}
Write-Host ""

# 测试4: 显示配置摘要
Write-Host "[测试 4] 配置摘要..." -ForegroundColor Yellow
if ($config.Prompts) {
    if ($config.Prompts.SystemPrompt) {
        $length = $config.Prompts.SystemPrompt.Length
        Write-Host "  SystemPrompt: $length 字符" -ForegroundColor Gray
    }
    if ($config.Prompts.HandbookGrammarRulePrompt) {
        $length = $config.Prompts.HandbookGrammarRulePrompt.Length
        Write-Host "  HandbookGrammarRulePrompt: $length 字符" -ForegroundColor Gray
    }
    if ($config.Prompts.PracticeExercisePrompt) {
        $length = $config.Prompts.PracticeExercisePrompt.Length
        Write-Host "  PracticeExercisePrompt: $length 字符" -ForegroundColor Gray
    }
}
Write-Host ""

# 测试5: 功能说明
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "功能说明" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "✅ 提示词配置已集中管理:`n" -ForegroundColor Green

Write-Host "1. 统一管理" -ForegroundColor Yellow
Write-Host "   - 所有提示词在 lib/igt_config.json 中" -ForegroundColor Gray
Write-Host "   - 便于修改和维护" -ForegroundColor Gray
Write-Host "   - 支持模板变量替换`n" -ForegroundColor Gray

Write-Host "2. 向后兼容" -ForegroundColor Yellow
Write-Host "   - 如果配置中没有 Prompts 字段" -ForegroundColor Gray
Write-Host "   - 系统自动回退到文件方式" -ForegroundColor Gray
Write-Host "   - 确保现有系统不受影响`n" -ForegroundColor Gray

Write-Host "3. 自定义能力" -ForegroundColor Yellow
Write-Host "   - 修改 SystemPrompt 改变语法检查风格" -ForegroundColor Gray
Write-Host "   - 修改 HandbookGrammarRuleRulePrompt 定制规则解释" -ForegroundColor Gray
Write-Host "   - 修改 PracticeExercisePrompt 调整题目生成`n" -ForegroundColor Gray

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "使用方法" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "编辑配置文件:" -ForegroundColor Yellow
Write-Host "  lib/igt_config.json`n" -ForegroundColor White

Write-Host "模板变量:" -ForegroundColor Yellow
Write-Host "  {{errorType}}      - 错误类型名称" -ForegroundColor White
Write-Host "  {{examplesText}}   - 用户示例文本" -ForegroundColor White
Write-Host "  {{count}}          - 练习数量" -ForegroundColor White
Write-Host "  {{errorList}}      - 错误类型列表`n" -ForegroundColor White

Write-Host "详细文档:" -ForegroundColor Yellow
Write-Host "  docs/prompt-config-guide.md`n" -ForegroundColor White

Write-Host "========================================`n" -ForegroundColor Cyan
