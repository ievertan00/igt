# Interactive Grammar Tool (IGT) - Project Context

## 项目概述

IGT (Interactive Grammar Tool) 是一个高性能的 CLI 语法验证器，支持多 LLM（Google Gemini、Alibaba Qwen、Deepseek），并内置英语学习套件。它不仅能实时检查和纠正语法错误，还会自动收集错误模式到本地 SQLite 数据库，提供个性化学习工具：错误手册、针对性练习和水平评估。

**核心特性：**
- ⚡ 高性能：优化的 Node.js 桥接实现 <2s 响应时间（比 Gemini CLI 快 83%）
- 🔄 多 LLM 支持：可随时切换 Google Gemini、Alibaba Qwen、Deepseek
- 📚 英语学习套件：错误手册、练习模式、CEFR 水平评估
- 🗂️ MECE 错误分类：13 种错误类型，5 大类别
- 💾 持久化日志：自动记录到 Markdown（兼容 Obsidian）

## 技术栈

- **运行时**: Node.js v24+ (ES Modules)
- **语言**: JavaScript (`.mjs`), PowerShell (`.ps1`)
- **数据库**: SQLite (better-sqlite3)
- **LLM SDK**: `@google/generative-ai`
- **包管理**: npm

## 项目结构

```
.igt/
├── igt.ps1                      # 主交互循环 (PowerShell)
├── igt.cmd                       # Windows CMD 入口脚本
├── lib/                          # 核心库文件
│   ├── igt-bridge.mjs           # LLM API 桥接层 (主语法检查器)
│   ├── llm-provider.mjs         # LLM 提供者管理器
│   ├── llm-gemini.mjs           # Google Gemini 实现
│   ├── llm-qwen.mjs             # Alibaba Qwen 实现
│   ├── llm-deepseek.mjs         # Deepseek 实现
│   ├── llm-init.mjs             # LLM 提供者初始化
│   ├── llm-switch.mjs           # LLM 切换 CLI 工具
│   ├── config-loader.mjs        # 配置加载器 (.env + config.json)
│   ├── error-types.mjs          # MECE 错误分类系统
│   ├── model-resolver.mjs       # 模型解析器
│   └── system_prompt.txt        # 系统提示词
├── tools/                        # 独立工具脚本
│   ├── igt-handbook.mjs         # 错误手册生成器 (Obsidian Dashboard)
│   ├── igt-practice.mjs         # 交互式练习生成器
│   ├── igt-assess.mjs           # CEFR 水平评估引擎
│   ├── init-db.mjs              # 数据库初始化
│   └── import-review-to-db.mjs  # 导入旧 Markdown 日志到 SQLite
├── docs/                         # 文档
├── .env.example                  # 环境变量模板
├── package.json                  # 项目依赖
└── lib/igt_config.json          # 共享配置文件 (路径、模型、提示词)
```

## 配置架构

IGT 使用**分离配置**策略提高安全性：

| 文件 | 用途 | Git 跟踪 |
|------|------|----------|
| `.env` | 私密数据 (API Keys) | ❌ 不跟踪 |
| `lib/igt_config.json` | 共享设置 (路径、模型、提示词) | ✅ 安全提交 |

### 环境变量 (`.env`)
```env
GOOGLE_API_KEYS=key1,key2,key3
DASHSCOPE_API_KEYS=your-qwen-key
DEEPSEEK_API_KEYS=your-deepseek-key
IGT_LLM_PROVIDER=gemini
```

### 任务模型路由
- ⚡ **Flash 模型** — 语法纠正 (快速、成本效益高)
- 🏆 **Pro 模型** — 手册生成 & 练习 (最高质量)

## 常用命令

### 启动 IGT
```powershell
# 交互式语法检查
.\igt.ps1

# 或使用 CMD
.\igt.cmd
```

### LLM 管理 (在 IGT 内部)
```
llm list              # 查看所有 LLM 提供者
llm current           # 显示当前提供者
llm switch qwen       # 切换到 Qwen
llm status            # 显示提供者状态
llm setup             # 交互式 API Key 设置向导
```

### 独立工具命令
```powershell
# 初始化数据库 (首次运行)
node tools/init-db.mjs

# 生成错误手册 (过去 7 天)
node tools/igt-handbook.mjs --days=7

# 增量更新模式 (更快)
node tools/igt-handbook.mjs --days=7 --incremental

# 查看缓存统计
node tools/igt-handbook.mjs --cache-stats

# 清除 LLM 规则缓存
node tools/igt-handbook.mjs --clear-cache

# 特定错误类型练习
node tools/igt-practice.mjs "Article Usage"

# 生成 10 道练习题
node tools/igt-practice.mjs --count=10
```

### 安装依赖
```bash
npm install
```

## 开发约定

### 代码风格
- **ES Modules**: 使用 `import/export` 语法 (`.mjs` 文件)
- **模块命名**: 小写连字符 (`llm-provider.mjs`, `config-loader.mjs`)
- **类设计**: LLM 提供者使用类封装 (`LLMProviderManager`)
- **配置加载**: 统一通过 `config-loader.mjs` 合并 `.env` 和 `config.json`

### 错误分类 (MECE)
所有错误映射到 5 大类 13 种类型：
```
Grammar ──┬── Article Usage
          ├── Verb Tense
          ├── Subject-Verb Agreement
          ├── Preposition Usage
          └── (4 more...)
Vocabulary ──── Word Choice, Idiomatic Expression, Redundancy
Mechanics ──┬── Spelling, Punctuation, Capitalization
Style ──────┬── Phrasing, Conciseness, Tone & Register
Clarity ────┬── Sentence Fragment, Incomplete Thought, Ambiguity
```

### 日志机制
- 所有检查记录到 `ReviewPath` 指定的 Markdown 文件
- 带重试机制 (最多 2 次) 处理文件锁定
- 时间戳格式: `yyyy-MM-dd HH:mm:ss`
- SQLite 数据库用于结构化存储 (错误类型、频率分析)

### 提示词配置
所有 LLM 提示词集中在 `lib/igt_config.json` 的 `Prompts` 部分：
- `SystemPrompt`: 主语法检查行为
- `HandbookGrammarRulePrompt`: 手册中的语法规则解释
- `PracticeExercisePrompt`: 练习生成方式

## 架构关键点

### 数据流
```
用户输入 (PowerShell)
    ↓
igt.ps1 (主循环)
    ↓ stdin
lib/igt-bridge.mjs
    ├── LLM Provider Manager
    │   └── Task-Aware Model Router
    │       ├── Grammar → Flash ⚡
    │       └── Handbook/Practice → Pro 🏆
    ├── 错误解析器 + 分类器
    ├── SQLite 写入 (非阻塞)
    └── Markdown 日志
    ↓
学习工具 (handbook/practice/assess)
```

### 性能优化
- 配置加载: ~3ms
- 提示词构建: ~1ms
- LLM API 调用: ~1,500ms (网络限制)
- 数据库写入: ~5ms (异步、非阻塞)
- 日志记录: ~10ms

## 测试脚本
项目中包含多个测试脚本用于验证功能：
- `test_filtering.ps1` - 过滤功能测试
- `test_incremental.ps1` - 增量更新测试
- `test_prompt_config.ps1` - 提示词配置测试

## 文档资源
- `docs/PROJECT_DOCUMENT.md` - 完整项目文档
- `docs/multi-llm-support.md` - 多 LLM 支持指南
- `docs/config-separation.md` - 配置分离架构
- `docs/prompt-config-guide.md` - 提示词配置指南
- `docs/incremental-update-guide.md` - 增量更新指南
- `QUICKSTART_LLM.md` - LLM 快速入门
- `MIGRATION_GUIDE.md` - 配置迁移指南
