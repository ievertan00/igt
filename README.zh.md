# ClearWrite · 本地 AI 英语写作与学习

[English](README.md) · **简体中文**

> **用自己的句子，学英语母语者怎么表达。** ClearWrite 用本地 AI 帮你写出自然、得体的英文，并解释在这个场合为什么这样说。

## 目录

[1. 产品是什么](#1-产品是什么) · [2. 功能总览](#2-功能总览) · [3. 功能详解](#3-功能详解) · [4. 一次完整的学习闭环](#4-一次完整的学习闭环) · [5. 三种使用形态](#5-三种使用形态) · [6. 学习记录与隐私](#6-学习记录与隐私) · [7. 快速开始](#7-快速开始) · [8. 命令行速查](#8-命令行速查) · [9. 相关文档与许可证](#9-相关文档与许可证)

---

## 1. 产品是什么

ClearWrite 是一款以真实写作为起点的 AI 英语学习工具。你正在写的邮件、消息和文档，就是最贴近你需求的学习材料。每次写到卡住的地方，都是一次弄清词该怎么搭、句子该怎么组织的机会。

同一个意思，写给不同的人，措辞和语气会跟着变。AI 帮你理解英语母语者在类似场合会怎样措辞，以及不同写法会传达怎样的语气。你决定哪种表达最符合自己的意思。今天理解的一个搭配或句式，下次换个场合也能自己用。

真实写作往往带有私人或工作信息，因此 ClearWrite 采用本地优先的设计。你可以用本地大模型处理草稿，也由你决定哪些内容值得留下。

**学习资料属于你。** 大部分学习资料，包括你保存的单词、写作修改、笔记和练习日志，都以 Markdown（`.md`）文件保存在你的电脑上。只要保留这些文件，即使 ClearWrite 停止维护，你也能用普通文本编辑器打开、整理和继续使用它们。

---

## 2. 功能总览

| 模块 | Web 入口 | 核心能力 | 对英语学习的帮助 |
| --- | --- | --- | --- |
| 写作与表达 | **Writing → Refine / Express** | 整段语法反馈、可选润色、错误诊断、就地追问、中英双向表达 | 从「被改对」到「知道为什么」，并把修改留在自己的原句里 |
| 词汇与记忆 | **Vocabulary / Review / Saved words** | 英汉双向查词、保存词条、主动回忆 + 四档评分的间隔复习 | 区分「查过」和「用得出来」，让词条按记忆状态回到眼前 |
| 句子产出 | **Practice** | 本地题库中译英、难度与场景筛选、三层渐进提示、作答评价 | 练「从意思到句子」的主动产出，并分辨独立写对与借助提示写对 |
| 问答与笔记 | **Ask / Saved notes** | 用法追问、举例、保存单条回答或整段对话为结构化笔记 | 把零散疑问沉淀成带分类和主题、可反复检索的个人语料 |
| 学习记录与诊断 | **My learning**（Overview / Saved words / Saved notes / Handbook / Learning reports） | 库存与趋势、按错误类型筛选、基于真实记录的 Coach 报告 | 把「我好像总错冠词」变成可核对的记录，决定下一步练什么 |
| 设置与辅助 | **Settings**、划词查词、语音朗读 | 模型与 Markdown 位置配置、选中英文即可查词、可选朗读 | 降低操作成本，让注意力留在语言本身 |
---

## 3. 功能详解

### 3.1 写作与表达 · Writing

**Writing → Refine** 支持单句，也支持整篇内容（分段、编号列表、项目符号列表均可）。一次反馈按五层组织：**Evaluate**（整体评估）→ **Correction**（必要修改）→ **More natural**（可选润色）→ **Why**（按错误类型解释原因）→ **Remember**（记忆提示，即 Tips）。必要的改动和「换个更自然的说法」分开呈现，你可以只改一处，保留自己原本想表达的意思。

**完整示例：邮件结尾最常见的一句话**（三处必要修改分属动名词、时间介词和动词搭配，另有一处可选润色）：

> 提交：*I am looking forward to meet you at next Friday and discuss about the details of our cooperation.*

- **Evaluate**：意思清楚，但有三处必要修改，另有一处可选的语气润色。
- **Correction**：*I am looking forward to meeting you next Friday and discussing the details of our cooperation.*
- **More natural**：*I'm looking forward to seeing you next Friday and talking about possible cooperation.*
- **Why**：
  1. **meeting / discussing** —— *look forward to* 里的 *to* 是介词，不是不定式符号，后面接名词或动名词（-ing）；*meet* 和 *discuss* 并列受它支配，都要改成 *meeting / discussing*。对比 *I hope to meet you*：那里的 *to* 引出不定式，才用动词原形 *meet*。
  2. **next Friday** —— *next / this / last* 加时间名词（如 *next Friday*、*last week*）本身已经表示时间，前面不再加介词；*at next Friday* 属于冗余。
  3. **discuss** —— *discuss* 是及物动词，后面直接接宾语，不说 *discuss about something*；去掉 *about*，直接说 *discuss the details*。
  4. **Optional（对应 More natural）** —— *seeing you / talking about possible cooperation* 比 *meet you / discuss the details of our cooperation* 更自然、更像邮件收尾，意思不变。
- **Remember（Tips）**：看到 *look forward to* 就想「*to* 是介词，后面接 -ing」（*be used to doing*、*object to doing* 同理）；*next / last / this* 加时间名词前不加介词；*discuss* 后面直接接宾语，别加 *about*。

反馈下方可以继续追问，直到把规则问透。例如提交 *If I would have known about the meeting, I would have told you.* 后追问「为什么从句不能用 *would have*？」——第三条件句的从句用过去完成时 *had known*，主句才用 *would have told*。

只有点击 **Save to review log** 才会写入学习记录；仅生成反馈不保存、不自动生成复习卡片。页面上选中任意英文，还可以就地查词。

**Writing → Express** 提供两个方向：

- **Chinese → English**：输入中文想法，可写明谈话对象和期望语气，得到自然的英文说法与措辞说明。例如「我想问同事能不能把会议挪到周五，语气客气一点」。
- **English → Chinese**：粘贴同事的回复或不熟悉的英文段落，结合上下文理解意思与隐含语气。

> **学习价值**：修改以「你的原句 + 当时的语境」为载体保存下来，下次写同类邮件时能带着具体问题重看，比孤立的语法条文更容易调用；双向表达则同时补上「说不出」和「读不准」两个缺口。

### 3.2 词汇与记忆 · Vocabulary / Review

**Vocabulary** 支持从英文词组（如 *follow up on*）或中文说法（如「跟进」）查起，阅读释义、例句与常见搭配，再决定是否保存。**Saved words** 是可搜索的 Markdown 词库，可打开词条详情、从这里开始复习。

**Review** 采用「先回忆、再核对」：看中文线索先想英文表达 → 揭示答案 → 按回忆难度选择 **Again / Hard / Good / Easy** → 由系统安排下次复习。音标按需揭开，不提前泄露答案。只有提交评分才记录本次复习和新的到期时间；平时翻阅词库不会改变复习计划，输入答案是否正确与自我评分也分开记录。

> **学习价值**：主动回忆比反复重读更能形成长期记忆；四档自评把「认得」和「能主动说出来」区分开，避免把查词记录误当成词汇量。

### 3.3 句子产出练习 · Practice

- **选题**：Web 提供 3 / 5 / 10 题，难度 **easy / standard / challenge**，场景 **home、dining、shopping、entertainment、social、health、work、transit、travel、services** 或全部。命令行另支持 1–10 题与 `--style casual|neutral|formal`。出差前练 travel，开会前练 work，题目来自本机题库，不依赖历史记录，也不需要临时生成。
- **作答**：先自己写一版英文；卡住时逐层展开提示——**Simple hint → Intermediate hint → Complete pattern**，最多三层，最后一层只给句型，不代替你写完。
- **对照**：提交后看评价与参考译文。措辞不同但传达了原意，同样成立，无需逐字对齐。
- **留痕**：作答记录保存提示使用情况，可在 **Overview → Practice log** 回看哪些句子是独立写出来的、哪些值得遮住提示再做一次。

> **学习价值**：练的是「中文意思 → 英文句子」的主动产出，而不是选择题。提示层级被如实记录，因此借助提示答对不会被误记为已能独立运用。

### 3.4 问答与笔记 · Ask

**Ask** 用来把一个用法问题问透：先问「*follow up on the proposal* 和 *follow up with Alex* 有什么区别」，再请它各举一个例子，或贴上自己的句子继续讨论。**Answer language** 与 **Note language** 可分别设置——例如用中文弄懂，用英文留一份总结。

值得留下的内容可以保存为单条回答，也可以把整段对话总结成一篇 Markdown 笔记；笔记带分类、标签与标题。**Saved notes** 支持关键词搜索、按分类和主题筛选，还能以某篇旧笔记为上下文开启新讨论（原笔记保持不变）。

> **学习价值**：疑问不再随对话窗口一起消失，而是变成可检索的第二本「个人语法书」；用中文理解、用英文归档，也顺带练了概括表达。

### 3.5 学习记录与诊断 · My learning

| 子页 | 内容 | 用途 |
| --- | --- | --- |
| **Overview** | 已保存材料库存、与上一时段对比的表现快照、趋势、错误分布、优先项与练习日志 | 看清这段时间做了什么，并可下钻到具体记录 |
| **Handbook** | 已保存的 Refine 检查，按时间、关键词、错误类型筛选 | 集中复习某一类修改，例如只看冠词问题 |
| **Learning reports** | 选时间范围与报告语言，由 Coach 基于已保存的 Refine 检查和练习作答生成报告 | 找出反复出现的错误模式、知识缺口与练习方向；可重读历史报告、下载 Markdown |

**证据边界是产品刻意保留的设计**：一次 AI 纠正、一次借助提示的作答、一次自评分数，都不能证明持久掌握；报告只评估有写作记录支撑的能力；**No diagnosed mistakes** 只表示本次没有诊断出错误，不代表全文无误。读懂一次修改后，隔几天换个情境独立再写一遍，才是有效的验证方式。

### 3.6 设置与辅助

- **Model settings**：可保存多套命名配置，每套由一个你自定义的模型构成——服务、接口地址、密钥与模型 ID 全部自行填写；可设为 Web 默认，也可按任务分配。
  - **Web**：写作、翻译、查词、练习、Coach、Ask 各有独立模型选择器，页面各自记住所选配置，未选时用默认配置。
  - **命令行**：`/model add` 添加配置（打开模型设置页），`/model list` 查看各任务分配，`/model <任务> 名称` 指定，`/model <任务> reset` 恢复默认。可分配的任务：grammar、translation、word、practice、text、ask、chat、coach。
  - **按任务选模型，兼顾成本与效果**：Refine 这类高频、结构化的简单任务可指向本地模型（如 Ollama），不消耗在线 token；Ask、Coach 这类需要深度推理和综合诊断的任务可指向付费的高级 SOTA 模型，得到更可靠的解释与建议。Web 与命令行共用同一套已保存配置；具体分配两端各自保存（Web 记在浏览器，CLI 写入 `.env` 的 `IGT_CLI_MODELS`），互不覆盖。
- **Markdown files**：指定词汇、修改记录、笔记、练习日志与报告的保存位置，可直接指向 Obsidian 仓库。
- **划词查词**：在任意页面选中英文或中文即可就地查词，不必切换页面。
- **可选语音**：朗读单词或对话语音（兼容 OpenAI `/v1/audio/speech` 的本地服务）；应用不录音，也不评估发音。

---

## 4. 一次完整的学习闭环

各模块不是并列的工具，而是围绕同一个语言问题前后衔接：

1. **写** —— 邮件草稿里出现 *I look forward to meet you on Friday.*
2. **懂** —— Refine 指出 *meet → meeting*，追问后弄清 *to* 的两种身份。
3. **存** —— Save to review log，原句、修改与解释一起进入 Handbook。
4. **扩** —— Express 用中文再练一次「客气地改约会议」；Vocabulary 顺手存下 *follow up on*。
5. **练** —— Practice 选 work 场景独立写邀请与跟进句；Review 隔几天回忆那个词组。
6. **看** —— Overview 回看这段时间的活动，Handbook 按错误类型筛选，Learning reports 找出反复出现的问题。
7. **复现** —— 隔几天换一个情境，不看提示再写一次，用最初的作答作对照。

这条闭环解决的正是英语学习里最常见的落差：**当时看懂了，之后用不出来**。每一环都以你自己的句子为材料，产物是可以随时翻回的记录，而不是一次性的分数。

---

## 5. 三种使用形态

| 形态 | 启动方式 | 适合 |
| --- | --- | --- |
| **Web 界面（主入口）** | `npm run web:start` | 日常学习、完整功能、中文引导与可视化报告 |
| **命令行工具** | `node igt.mjs` | 习惯终端；直接输入英文查语法、输入中文即翻译 |
| **安卓开发版** | ADB 连接正在运行 ClearWrite 的电脑 | 为手机重做的界面：今天、写作、提问、词汇、练习、我的、设置；单手底栏、离线草稿、系统分享与深色模式，共用同一份数据和模型设置 |

三者共用同一套学习记录与模型配置。安卓界面是独立的移动端客户端（`apps/mobile`），并非桌面布局的缩放版；配色沿用桌面端同一套 ClearWrite 设计色值。安装与连接见[中文指南](apps/android/README.zh.md) / [English guide](apps/android/README.md)。

---

## 6. 学习记录与隐私

| 内容 | 存放位置 |
| --- | --- |
| 词汇、已保存的修改、Ask 笔记、练习日志、Coach 报告 | 本地 **Markdown** 文件（可指向 Obsidian 仓库） |
| Practice 题库与作答、词汇复习排期、统计记录 | 本机 **SQLite** 数据库 |

使用在线模型时，只有完成该次请求所需的文本会发送到你选择的服务；选择本地模型即可在电脑上完成处理。学习记录不依赖账号、不上传同步。备份学习历史时，请**同时保留数据库和 Markdown 文件**；配置项与部署、备份说明见 [.env.example](.env.example) 与[部署与备份](WEB-DEPLOYMENT-PLAN.md)。

---

## 7. 快速开始

准备 Node.js 24、npm 和 Git。首次安装时在 PowerShell 执行：

```powershell
git clone https://github.com/ievertan00/igt.git
Set-Location igt
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm run client:build
npm run web:start
```

`client:build` 会同时构建桌面端与安卓移动端产物（移动端挂在 `/mobile/`）。只有不需要手机端时才可以单独用 `web:build`。安装安卓 App 还需执行 `npm run android:build`，详见[安卓指南](apps/android/README.zh.md)。

1. 保持终端运行，打开启动信息中 **Ready on** 后的本地地址。界面默认英文，需要中文提示时开启「中文引导」。
2. 打开 **Settings → Model settings**，添加你能使用的模型并设为 Web 默认；按所选服务填写模型 ID、密钥与接口地址。使用本机 Ollama 时，在 `.env` 保留 `IGT_LLM_PROVIDER=ollama`，把 `IGT_DEFAULT_MODEL` 填为 `ollama list` 中已安装的模型名，启动 Ollama 后重启 ClearWrite。
3. 进入 **Writing → Refine**，用上面的邮件例句试一次。之后每次使用只需在项目目录运行 `npm run web:start`。

### 从命令行启动

在项目目录运行 `node igt.mjs` 即可打开交互式命令行工具；直接输入英文句子检查语法，输入中文则翻译，其余功能用 `/` 命令（见下一章速查表）。命令行和 Web 共用同一份学习记录与模型配置。

如果想在任意目录直接输入 `igt` 启动，可以在项目目录执行一次 `npm link`，把 `bin` 中声明的 `igt` 命令注册为全局命令：

```powershell
npm link
igt
```

注册后无需每次回到项目目录；更新代码后一般无需重新注册。命令行同样需要先配置模型：首次使用可执行 `/model add` 添加模型，再用 `/model default` 设为默认；也可在 Web 的 Model settings 中完成配置。

---

## 8. 命令行速查

在项目目录运行 `node igt.mjs`。提示符后**直接输入英文句子**即检查语法，**输入中文**即翻译；其余功能用 `/` 命令，`/help <命令>` 可查看完整参数。Web 里的 **Refine** 就是同一套语法检查流程，命令行沿用 grammar 这个名字。

| 想做什么 | 输入示例 |
| --- | --- |
| 查词、浏览词库、复习 5 个词条 | `/word follow up on`、`/word --list`、`/word review 5` |
| 做 3 道基础中译英题 | `/practice 3 --difficulty easy` |
| 在编辑器里写一整段再分析 | `/text` |
| 翻译一段文本 | `/translate <text>` |
| 问一个用法问题、练英文对话 | `/ask When do I use "by Friday"?`、`/chat` |
| 翻最近一个月的修改、找反复出现的问题 | `/handbook --days 30`、`/coach --days 30` |
| 看学习活动概况 | `/stats --days 30` |
| 添加模型、设置任务模型 | `/model add`、`/model default` |
| 语音开关、终端主题 | `/voice on`、`/theme` |
| 查看帮助、退出 | `/help practice`、`/exit` |

---

## 9. 相关文档与许可证

[配置模板](.env.example) · [开发服务管理](DEV-SERVICES.md) · [部署与备份](WEB-DEPLOYMENT-PLAN.md) · [安卓指南](apps/android/README.zh.md)

许可证：Apache 2.0
