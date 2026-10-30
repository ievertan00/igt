# 互动语法工具（IGT）

一款面向日常生活与工作沟通的命令行英语学习工具。你可以检查写作、理解纠错、积累词汇、听读跟练、练习对话，并通过间隔复习巩固所学表达。

![语法检查截图](assets/1.jpg)

---

## 目录

- [连贯的学习流程](#连贯的学习流程)
- [开始前的准备](#开始前的准备)
- [安装步骤（逐步说明）](#安装步骤逐步说明)
- [数据库初始化与迁移](#数据库初始化与迁移)
- [配置 AI 提供商](#配置-ai-提供商)
  - [方案 A — 在线 AI（Gemini、Qwen、Deepseek）](#方案-a--在线-aigeminiqwendeepseek)
  - [方案 B — 本地 AI（Ollama，无需 API 密钥）](#方案-b--本地-aiollama无需-api-密钥)
- [功能详解](#功能详解)
- [命令列表](#命令列表)
- [配置参考](#配置参考)
- [架构说明](#架构说明)
- [许可证](#许可证)

---

## 连贯的学习流程

用 `/help` 按学习活动查找命令，或用 `/today` 查看待复习数量并选择一项练习。

1. **学一个表达：**输入 `/add follow up`，查看释义、搭配和例句，自行决定是否保存。
2. **听读跟练：**输入 `/listen` 播放最近的英文表达；查词后会播放英文词条及第一条可用例句。跟读后，试着自己造句。也可以用 `/listen <英文>` 指定内容，用 `/listen --stop` 停止播放。
3. **实际使用：**直接输入日常记录或工作消息，例如 “I will follow up with the client tomorrow.”，用 `/explain` 理解纠错。也可以先翻译中文，再播放英文译文。
4. **情境对话：**进入 `/chat`，输入 “Help me practise asking a colleague for clarification.”。对话内支持 `/voice on`、`/voice off`、`/voice status`、`/listen` 和 `/exit`，这些命令不会发送给模型。
5. **之后复习：**用 `/word 5` 回忆词汇，用 `/quiz 3` 根据错误记录练习新的中译英题目。

`/listen` 也能播放最近的纠正句、翻译中的英文、Quiz 推荐表达、对话回复或已揭示的复习答案。关闭对话自动语音后仍可按需播放，沿用现有 TTS 配置。跟读属于自主练习；IGT 不录音，也不评估发音。

## 开始前的准备

运行 IGT 之前，需要在电脑上安装以下两个程序。

### 1. Node.js

Node.js 是一个能在浏览器之外运行 JavaScript 代码的程序。IGT 就是用它构建的。

- 前往 **https://nodejs.org**，下载左边的 **LTS** 版本。

- 运行安装程序，一路点击默认选项即可。

- 安装完成后，打开终端（Windows 下是命令提示符或 PowerShell，Mac/Linux 下是终端），验证安装是否成功：
  
  ```
  node --version
  ```
  
  应该显示类似 `v22.0.0` 的内容。18 及以上的任何版本均可。

### 2. Git

Git 是用于从网上下载和管理代码的工具。

- 前往 **https://git-scm.com/downloads**，下载适合你系统的安装包。

- 运行安装程序，保持默认设置。

- 验证安装：
  
  ```
  git --version
  ```
  
  应该显示类似 `git version 2.44.0` 的内容。

---

## 安装步骤（逐步说明）

打开终端，按以下步骤逐一执行。

**第 1 步 — 下载代码**

```sh
git clone https://github.com/ievertan00/igt.git
```

这会在当前目录下创建一个名为 `igt` 的文件夹。

**第 2 步 — 进入文件夹**

```sh
cd igt
```

**第 3 步 — 安装依赖**

```sh
npm install
```

这会下载 IGT 所需的第三方库（放在 `node_modules` 文件夹中）。可能需要一分钟。

**第 4 步 — 创建配置文件**

```sh
# Windows（PowerShell）：
Copy-Item .env.example .env

# Mac/Linux：
cp .env.example .env
```

这会创建你的私有 `.env` 文件，用来填写 API 密钥。

**第 5 步 — 填写 API 密钥**

用任意文本编辑器（记事本、VS Code 等）打开 `.env` 文件，填入至少一个 API 密钥。获取密钥的方法见[配置 AI 提供商](#配置-ai-提供商)。

**第 6 步 — 初始化数据库**

```sh
node scripts/init-db.mjs
```

这会创建本地 SQLite 数据库，用于保存你的语法记录、闪卡和学习进度。

**第 7 步 — 注册全局命令（可选，但推荐）**

```sh
npm link
```

完成后，你可以在任意目录的任意终端中输入 `igt` 来启动工具。只需执行一次。

**第 8 步 — 启动 IGT**

```sh
igt
```

如果跳过了第 7 步，可以直接运行：

```sh
node igt.mjs
```

看到类似 `gemini-2.5-flash ❯` 的提示符后，就可以开始输入句子了。

---

## 数据库初始化与迁移

IGT 使用本地 SQLite 数据库（`igt_data.db`）来存储你的学习进度。数据库通过迁移系统进行管理，以确保随着新功能的增加，数据库结构始终保持最新。

### 首次设置

在第一次运行 IGT 时，你必须初始化数据库：

```sh
node scripts/init-db.mjs
```

该操作将：

1. 如果数据库文件不存在，则创建它。
2. 应用核心模式（会话、输入、诊断等表格）。
3. 植入初始状态栏消息（提示、事实、语录）。

### 自动更新

每次启动 IGT 时，服务器会自动检查是否有缺失的迁移并应用它们。通常情况下，你不需要再次运行 `init-db.mjs`，除非你正在进行故障排除或手动删除了数据库文件。

### 故障排除

- **"Database is locked"**（数据库已锁定）：这通常是因为有多个 IGT 实例正在运行，或者另一个工具正在访问 `.db` 文件。请关闭所有实例后再试。
- **迁移错误**：如果迁移失败，IGT 会将错误记录在 `igt_db_error.log` 中。你可以安全地删除 `.db` 文件并运行 `node scripts/init-db.mjs` 从头开始（注意：这会抹除你的所有历史记录）。

---

## 配置 AI 提供商

IGT 支持两种使用方式：在线 AI 服务（需要免费 API 密钥）或在本地运行的 AI 模型（无需密钥）。

---

### 方案 A — 在线 AI（Gemini、Qwen、Deepseek）

以下三个服务都有免费额度，选一个开始即可。

#### Google Gemini（推荐新手首选——免费额度最大方）

1. 前往 **https://aistudio.google.com/apikey**，用 Google 账号登录。

2. 点击 **Create API key（创建 API 密钥）**。

3. 复制密钥（以 `AIza…` 开头）。

4. 打开 `.env` 文件，粘贴密钥：
   
   ```env
   GOOGLE_API_KEYS=AIzaSyYourKeyHere
   IGT_LLM_PROVIDER=gemini
   ```

5. 保存文件，启动 `igt`。

> 可以用英文逗号分隔多个 Gemini 密钥（`key1,key2`）——当某个密钥触发限流时，IGT 会自动切换到下一个。

---

#### 阿里云百炼（通义千问 / DashScope）

1. 前往 **https://dashscope.console.aliyun.com/apiKey**，注册并登录阿里云账号。

2. 创建 API Key 并复制。

3. 打开 `.env` 填入：
   
   ```env
   DASHSCOPE_API_KEYS=sk-YourKeyHere
   IGT_LLM_PROVIDER=qwen
   ```

4. 保存并启动 `igt`。

---

#### Deepseek

1. 前往 **https://platform.deepseek.com/api_keys**，注册账号。

2. 创建 API Key 并复制。

3. 打开 `.env` 填入：
   
   ```env
   DEEPSEEK_API_KEYS=sk-YourKeyHere
   IGT_LLM_PROVIDER=deepseek
   ```

4. 保存并启动 `igt`。

---

#### 运行中切换提供商

无需重启即可切换。在 `❯` 提示符处输入：

```
/gemini      → 切换到 Gemini
/qwen        → 切换到 Qwen
/deepseek    → 切换到 Deepseek
/ollama      → 切换到本地 Ollama
/llm status  → 查看当前提供商及已配置的密钥
```

---

### 方案 B — 本地 AI（Ollama，无需 API 密钥）

Ollama 让 AI 模型完全在你自己的电脑上运行。语法检查无需联网，没有使用限制和费用。代价是需要一台配置尚可的电脑，首次配置也需要几分钟。

**系统要求：** 最低 8 GB 内存，推荐 16 GB。独立 GPU 会显著提升速度，但不是必须的。

#### 第 1 步 — 安装 Ollama

前往 **https://ollama.com/download**，下载对应系统的安装包。Windows 运行 `.exe` 安装程序，Mac 将应用拖入 Applications，Linux 执行网站上的 shell 脚本。

验证安装：

```sh
ollama --version
```

#### 第 2 步 — 下载模型

IGT 内置两套可随时切换的本地模型家族——**Gemma 4**（谷歌）和 **Phi-4**（微软出品，14B 参数——质量好，8 GB 内存可运行）。拉取你想用的那套即可：

```sh
ollama pull gemma4:12b   # 默认家族
ollama pull phi4         # 备选家族
```

每套模型体积数 GB，只需下载一次。在 IGT 中用 `/gemma` 和 `/phi` 实时切换家族。要让某个家族指向别的模型，编辑 `igt_config.json` 中对应的 `Ollama*Model` 字段（运行 `ollama list` 可查看本地已安装的模型）。

#### 第 3 步 — 配置 IGT 使用 Ollama

打开 `.env` 文件，设置：

```env
IGT_LLM_PROVIDER=ollama
```

Ollama 无需 API 密钥。

#### 第 4 步 — 启动 Ollama 和 IGT

Ollama 通常会在系统启动时自动运行。如果没有，手动启动：

```sh
ollama serve
```

然后在新的终端窗口中：

```sh
igt
```

提示符会显示当前使用的模型（例如 `gemma4:12b ❯`）。首次请求可能需要 10–20 秒加载模型，之后的请求会更快。

---

## 功能详解

### 语法检查

在提示符处输入任意英语句子并按回车。IGT 将其发送给 AI，返回结构化分析：纠错、更地道的改写、按错误类型分类的诊断、语法规则和学习 tip。含多处错误的复杂句子一次处理完毕，每处错误独立诊断。

![单个错误示例](assets/01_grammar_check.png)

![多处错误示例](assets/02_multiple_errors.png)

如果句子没有错误，IGT 会确认并解释原因——它不会捏造问题。

每次检查都会自动保存到本地数据库，并生成一张闪卡。

### 翻译（`/translate` 或自动识别）

自然地将中文文本翻译成英文。IGT 会在主提示符处自动识别中文输入，并将其发送到翻译引擎，提供包含细微差别注释和地道表达的翻译。也可以使用 `/translate <文本>`（别名：`/tr <文本>`）。

![翻译截图](assets/06_translate.png)

### 语法咨询 (`/ask`)

进行多轮英语语法咨询。IGT 通过原生函数调用查询其本地参考数据库 (`grammar_ref.db`)，提供带有来源引用的可靠解答。同一对话线程中的追问会携带上下文。

![/ask 截图](assets/08_ask.png)

退出会话时，IGT 会询问是否保存。选择保存后，整个对话线程会被压缩为一份完整的 Markdown 摘要，以带日期的条目形式追加到笔记库的 `03_Consultations.md` 文件中，可直接在 Obsidian、Typora 或任何 Markdown 编辑器中阅读。

![Ask log 截图](assets/09_ask_log.png)

### 对话练习（`/chat`）

用聊天的方式练习英语。`/chat` 会开启一个自由对话伙伴，围绕你提起的任何话题自然交谈，并用追问推动对话继续——它不会把每句回复都变成语法课。在你每次发言后，它只检查你写的内容中的真实错误，并列出温和的纠正（原文 → 地道说法 → 一句友好说明），不打断对话流。

回复还可以选择朗读出来，用 `/voice` 开关语音。朗读需要本地文本转语音服务——详见[配置参考](#配置参考)中的 TTS 说明。

### 解释纠正（`/explain`）

对某处纠正不太明白？运行 `/explain`（别名 `/e`），IGT 会开启一个 `/ask` 对话，并预先载入你上一句话、它的纠正以及诊断出的错误——无需重新输入即可深入探究「为什么」。可以附上具体问题（`/explain 为什么这里要用 "the"？`），也可以直接运行获取整体讲解。

### 状态栏与提示

每次检查后，状态栏都会从 300 多个条目中随机显示一条消息，包括：

- **提示 (Tips)**：了解类似 `/undo` 或 `/refine` 等隐藏功能。
- **语法事实 (Grammar Facts)**：关于英语历史和规则的有趣冷知识。
- **语录 (Quotes)**：来自语言学家和作家的启发性话语。

### 多行输入

输入长段落或多句话时，用 `"""` 进入多行模式：

```
❯ """
在这里输入你的文字。
在新的一行输入 """ 提交。
"""
```

### 词汇间隔重复闪卡复习（`/word review`）

每个错误都会生成一张闪卡。SM-2 算法负责调度每张卡片：答对了复习间隔会延长（1 天 → 4 天 → 10 天……），答错了则重置为明天。答案以 **diff 高亮**方式展示——修改的词标绿，一眼看出差在哪里。随着时间推移，已掌握的错误类型不再出现。

![词汇复习截图](assets/04_review.png)

系统优先进行完全匹配判断。如果你的答案措辞不同但语义正确，会由 AI 快速裁定是否接受。

### 每日计划（`/today`）

展示当天检查的句子、新增词汇以及复习过的语法和词汇卡片；即使当天没有检查句子，也会展示词汇学习记录。待复习数量分别统计两个卡组，并提供适用于日常生活与工作沟通的听读、写作和对话建议。

有卡片待复习时，输入 `g` 复习五张语法卡，输入 `w` 复习五张词汇卡，直接回车稍后再练。数量统计 SQLite 中已有的卡片；`/word` 还会导入词汇笔记中的新词。

`/today` 保留复习入口，不再创建教练计划或显示计划任务。

### 学习概况 (`/stats`)

Web Overview 与 `/stats` 按活动类型汇总已保存的学习记录，并展示最近活动时间线。语法检查、句子练习、词汇复习、词汇保存和 Ask 笔记分别计数，不合并为掌握度分数。没有持久记录的翻译、跟读和对话不计入历史；缺少日期或读取失败的来源会单独说明。

```text
/stats --days 30 --limit 10
/stats --days 0 --offset 10
```

### 个性化中译英测验 (`/quiz`)

`/quiz` 使用与个人错误手册相同的真实错误记录，围绕你反复出现的语法弱点生成新的中文句子。你用英文作答后，系统会接受合理的不同表达，并逐题给出分数、建议表达和中文反馈。

```text
/quiz                 # 使用最近 30 天记录，默认 5 题
/quiz 10              # 生成 10 题
/quiz 5 --days=0      # 使用全部历史错误记录
```

### 语法检查记录 (`/handbook`)

Handbook 仅展示主动保存的 Grammar 检查，按时间倒序排列，保留原文、纠正、解释与日期。支持搜索、错误类型、时间范围和“无诊断错误”筛选。一条检查只显示一次，即使包含多个诊断；没有诊断不代表已掌握或完全无误。来源不明的旧记录原样保留，但不会冒充 Grammar 检查。

```text
/handbook
/handbook --search "a book" --days 0
/handbook --type "Articles" --limit 10 --offset 0
/handbook --diagnosis none
```

### 常见错误分析 (`/coach`)

Coach 仅从已保存的 Grammar 检查识别重复错误。至少两条不同检查包含同类问题时才显示为重复模式。默认列出模式；选择模式后才请求模型解释可能原因、正确语法规则、适用范围和例外，并展示可回查的原始例句。原因属于假设，不能据此判断心理原因或整体英语水平。

```text
/coach --days 90
/coach --type "Articles" --days 90
/coach --type "Articles" --refresh
```

旧 `/handbook` 报告生成、缓存管理选项及 `/coach` 计划和任务选项已被替换，`/plan` 别名已移除。已有报告、计划和学习记录不会删除。查看全部参数请使用 `--help`。

### 产出练习 (`/practice`)

`/practice` 专门练习句子和表达的主动产出，在不同日常和工作场景中写出完整英文。多选题改用独立命令 `/drill`（别名 `/mc`）。

```
❯ /practice

Exercise 1 of 10  [Verb Tense]
By the time she arrived, we _____ dinner.
  A) finish       B) have finished
  C) had finished D) were finishing

Your answer: C

✓ Correct — "had finished" (past perfect) is needed because the finishing happened
  before another past event ("arrived").
```

可以选择产出模式：

```
❯ /practice
❯ /practice sentence 5
❯ /practice expression 5
```

多选题练习使用独立命令：

```
❯ /drill --type "Verb Tense"
❯ /drill B2 10
```

或在命令行中运行：

```sh
node tools/igt-practice.mjs --count=15
node tools/igt-practice.mjs --type "Article Usage"   # 针对特定错误类型
```

### 词汇查询（`/add`）

查询任意单词并保存到本地 Markdown 词汇库，用 `/vocab` 随时复习。

![/add 和 /vocab 截图](assets/07_vocab.png)

### 撤销（`/undo`）

输错了内容，不想让它出现在闪卡库里？撤销最后一条记录：

```
❯ /undo
Delete last 1 input and all associated cards? [y/n] y
✓ Removed.
```

用 `/undo 3` 可撤销最近的 3 条输入。

---

## 命令列表

启动 IGT 后，所有命令以 `/` 开头。多数命令带有简写别名（括号内标出）。

| 命令                   | 说明                              |
| -------------------- | ------------------------------- |
| `/word review`       | 间隔重复复习——逐一训练今日到期的词汇闪卡           |
| `/word` (`/w`)       | 查询、保存和 SRS 复习词汇；`/word --list` 浏览词汇 |
| `/vocab-test` (`/vtest`) | 完整词汇测试，在真实场景中使用词汇 |
| `/today` | 语法与词汇待复习数量，以及听读、写作和对话建议 |
| `/stats` (`/st`) | 各类已记录学习活动的概况和时间线 |
| `/handbook` (`/h`) | 按时间浏览、搜索和筛选已保存的语法检查 |
| `/coach` | 常见语法错误分析，按需解释可能原因和语法规则 |
| `/practice` (`/p`)   | 在不同场景中练习句子和表达的主动产出            |
| `/drill` (`/mc`)     | 按级别或错误类型进行多选题语法练习              |
| `/quiz [1-10]`       | 根据错误手册记录进行中译英测验，并逐题获得中文反馈        |
| `/ask`               | 开启多轮语法咨询对话（可选保存）                |
| `/chat`              | 自由对话练习，附带温和纠错（可选语音朗读）           |
| `/explain` (`/e`)    | 在 `/ask` 对话中解释你最近一次的语法纠正        |
| `/translate` (`/tr`) | 中英互译（自动识别翻译方向）                  |
| `/add <单词>` (`/a`)   | 查询一个或多个（逗号分隔）单词并保存到词汇库          |
| `/retry`             | 用同一模型重新处理上一条输入                  |
| `/undo [N]` (`/u`)   | 删除最后 N 条输入及其关联闪卡（默认 1 条）        |
| `/voice [on\|off\|status]` | 控制对话自动语音，在 `/chat` 内也可使用 |
| `/listen [英文]` | 播放最近的英文表达或指定内容；`--stop` 停止播放 |
| `/gemini`            | 切换到 Google Gemini               |
| `/qwen`              | 切换到阿里云 Qwen                     |
| `/deepseek`          | 切换到 Deepseek                    |
| `/ollama`            | 切换到默认的本地 Ollama 模型             |
| `/phi`               | 切换到本地 Phi-4（Ollama）             |
| `/gemma`             | 切换到本地 Gemma 4（Ollama）           |
| `/llm status`        | 显示当前提供商、已配置密钥和模型名称              |
| `/theme`             | 切换 UI 颜色主题                      |
| `/help`              | 显示命令参考                          |
| `/exit` (`/q`)       | 退出（会先显示本次会话摘要）                  |

**快捷键：**

- `↑` / `↓` — 浏览输入历史
- `Ctrl+C` — 清空当前输入，返回提示符（不退出程序）
- `"""` — 进入多行输入模式

---

## 配置参考

IGT 使用两个配置文件：

| 文件                | 是否纳入 git | 用途                 |
| ----------------- | -------- | ------------------ |
| `.env`            | 否        | API 密钥、文件路径、主题（私有） |
| `igt_config.json` | 是        | 模型名称、提示词（共享）       |

### `.env`（常用设置）

随附的 `.env.example` 是带完整注释的模板——复制它并按需填写即可。最常用的设置如下：

```env
# --- AI 提供商密钥 ---
GOOGLE_API_KEYS=key1,key2        # 逗号分隔；触发限流时自动轮换
DASHSCOPE_API_KEYS=your-key      # Qwen / 阿里云百炼
DEEPSEEK_API_KEYS=your-key       # Deepseek
IGT_LLM_PROVIDER=gemini          # gemini | qwen | deepseek | ollama

# --- 模型覆盖（可选；按提供商覆盖 igt_config.json） ---
IGT_GEMINI_FLASH_MODEL=          # 例如 gemini-2.5-flash
IGT_QWEN_PRO_MODEL=              # 例如 qwen-plus、qwen-max
IGT_OLLAMA_FLASH_MODEL=          # 例如 phi4、gemma4:12b

# --- 文件路径与设置 ---
IGT_DB_PATH=igt_data.db          # SQLite 数据库（首次运行自动创建）
IGT_LOG_PATH=igt_db_error.log    # 后台错误日志
IGT_GRAMMAR_REF_DB_PATH=grammar_ref.db # 用于 /ask 的语法参考数据库
IGT_THEME=auto                   # auto | light | dark；只改变语义颜色，不改变终端背景
IGT_REVIEW_PATH=                 # 可选：Markdown 格式的纠正记录日志路径
IGT_REPORT_PATH=                 # 手册报告的导出文件夹

# --- Obsidian 集成（可选） ---
IGT_VAULT_DIR=                   # Obsidian 仓库根目录
IGT_VOCABULARY_FILE=             # 仓库内的词汇笔记路径
IGT_PRACTICE_FILE=               # 仓库内的练习日志路径
IGT_ASK_FILE=                    # 仓库内的 /ask 咨询日志（单文件）
IGT_ASK_DIR=                     # 仓库内的 /ask 独立笔记目录

# --- 文本转语音（可选；/chat 语音、/word review [a]） ---
IGT_TTS_BASE_URL=http://localhost:8880  # 兼容 OpenAI 的 /v1/audio/speech 服务
IGT_TTS_SIDECAR=                 # 需自动启动的适配器脚本（留空 = 无）
IGT_TTS_STREAM=false             # 低延迟 ffplay 流式播放（需 ffmpeg）
IGT_TTS_VOICE=                   # 可选；默认 af_heart
IGT_TTS_MODEL=                   # 可选；默认 kokoro
```

> **文本转语音。** `/chat` 的语音朗读（以及 `/word review` 中的 `[a]` 键）需要一个讲 OpenAI `/v1/audio/speech` 协议的本地 TTS 服务，可在 `IGT_TTS_BASE_URL` 处访问。支持两种后端：
>
> - **Kokoro**（默认）——原生兼容 OpenAI、内置预设音色的服务（[Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI)，端口 `8880`），无需适配器。
> - **CosyVoice3**——克隆参考音色（支持跨语言）。它运行在一个本地小型 shim（`tools/cosyvoice-tts-shim.mjs`，通过 `IGT_TTS_SIDECAR` 自动启动）之后，该 shim 前置一个 CosyVoice Docker 容器。配置见 `.env.example` 中的 CosyVoice 配置段与 `tools/cosyvoice/`。
>
> 在 `.env` 中切换启用哪套配置即可更换后端，然后重启 `igt`。若无可用服务，IGT 会打印一次性提示并保持静音，不影响文字输出。用 `/voice` 开关语音。

### `igt_config.json`（摘要）

```json
{
  "LLMProvider": "gemini",
  "GeminiFlashModel": "gemini-2.5-flash",
  "GeminiProModel": "gemini-2.5-pro",
  "QwenFlashModel": "qwen-turbo",
  "QwenProModel": "qwen3.6-plus",
  "DeepseekFlashModel": "deepseek-v4-flash",
  "DeepseekProModel": "deepseek-v4-pro",
  "OllamaBaseUrl": "http://localhost:11434",
  "OllamaFamily": "gemma",
  "OllamaGemmaFlashModel": "gemma4:12b"
}
```

Flash 模型负责语法检查（速度优先）；Pro 模型负责手册和练习生成（质量优先）。Ollama 使用已配置的 Gemma 模型家族。要更换本地模型，修改对应的 `Ollama*Model` 字段——运行 `ollama list` 可查看本地已安装的模型。

所有 LLM 提示词存放在 `igt_config.json` 的 `Prompts` 部分，直接在那里编辑，无需改动源码。

---

## 架构说明

`igt.mjs`（交互主循环）在启动时会衍生一个持久化 HTTP 服务器（`lib/server/index.mjs`），监听端口 `18964`。每次语法检查都是一个 HTTP POST 请求到 `http://127.0.0.1:18964/grammar`，服务器返回结构化 JSON，由客户端负责渲染输出。

```
igt.mjs  ──POST /grammar──►  lib/server/index.mjs
                                    │
                          runMigrations()（启动时执行）
                          LLMProviderManager
                          ┌──────┬──────┬──────────┬────────┐
                       Gemini  Qwen  Deepseek  Ollama   ← 语法检查用 Flash 模型
                                                          手册生成用 Pro 模型
                                    │
                          parseDiagnosis() → SQLite（非阻塞）
                                    │
                          {data, perf} ◄── igt.mjs 带颜色渲染输出
```

代码库按领域驱动模块组织在 `lib/` 目录下：

- `lib/cli/` — CLI 特定逻辑、UI 渲染和命令路由。
- `lib/domain/` — 核心业务逻辑（间隔重复、掌握度跟踪、解析）。
- `lib/features/` — 特定功能逻辑（如手册生成）。
- `lib/server/` — HTTP 服务器、路由和 LLM 提供商逻辑。
- `lib/shared/` — 共享工具（如配置加载器）。

持久化服务器避免了每次请求重新启动 Node.js 的开销——典型语法检查耗时约 1.5 秒，相比冷启动方式的约 9.9 秒提升了 83%。

---

## 许可证

Apache 2.0
