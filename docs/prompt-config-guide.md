# IGT 配置文件提示词管理

## 概述

所有LLM提示词（prompts）现已集中到 `lib/igt_config.json` 配置文件中管理，不再依赖外部文本文件。这使得提示词的修改和维护更加便捷。

## 配置文件结构

在 `lib/igt_config.json` 中，新增了 `Prompts` 字段：

```json
{
    "ReviewPath": "...",
    "Model": "gemini-2.5-flash-lite",
    "DbPath": "igt_data.db",
    "ReportPath": "...",
    "ApiKeys": [...],
    "Prompts": {
        "SystemPrompt": "...",
        "HandbookGrammarRulePrompt": "...",
        "PracticeExercisePrompt": "..."
    }
}
```

## 提示词说明

### 1. SystemPrompt

**用途**: 语法验证器主提示词，用于 `igt-bridge.mjs`

**功能**: 
- 定义LLM作为"语言验证器"、"专业编辑"和"英语能力分析员"
- 规定输出格式：Review → Correction → Refine → Diagnosis → Rule → Tip
- 指导错误分类和分析

**使用位置**: `lib/igt-bridge.mjs`

### 2. HandbookGrammarRulePrompt

**用途**: 生成个性化语法规则解释，用于 `igt-handbook.mjs`

**功能**:
- 基于用户历史错误生成定制定制语法规则
- 使用 `{{errorType}}` 和 `{{examplesText}}` 占位符
- 包含清晰的教学指导和示例

**使用位置**: `tools/igt-handbook.mjs`

### 3. PracticeExercisePrompt

**用途**: 生成练习题目，用于 `igt-practice.mjs`

**功能**:
- 生成多选题或填空题
- 使用 `{{count}}` 和 `{{errorList}}` 占位符
- 输出结构化JSON格式

**使用位置**: `tools/igt-practice.mjs`

## 模板变量

配置文件中的提示词可以使用以下占位符，系统会自动替换：

| 占位符 | 说明 | 使用场景 |
|--------|------|----------|
| `{{errorType}}` | 错误类型名称 | Handbook语法规则生成 |
| `{{examplesText}}` | 用户示例文本 | Handbook语法规则生成 |
| `{{count}}` | 练习数量 | Practice题目生成 |
| `{{errorList}}` | 错误类型列表 | Practice题目生成 |

## 自定义提示词

### 方法1: 直接编辑配置文件

打开 `lib/igt_config.json`，修改 `Prompts` 字段下的相应提示词：

```json
{
    "Prompts": {
        "SystemPrompt": "你的新提示词内容...",
        "HandbookGrammarRulePrompt": "...",
        "PracticeExercisePrompt": "..."
    }
}
```

### 方法2: 使用文本编辑器

1. 打开 `lib/igt_config.json`
2. 找到 `Prompts` 部分
3. 修改对应的提示词内容
4. 保存文件

**注意**: JSON格式要求特殊字符需要转义：
- 换行符: `\n`
- 双引号: `\"`
- 反斜杠: `\\`

## 向后兼容性

系统保留了对旧版文件方式的支持。如果配置文件中没有 `Prompts` 字段，系统会自动回退到：

- `SystemPrompt` → 读取 `SystemPromptPath` 指定的文件
- `HandbookGrammarRulePrompt` → 使用代码内嵌的默认提示词
- `PracticeExercisePrompt` → 使用代码内嵌的默认提示词

这确保了现有系统的平稳过渡。

## 文件变更

### 已删除的文件
- ❌ `prompts/practice_prompt.txt` - 已不再使用
- ❌ `lib/system_prompt.txt` - 可选，配置文件优先
- ❌ `prompts/system_prompt.txt` - 可选，配置文件优先

### 已修改的文件
- ✅ `lib/igt_config.json` - 添加 `Prompts` 字段
- ✅ `lib/igt-bridge.mjs` - 从配置读取System Prompt
- ✅ `tools/igt-handbook.mjs` - 从配置读取Grammar Rule Prompt
- ✅ `tools/igt-practice.mjs` - 从配置读取Exercise Prompt

## 测试验证

运行以下命令验证修改：

```powershell
# 1. 语法检查
node --check lib/igt-bridge.mjs
node --check tools/igt-handbook.mjs
node --check tools/igt-practice.mjs

# 2. 功能测试（需要先有数据库数据）
node tools/igt-handbook.mjs --days=7
node tools/igt-practice.mjs "Grammar" --count=5
```

## 最佳实践

### 提示词设计建议

1. **明确具体**: 清晰说明LLM的角色和任务
2. **结构化输出**: 规定明确的输出格式
3. **示例驱动**: 包含示例帮助LLM理解
4. **可维护性**: 使用模板变量提高复用性

### 修改提示词的时机

- ✅ 需要调整教学风格
- ✅ 需要添加新的输出字段
- ✅ 需要改变错误分类方式
- ✅ 需要优化输出质量

### 测试修改后的提示词

修改提示词后，建议：

1. 用几个已知错误句子测试输出格式
2. 检查handbook生成是否正常
3. 验证练习题目生成是否正确
4. 确认日志文件格式未受影响

## 示例：自定义教学风格

如果你想让提示词更适合中文学习者：

```json
{
    "Prompts": {
        "SystemPrompt": "你是一位专业的英语语法教师，擅长用中文解释英语语法错误...\n\n对于每个输入，请：\n1. 指出错误\n2. 给出正确版本\n3. 用中文解释原因\n4. 提供记忆技巧\n..."
    }
}
```

## 常见问题

### Q1: 修改配置后需要重启什么吗？

不需要重启。配置文件在每次运行工具时自动读取。

### Q2: 能否只使用部分配置提示词？

可以。系统对每个提示词都独立检查配置，缺失时自动使用默认值。

### Q3: 如何恢复到原来的提示词？

删除 `Prompts` 字段，或将其设为空对象 `{}`，系统会自动回退到默认值。

### Q4: 配置文件格式错误怎么办？

使用JSON验证器检查格式。常见错误：
- 缺少逗号
- 引号未转义
- 括号不匹配

## 更新日志

### 2026-04-12

- ✅ 将所有提示词集中到配置文件管理
- ✅ 支持模板变量替换
- ✅ 保持向后兼容性
- ✅ 删除外部提示词文件
- ✅ 更新所有相关模块
