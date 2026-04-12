# Grammar Rules Reference Callout格式修复

## 问题描述

在生成的handbook文件中，Grammar Rules Reference部分的折叠callout格式存在错误，导致Obsidian无法正确渲染折叠状态。

## Obsidian Callout语法规范

### 基本语法

```markdown
> [!NOTE] 非折叠callout
> 内容

> [!NOTE]- 折叠callout（注意-符号）
> 内容
```

### 嵌套内容格式规则

1. **每一行都必须以 `> ` 开头**
2. **空行也要表示为 `> `**
3. **callout标题和内容之间要有空行**
4. **多个段落之间要用 `> ` 分隔**

### 正确示例

```markdown
> [!NOTE]- Grammar / Verb Tense (Personalized)
> 
> ## Overview
> The verb tense system in English...
> 
> ## Common Patterns
> - ❌ "I go to school yesterday."
> - ✅ "I went to school yesterday."
> 
> ## Key Takeaway
> Always match the tense with the time marker.
```

### 错误示例（修复前）

```markdown
> [!NOTE]- Grammar / Verb Tense (Personalized)
> 
> ## Overview
> The verb tense system in English...
## Common Patterns
- ❌ "I go to school yesterday."
- ✅ "I went to school yesterday."
```

**问题**：从第二行开始，内容丢失了 `> ` 前缀，脱离了callout范围。

## 已修复的内容

### 修复位置1: LLM生成的规则

**文件**: `tools/igt-handbook.mjs` (约974行)

**修复前**:
```javascript
const lines = rule.content.split("\n");
for (const line of lines) {
  md += `> ${line}\n`;
}
```

**修复后**:
```javascript
const lines = rule.content.split("\n");
for (const line of lines) {
  // Skip empty lines at the start to avoid double spacing
  if (line.trim() === "") {
    md += `> \n`;
  } else {
    md += `> ${line}\n`;
  }
}
```

### 修复位置2: 静态规则

**文件**: `tools/igt-handbook.mjs` (约944行)

应用了相同的修复逻辑。

## 修复效果

### Before（错误格式）

生成的Markdown：
```markdown
> [!NOTE]- Grammar / Verb Tense (Personalized)
> 
## Overview
The verb tense system...

## Common Patterns
- ❌ Wrong example
```

Obsidian渲染结果：
- ❌ 只有标题在callout内
- ❌ 后续内容在callout外
- ❌ 折叠功能异常

### After（正确格式）

生成的Markdown：
```markdown
> [!NOTE]- Grammar / Verb Tense (Personalized)
> 
> ## Overview
> The verb tense system...
> 
> ## Common Patterns
> - ❌ Wrong example
```

Obsidian渲染结果：
- ✅ 所有内容都在callout内
- ✅ 折叠功能正常
- ✅ 格式统一美观

## 技术细节

### 空行处理

LLM生成的内容通常包含多个空行。修复后的代码：

1. **检测空行**: `if (line.trim() === "")`
2. **标准化**: 转换为 `> \n` 而不是 `> \n\n`
3. **避免双重间距**: 统一处理确保一致性

### 多行内容处理

```javascript
const lines = rule.content.split("\n");
for (const line of lines) {
  if (line.trim() === "") {
    md += `> \n`;          // 空行标准化
  } else {
    md += `> ${line}\n`;  // 正常内容加前缀
  }
}
md += `\n`;                // callout结束后空行
```

## 验证方法

### 1. 生成测试handbook

```powershell
node tools/igt-handbook.mjs --days=7
```

### 2. 检查输出文件

打开生成的 `docs/handbook_YYYY-MM-DD.md`，验证：

- ✅ 所有Grammar Rules Reference的callout可以折叠
- ✅ 内容格式正确，没有断裂
- ✅ 标题、列表、代码块都正常显示

### 3. 在Obsidian中打开

- 切换到Reading模式
- 点击callout标题旁边的箭头
- 验证折叠/展开功能

## 相关格式参考

### Detailed Error Analysis部分

这部分已经有正确的格式实现：

```javascript
md += `> [!CAUTION]- ${severityIcon} ${err.error_type} (${err.count} Occurrences)\n`;
md += `>\n`;  // 重要：空行也要加前缀

// 嵌套的callout
md += `> > [!FAILURE] Original (❌)\n`;
md += `> > \`${escapeCallout(ex.original_text)}\`\n`;
md += `>\n`;  // 分隔符
```

### 其他Callout类型

系统中使用的其他callout格式：

```markdown
> [!ABSTRACT] 不可折叠
> 内容

> [!SUCCESS] 成功提示
> 内容

> [!CAUTION]- 可折叠警告
> 内容

> [!TIP] 提示
> 内容

> [!INFO] 信息
> 内容

> [!FAILURE] 失败
> 内容

> [!EXAMPLE] 示例
> 内容

> [!NOTE]- 可折叠笔记
> 内容
```

## 最佳实践

### 生成Callout时的规则

1. **始终为每一行添加 `> ` 前缀**
2. **空行处理为 `> `**
3. **callout标题后加空行 `> `**
4. **段落间用 `> ` 分隔**
5. **callout结束后加空行**

### 代码模板

```javascript
md += `> [!TYPE]- Title\n`;
md += `> \n`;  // 标题后空行

const lines = content.split("\n");
for (const line of lines) {
  if (line.trim() === "") {
    md += `> \n`;  // 空行标准化
  } else {
    md += `> ${line}\n`;
  }
}
md += `\n`;  // callout后空行
```

## 测试清单

生成handbook后，检查以下项目：

- [ ] Grammar Rules Reference部分所有callout可折叠
- [ ] 每个callout内的标题正常显示
- [ ] 列表和代码块格式正确
- [ ] 没有内容溢出callout边界
- [ ] Obsidian Reading模式渲染正常
- [ ] 折叠/展开动画流畅

## 更新日志

### 2026-04-12

- ✅ 修复Grammar Rules Reference callout格式
- ✅ 统一空行处理逻辑
- ✅ 优化LLM生成内容的格式化
- ✅ 同步修复静态规则部分
- ✅ 添加内容标准化处理

## 相关文件

- `tools/igt-handbook.mjs` - 主要修复文件
- `docs/api-quota-management.md` - API配额管理
- `docs/prompt-config-guide.md` - 提示词配置指南
