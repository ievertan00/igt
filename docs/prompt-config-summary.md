# IGT 提示词配置化更新总结

## 更新概述

本次更新将所有LLM提示词（prompts）从外部文件迁移到配置文件 `lib/igt_config.json` 中集中管理。

## 主要变更

### 1. 配置文件增强

**文件**: `lib/igt_config.json`

**新增字段**: `Prompts` 对象，包含三个提示词：

```json
{
    "Prompts": {
        "SystemPrompt": "...",
        "HandbookGrammarRulePrompt": "...",
        "PracticeExercisePrompt": "..."
    }
}
```

### 2. 代码模块更新

#### lib/igt-bridge.mjs
- ✅ 优先从配置文件读取 `SystemPrompt`
- ✅ 回退机制：如果配置不存在，读取 `SystemPromptPath` 文件
- ✅ 删除重复的路径解析代码

#### tools/igt-handbook.mjs
- ✅ 优先从配置文件读取 `HandbookGrammarRulePrompt`
- ✅ 支持模板变量替换：`{{errorType}}`, `{{examplesText}}`
- ✅ 回退机制：使用代码内嵌的默认提示词

#### tools/igt-practice.mjs
- ✅ 优先从配置文件读取 `PracticeExercisePrompt`
- ✅ 支持模板变量替换：`{{count}}`, `{{errorList}}`
- ✅ 回退机制：使用代码内嵌的默认提示词

### 3. 文件清理

**已删除**:
- ❌ `prompts/practice_prompt.txt`

**保留（向后兼容）**:
- ⚠️ `lib/system_prompt.txt` - 配置文件缺失时的后备
- ⚠️ `prompts/system_prompt.txt` - 配置文件缺失时的后备

### 4. 文档更新

**新增文档**:
- ✅ `docs/prompt-config-guide.md` - 详细的配置提示词指南

**更新文档**:
- ✅ `README.md` - 更新配置说明

## 技术特性

### 模板变量系统

配置文件中的提示词支持模板变量，运行时自动替换：

| 变量 | 说明 | 使用场景 |
|------|------|----------|
| `{{errorType}}` | 错误类型名称 | Handbook语法规则生成 |
| `{{examplesText}}` | 用户历史示例 | Handbook语法规则生成 |
| `{{count}}` | 练习题目数量 | Practice题目生成 |
| `{{errorList}}` | 错误类型列表 | Practice题目生成 |

### 向后兼容性

系统实现了三层回退机制：

1. **第一优先**: 配置文件中的 `Prompts` 字段
2. **第二优先**: 配置文件中的 `*PromptPath` 字段指定的文件
3. **第三优先**: 代码中内嵌的默认提示词

这确保了：
- ✅ 现有系统不受影响
- ✅ 平稳过渡到配置化管理
- ✅ 用户可以随时回退到文件方式

## 测试验证

### 已通过的测试

✅ **配置文件验证**
- JSON格式正确
- Prompts字段存在
- 包含3个提示词

✅ **语法检查**
- lib/igt-bridge.mjs - 通过
- tools/igt-handbook.mjs - 通过
- tools/igt-practice.mjs - 通过

✅ **功能测试**
- 提示词长度合理
- 模板变量格式正确
- 旧文件状态正确

## 使用指南

### 快速开始

1. **编辑配置文件**:
   ```bash
   # 使用任何文本编辑器打开
   lib/igt_config.json
   ```

2. **修改提示词**:
   ```json
   {
       "Prompts": {
           "SystemPrompt": "你的自定义提示词..."
       }
   }
   ```

3. **保存并运行**:
   ```bash
   # 无需重启，立即生效
   node tools/igt-handbook.mjs --days=7
   ```

### 自定义示例

#### 示例1: 更友好的教学风格

```json
{
    "SystemPrompt": "你是一位友善的英语老师，擅长用鼓励的方式指出错误...\n\n请：\n1. 先肯定优点\n2. 温和指出问题\n3. 给出清晰解释\n4. 提供实用建议"
}
```

#### 示例2: 中文解释支持

```json
{
    "HandbookGrammarRulePrompt": "You are a bilingual English/Chinese tutor...\n\nPlease provide:\n- English explanation\n- Chinese translation of key points\n- Examples with both languages"
}
```

## 优势总结

### 1. 易用性
- 📝 **单文件管理**: 所有提示词在一个JSON文件中
- 🔧 **快速修改**: 编辑配置立即生效
- 📋 **结构清晰**: 明确的字段名称和用途

### 2. 可维护性
- 🎯 **集中管理**: 不需要维护多个文本文件
- 🔄 **版本控制**: 配置文件易于git追踪
- 📊 **批量更新**: 一次修改影响所有工具

### 3. 灵活性
- 🎨 **自定义风格**: 轻松调整教学风格
- 🌐 **多语言支持**: 方便添加其他语言
- 🔌 **模板系统**: 变量替换增强复用性

### 4. 兼容性
- ⬅️ **向后兼容**: 保留文件方式支持
- 🔄 **平滑迁移**: 无需一次性切换
- 🛡️ **安全回退**: 配置缺失时自动降级

## 文件变更清单

### 修改的文件 (4个)
```
M  lib/igt_config.json          - 添加Prompts字段
M  lib/igt-bridge.mjs           - 从配置读取SystemPrompt
M  tools/igt-handbook.mjs       - 从配置读取GrammarRulePrompt
M  tools/igt-practice.mjs       - 从配置读取ExercisePrompt
```

### 新增的文件 (2个)
```
A  docs/prompt-config-guide.md  - 配置指南文档
A  test_prompt_config.ps1       - 测试脚本
```

### 删除的文件 (1个)
```
D  prompts/practice_prompt.txt  - 已迁移到配置文件
```

## 后续建议

### 可选的进一步改进

1. **提示词验证**
   - 添加JSON Schema验证
   - 检查必需字段是否存在
   - 验证模板变量格式

2. **提示词版本管理**
   - 为提示词添加版本号
   - 记录修改历史
   - 支持多套配置切换

3. **提示词导入导出**
   - 支持从文件导入提示词
   - 导出当前配置为模板
   - 分享预设配置

4. **图形化编辑器**
   - Web界面编辑提示词
   - 实时预览效果
   - 语法高亮显示

## 贡献者

- **ievertan00**: 设计和实现

## 更新日期

2026-04-12
