# ClearWrite — Write with clarity

[English](README.md) | [简体中文](README.zh.md)

ClearWrite 是 **IGT（Interactive Grammar Tool，互动语法工具）** 的本地 Web 应用，将英语写作反馈、表达辅导、词汇积累、中译英句子练习和语言答疑放在同一个工作空间中。IGT 同时提供命令行工具。

学习记录保存在本地 SQLite 数据库和 Markdown 文件中。使用在线 AI 提供商时，请求所需的文本会发送给该提供商；也可以通过 Ollama 在本机运行模型。

## 目录

- [快速开始](#快速开始)
- [Web 学习空间](#web-学习空间)
- [AI 提供商](#ai-提供商)
- [命令行工具](#命令行工具)
- [配置与本地数据](#配置与本地数据)
- [开发与验证](#开发与验证)
- [项目架构](#项目架构)
- [常见问题](#常见问题)
- [许可证](#许可证)

## 快速开始

准备 **Node.js 24 LTS**（项目的 Windows 环境使用 v24.13.1）、npm 和 Git。以下命令使用 PowerShell，在项目目录中执行。

### 1. 安装并配置

```powershell
git clone https://github.com/ievertan00/igt.git
Set-Location igt
npm install
Copy-Item .env.example .env
```

仅在首次安装时复制配置模板；已有的 `.env` 应保留。用文本编辑器打开它，配置 AI 提供商，例如：

```env
IGT_LLM_PROVIDER=gemini
GOOGLE_API_KEYS=your-api-key
```

Qwen、Deepseek 和 Ollama 的配置见 [AI 提供商](#ai-提供商)。API 密钥和本机配置放在 `.env` 中，该文件已被 Git 忽略。

### 2. 准备本地存储

```powershell
npm run init-db
```

此命令通过迁移创建或更新配置的 SQLite 数据库。Runtime 启动时也会应用待执行的迁移；已有安装更新后通常只需重启。

### 3. 打开 Web 应用

开发模式：

```powershell
npm run web:dev
```

此命令同时启动 Vite 和 Local Runtime。在浏览器中打开终端输出的 Web 地址。开发端口由 `.env` 中的 `IGT_WEB_PORT` 和 `IGT_DEV_API_PORT` 指定。

构建并在本机运行生产版本：

```powershell
npm run web:build
npm run web:start
```

Runtime 直接提供 `apps/web/dist` 中的页面，无需启动命令行交互界面。默认绑定 `127.0.0.1`；`IGT_SERVER_PORT=0` 表示选择可用端口。访问启动时输出的地址即可。

## Web 学习空间

| 页面入口 | 用途 |
| --- | --- |
| **Writing → Grammar** | 检查英语句子或完整篇章，比较纠正与润色结果，并围绕反馈继续追问。 |
| **Writing → Express** | 将中文想法表达为自然英语，或用中文理解英语篇章；可以补充语境和期望语气。 |
| **Vocabulary** | 查询英语单词或中文说法，阅读释义、例句，并保存词条用于复习。 |
| **Practice** | 将中文句子翻译成英语，逐步查看提示，再对照反馈和参考表达。 |
| **Ask** | 讨论语法、选词、语气和用法，保存单条回答或总结整段对话。 |
| **My learning → Overview** | 按类型查看已记录的学习活动和近期时间线。 |
| **My learning → Saved words** | 搜索和浏览 Markdown 词汇库、打开词条详情、开始词汇复习。 |
| **My learning → Saved notes** | 搜索已保存的 Ask 笔记，按分类和主题筛选，并继续讨论。 |
| **My learning → Handbook** | 按时间倒序浏览已保存的 Grammar 检查，支持搜索和错误类型筛选。 |
| **My learning → Coach** | 查看已保存 Grammar 检查中的常见错误，按需解释原因和语法规则。 |
| **Settings** | 配置模型和 Markdown 文件位置。 |

界面默认使用英语。**中文引导**为初学者提供操作说明，英语例句、目标表达和学习者内容保留原有语言。Ask 的 **Answer language** 和 **Note language** 分别控制新回答与对话总结的讲解语言。

### 写作与已保存的 Grammar 检查

Grammar 会处理整段提交内容，包括编号列表和项目符号列表。阅读纠正、润色和错误诊断后，选择 **Save to review log** 才会保留本次记录。仅生成反馈不会保存学习记录，也不会自动创建闪卡。

Handbook 展示已保存的 Grammar 检查，并单独标注来源未知的旧记录。Coach 只使用明确标记为 Grammar 的记录，不纳入 Practice、全文分析或来源未知的内容。**No diagnosed mistakes** 只表示本次没有诊断出错误，不能证明文本完全无误或已经持久掌握。

### 句子 Practice

Practice 从配置的 SQLite 题库选题，开始练习不依赖语法历史，也无需调用模型临时生成题目。提交翻译后，由 AI 进行评价。

- **难度：**`easy`、`standard`、`challenge`。
- **风格：**`casual`、`neutral`、`formal` 或 `all`。
- **场景：**`home`、`dining`、`shopping`、`entertainment`、`social`、`health`、`work`、`transit`、`travel`、`services` 或 `all`。
- **题量：**命令行接受 1–10 题；Web 提供 3 / 5 / 10 题选项。

同一轮内题目不重复，优先选取使用次数较少的题目；某个分类题量不足时会返回可用题目。检查答案前最多可逐步查看三层提示，提示使用情况会随作答记录保存。合理的其他译法无需与参考答案逐字一致。借助提示答对，不能证明已经能够独立运用。

### 词汇与复习

保存的词条以 Markdown 形式保留，浏览词汇库不会改变复习计划。词汇复习先要求回忆英语表达，再揭示答案，最后选择 **Again / Hard / Good / Easy**。选择评分才会保存本次复习和下次到期时间，仅揭示答案不会保存。

Local Runtime 启动时会将词汇 Markdown 同步到可重建的 SQLite SRS 卡片，并保留已有调度字段。Web 开始新复习时也会导入已保存词汇。输入答案的正确性与自行选择的回忆评分分别记录。

### Ask 笔记

保存由用户选择。可以将单条回答保存为 Markdown 笔记，也可以按选定的笔记语言总结整段对话。笔记包含分类和标签等元数据，便于检索。新笔记文件名使用生成的简体中文标题，保留必要的英语术语；标题语言与正文讲解语言相互独立。同名笔记会添加后缀，避免覆盖其他笔记。

## AI 提供商

在 `.env` 中选择提供商，在线服务还需填写相应密钥。模型名称和提示词位于 `igt_config.json`，环境变量中的模型设置优先。服务可用性、额度和计费取决于你的提供商账号。

| 提供商 | `.env` 设置 | 密钥管理 |
| --- | --- | --- |
| Google Gemini | `IGT_LLM_PROVIDER=gemini`、`GOOGLE_API_KEYS=...` | [Google AI Studio](https://aistudio.google.com/apikey) |
| 阿里云 Qwen | `IGT_LLM_PROVIDER=qwen`、`DASHSCOPE_API_KEYS=...` | [DashScope](https://dashscope.console.aliyun.com/apiKey) |
| Deepseek | `IGT_LLM_PROVIDER=deepseek`、`DEEPSEEK_API_KEYS=...` | [Deepseek 平台](https://platform.deepseek.com/api_keys) |
| 本地 Ollama | `IGT_LLM_PROVIDER=ollama` | 无需 API 密钥 |
| 自定义 OpenAI 兼容服务 | `IGT_LLM_PROVIDER=custom`、`IGT_CUSTOM_API_BASE=...`、`IGT_CUSTOM_API_KEYS=...` | 由所选服务管理 |

多个密钥可用英文逗号分隔。通过 Web **Settings** 或命令行 `/provider status` 查看配置。

自定义服务还需将 `IGT_CUSTOM_FLASH_MODEL` 和 `IGT_CUSTOM_PRO_MODEL` 设置为该接口支持的模型 ID，也可以在 Web Settings 中配置。

使用 Ollama 时，从 [ollama.com](https://ollama.com/download) 安装服务，下载适合本机的模型，并配置对应覆盖项：

```env
IGT_LLM_PROVIDER=ollama
IGT_OLLAMA_FLASH_MODEL=your-installed-model
IGT_OLLAMA_PRO_MODEL=your-installed-model
```

用 `ollama list` 查看已安装模型。服务未运行时，在单独的终端中执行 `ollama serve`。本地推理需要足够的内存，较大的模型还可能需要 GPU 资源。

## 命令行工具

在项目目录运行：

```powershell
node igt.mjs
```

也可以先执行一次 `npm link`，注册全局 `igt` 命令。在提示符后输入英语句子即可检查语法；CLI 会询问是否保存到复习日志。

| 命令 | 用途 |
| --- | --- |
| `/word <word or phrase>`（`/w`、`/a`） | 查询词汇，并选择是否保存。 |
| `/word --list` | 浏览已保存词汇。 |
| `/word review [1-100]` | 使用四档回忆评分复习词汇。 |
| `/practice [1-10]`（`/p`） | 开始中译英句子练习。 |
| `/text` | 打开编辑器并分析完整文档。 |
| `/translate <text>`（`/tr`） | 翻译文本。 |
| `/ask` | 进行语言咨询，可选择保存。 |
| `/chat` | 进行英语对话，获得温和纠错。 |
| `/handbook`（`/h`） | 浏览和筛选已保存的 Grammar 检查。 |
| `/coach` | 分析常见 Grammar 错误，按需请求解释。 |
| `/stats`（`/st`） | 查看已记录活动和时间线。 |
| `/provider status` | 查看提供商和模型配置。 |
| `/provider switch <provider>` | 切换 AI 提供商。 |
| `/voice [on\|off\|status]` | 控制对话自动语音。 |
| `/theme` | 选择终端主题。 |
| `/help` | 查看当前公开命令说明。 |
| `/exit`（`/quit`、`/q`） | 退出命令行工具。 |

在 IGT 提示符后输入，例如：

```text
/word follow up
/practice 5 --difficulty easy --context home
/practice sentence 3 --style formal --context work
/handbook --days 90 --search "meeting" --type "Articles"
/handbook --diagnosis none
/coach --days 90 --type "Articles"
/stats --days 30 --limit 10
```

兼容入口包括：`/today` 查看当日活动和待复习数量，`/explain`（`/e`）讨论最近一次纠正，以及 `/llm` 作为 `/provider` 的别名。主要命令以 `/help` 为准。处理完整文档时，可用 `/text` 打开编辑器。

## 配置与本地数据

[.env.example](.env.example) 提供带注释的配置模板。修改启动相关设置后，请重启对应进程。

| 设置 | 用途 |
| --- | --- |
| `IGT_DB_PATH` | 主 SQLite 数据库，包含 Practice 题目、作答记录和 SRS 调度。 |
| `IGT_GRAMMAR_REF_DB_PATH` | Ask 使用的本地语法参考数据库。 |
| `IGT_LOG_PATH` | 技术和数据库错误日志。 |
| `IGT_REVIEW_PATH` | 用户明确保存的 Grammar 检查 Markdown 日志。 |
| `IGT_DATA_DIR` | 可选的统一数据目录，具体路径设置优先。 |
| `IGT_VOCAB_PATH` | 明确指定词汇 Markdown 路径。 |
| `IGT_ASK_PATH` | 明确指定 Ask 笔记路径。 |
| `IGT_PRACTICE_PATH` | 明确指定 Practice Markdown 日志路径。 |
| `IGT_VAULT_DIR` | 可选的 Obsidian 仓库根目录。 |
| `IGT_SERVER_HOST`、`IGT_SERVER_PORT` | 生产 Runtime 监听设置。 |
| `IGT_DEV_API_PORT`、`IGT_WEB_PORT` | 开发 API 和 Web 端口。 |

旧的仓库相对路径配置仍可在 `.env.example` 中查阅。Markdown 导出是用户可直接阅读的学习记录；SQLite 管理词汇复习调度和作答记录。Practice 题目内容以实际配置的数据库为准，`canonical-questions.json` 是其版本化导出，不要用测试库或历史种子替换真实数据。

移动数据或修复迁移前，请同时备份数据库和 Markdown 记录。复制 SQLite 数据库前应停止使用它的进程，避免已提交的数据仍留在 WAL 文件中。

### 可选语音

CLI 对话语音使用兼容 OpenAI `/v1/audio/speech` 协议的服务。通过 `IGT_TTS_BASE_URL` 配置地址，其他音色、模型、流式播放和适配器设置见 `.env.example`，其中提供 Kokoro 和 CosyVoice3 适配方案。通过 `ffplay` 流式播放需要安装 FFmpeg。Web 音频控件在服务音频失败时可尝试浏览器语音。应用不录音，也不评估发音。

## 开发与验证

```powershell
npm run web:typecheck
npm run web:build
npm run test:learning
npm run test:my-learning
npm run verify-learning-resources
```

按需运行 Web 与 Runtime 检查：`test:web-dev`、`test:runtime`、`test:static`、`test:web`、`test:my-learning-web`、`test:handbook-web`、`test:practice-web`、`test:coach-cache`、`test:vocabulary-sync`、`test:review-log-contract` 和 `test:config-paths`。浏览器检查需要可用的 Chromium，必要时设置 `PUPPETEER_EXECUTABLE_PATH`。项目没有单一的全套测试脚本。

修改 Practice 内容前，先阅读[存储约定](lib/features/practice/SCHEMA.md)，并在修改前后运行 `npm run verify:practice-bank`。通过 `npm run export:practice-bank` 明确导出已批准的真实题库修改。测试数据库应保持可丢弃，不得覆盖实际内容。

若只重启 API/UI，并希望跳过启动时的词汇同步：

```powershell
node scripts/web-dev.mjs --skip-vocabulary-sync
```

生产入口 `node apps/local/server.mjs` 也支持此参数。Web 开始新复习时仍会导入已保存词汇。

## 项目架构

React Web 客户端和 CLI 调用同一个本地 HTTP Runtime。Runtime 负责模型请求、迁移、SQLite 持久化和 Markdown 工作流。

| 位置 | 职责 |
| --- | --- |
| `igt.mjs`、`lib/cli/` | 命令行交互、命令分发、渲染和 API 客户端。 |
| `apps/web/` | 使用 Vite 构建的 React + TypeScript 客户端。 |
| `apps/local/server.mjs` | 独立 Local Web Runtime 入口。 |
| `lib/server/` | HTTP 路由和 LLM 提供商集成。 |
| `lib/application/` | 应用工作流，包括 Grammar 分析与保存。 |
| `lib/domain/`、`lib/features/` | 学习规则、解析和功能工作流。 |
| `lib/db/`、`migrations/` | SQLite 访问和结构、数据迁移。 |
| `lib/shared/` | 配置与共享工具。 |
| `scripts/`、`tests/` | 维护工具和验证。 |

## 常见问题

- **开发端口被占用：**修改 `.env` 中的 `IGT_DEV_API_PORT` 或 `IGT_WEB_PORT`，然后重启 `web:dev`。
- **生产页面无法打开：**先执行 `web:build`，再执行 `web:start`，并访问 Runtime 输出的地址。
- **提供商报错或限流：**检查密钥、模型配置和提供商状态，在服务允许时重试。
- **Handbook 或 Coach 中没有某次 Grammar：**先将结果保存到复习日志；Coach 还会排除来源未知的旧记录。
- **数据库锁定或迁移失败：**关闭占用数据库的进程，查看配置的错误日志，并在修复前保留备份。删除数据库会丢失本地状态，不应作为常规修复步骤。
- **缺少语法参考资源：**运行 `npm run verify-learning-resources` 查看报告；`init-db` 准备的是主数据库，不会安装外部参考语料。

## 许可证

Apache 2.0
