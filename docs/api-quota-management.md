# API配额管理指南

## 问题说明

Gemini API免费版有每日请求限制：
- **gemini-2.5-flash-lite**: 每天20次请求
- 超出后返回 `429 Too Many Requests` 错误

## 已实现的保护措施

### 1. 智能配额管理

系统现在会自动：
- ✅ **跟踪API调用**: 记录每次LLM请求
- ✅ **限制每日使用**: 默认上限18次（预留2次安全空间）
- ✅ **请求间隔**: 每次请求间隔2秒，避免突发流量
- ✅ **进度显示**: 显示剩余配额

### 2. 自动重试机制

遇到429错误时：
- ✅ **智能等待**: 从错误消息中提取建议重试时间
- ✅ **指数退避**: 重试间隔按 5s → 10s → 20s 递增
- ✅ **最多重试3次**: 超过后切换到下一个API密钥
- ✅ **优雅降级**: 所有密钥失败后使用静态规则

### 3. 增量更新优化

使用 `--incremental` 标志：
- ✅ **缓存机制**: 只重新生成变化的规则
- ✅ **减少60-80% API调用**
- ✅ **MD5哈希检测**: 自动识别数据变化

## 使用建议

### 日常工作流程

#### 方案1: 增量模式（推荐）

```powershell
# 首次运行（周一）：完整生成，约10-15次API调用
node tools/igt-handbook.mjs --days=30

# 后续运行（周二至周日）：只更新变化，约2-5次API调用
node tools/igt-handbook.mjs --days=30 --incremental
```

**优势**:
- 首次运行后，每天只需少量API调用
- 大幅降低配额溢出风险
- 生成速度提升60-80%

#### 方案2: 分批处理

如果错误类型很多，可以分批处理：

```powershell
# 只生成最近7天的报告（错误类型较少）
node tools/igt-handbook.mjs --days=7

# 或指定更大的天数但使用增量模式
node tools/igt-handbook.mjs --days=30 --incremental
```

### 监控配额

访问以下链接监控使用情况：
- **配额监控**: https://ai.dev/rate-limit
- **速率限制文档**: https://ai.google.dev/gemini-api/docs/rate-limits

## 控制台输出示例

### 正常运行

```
📝 [1/8] Generating: Grammar / Verb Tense (18 API calls remaining today)
✅ Generated Grammar / Verb Tense
⏱️  Rate limiting: waiting 2s...

📝 [2/8] Generating: Grammar / Article Usage (17 API calls remaining today)
✅ Generated and cached Grammar / Article Usage
⏱️  Rate limiting: waiting 2s...
```

### 配额接近上限

```
📝 [17/20] Generating: Grammar / Preposition Usage (2 API calls remaining today)
✅ Generated Grammar / Preposition Usage

⚠️  Approaching daily quota limit (18/18). Using static rules for remaining items.
⏭️  Using static rule: Grammar / Subject-Verb Agreement
```

### 速率限制触发

```
📝 [1/8] Generating: Grammar / Verb Tense
⏳ Rate limit hit. Waiting 5.0s before retry 1/3...
⏳ Rate limit hit. Waiting 10.0s before retry 2/3...
✅ Generated Grammar / Verb Tense
```

## 解决配额问题

### 方法1: 使用增量模式（最有效）

```powershell
node tools/igt-handbook.mjs --days=30 --incremental
```

**效果**: 减少60-80% API调用

### 方法2: 清除缓存重新生成

如果缓存的规则质量不高：

```powershell
# 清除缓存
node tools/igt-handbook.mjs --clear-cache

# 重新生成（会消耗配额）
node tools/igt-handbook.mjs --days=7
```

### 方法3: 升级API配额

访问 Google AI Studio 升级计划：
- https://aistudio.google.com/

### 方法4: 使用多个项目密钥

在 `lib/igt_config.json` 中添加不同项目的API密钥：

```json
{
    "ApiKeys": [
        "AIzaSy...Project1",  // 项目1的密钥（20次/天）
        "AIzaSy...Project2",  // 项目2的密钥（20次/天）
        "AIzaSy...Project3"   // 项目3的密钥（20次/天）
    ]
}
```

**注意**: 每个Google Cloud项目有独立配额。

## 配置选项

### 调整配额限制

编辑 `tools/igt-handbook.mjs`，修改以下参数：

```javascript
const maxDailyQuota = 18;      // 每日最大API调用次数
const requestDelay = 2000;     // 请求间隔（毫秒）
const maxRetries = 3;          // 最大重试次数
```

### 建议值

| 场景 | maxDailyQuota | requestDelay | 说明 |
|------|---------------|--------------|------|
| **单密钥** | 18 | 2000ms | 预留2次安全空间 |
| **多密钥** | 50 | 1000ms | 可在密钥间切换 |
| **付费版** | 1000 | 500ms | 更高的速率限制 |

## 故障排除

### Q1: 所有API密钥都429怎么办？

**现象**: 控制台显示所有密钥都失败

**解决**:
1. 系统已自动使用静态规则生成handbook
2. 等待第二天配额重置（UTC时间午夜）
3. 或使用增量模式减少调用

### Q2: 如何知道还剩多少配额？

**方法**:
1. 查看控制台输出的 `(X API calls remaining today)`
2. 访问 https://ai.dev/rate-limit
3. 查看 Google Cloud Console

### Q3: 能否暂停后继续？

**可以**:
- 使用 `--incremental` 会保存进度到缓存
- 中断后再次运行会自动跳过已生成的规则

### Q4: 为什么有时生成很快，有时很慢？

**原因**:
- **缓存命中**: 数据未变化，直接使用缓存（<1秒）
- **API调用**: 需要LLM生成，受网络和配额影响（5-30秒）
- **速率限制**: 触发429后需要等待重试（5-60秒）

## 最佳实践

### ✅ 推荐

1. **日常使用增量模式**:
   ```powershell
   node tools/igt-handbook.mjs --days=30 --incremental
   ```

2. **定期清理缓存**:
   ```powershell
   # 每周一次，保持缓存整洁
   node tools/igt-handbook.mjs --cache-stats
   ```

3. **监控使用情况**:
   - 每天检查配额使用
   - 设置提醒避免溢出

### ❌ 避免

1. **不要频繁完整生成**:
   ```powershell
   # 避免：每天完整运行一次
   node tools/igt-handbook.mjs --days=30
   ```

2. **不要忽略错误信息**:
   - 429错误时等待，不要立即重试
   - 系统已自动处理重试

3. **不要共享API密钥**:
   - 每个项目独立密钥
   - 避免配额相互影响

## 性能对比

| 模式 | API调用 | 生成时间 | 适用场景 |
|------|---------|----------|----------|
| **完整模式** | 10-15次 | 30-60秒 | 首次运行 |
| **增量模式** | 2-5次 | 5-15秒 | 日常更新 |
| **纯静态** | 0次 | <5秒 | 配额用尽 |

## 更新日志

### 2026-04-12

- ✅ 添加配额跟踪和限制
- ✅ 实现智能重试机制
- ✅ 添加请求速率限制
- ✅ 优化增量更新缓存
- ✅ 改进控制台输出
- ✅ 添加进度显示
