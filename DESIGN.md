---
name: ClearWrite Design System
description: 以 Markdown 文件设置示例为基准的 ClearWrite 界面规范
---

# ClearWrite Design System · v2.5

更新日期：2026-11-13。以 Markdown 文件设置示例为基准，统一 ClearWrite 的导航、标题、面板、表单和交互状态。v2.3 按「优化页面布局减少视觉疲劳」设计稿调整了页面底色、My learning 子导航（新增子页面标题 + 白面页签轨道）与 Grammar check log 的内容布局，并按「说明文字纪律」清理了 My learning 全段的口径 / 证据边界类说明文字。v2.4 按「导航栏设计修改」评审结论定稿顶栏：`My learning` 归入右侧工具组、保留圆形齿轮设置入口、取消独立的主题切换图标，顶栏边界补上 1px 分隔线与轻投影；所有色值与尺寸统一取本文件 token，不采用参考稿的第二套绿色（`#0E9F6E` / `#E8F8EE` / `#0A6E4B`）。v2.5 补齐导航图标与选中态：每个导航项改为「线性图标 + 文字标签」，选中态由浅灰底 + 绿点改为浅绿底 + 深绿字 + 绿色图标 + 1px 细描边，与二级页签的选中语言一致；齿轮按钮的选中态同步。

---

## 1. 设计方向与设计原则

ClearWrite 是一款集“写作润色（Writing/Grammar/Express）”、“词汇构建（Vocabulary/Lookup/Review/Library）”、“独立练习（Practice）”、“AI 研讨（Ask/Saved Notes）”与“学情洞察（Overview/Handbook/Coach）”于一体的高专注度语言工作台。

- **三层认知底色**：
  - `--canvas` (`#f6f8fb`): 极淡灰蓝底色，提供宁静、不刺眼的阅读底景。
  - `--paper` (`#ffffff`): 高亮白表面，承载主操作卡片、主要阅读区、对话流。
  - `--wash` (`#f1f5f9`): 浅灰辅色区，用于胶囊导航槽底、辅助区块与次要提示。
- **高对比核心视觉焦点**：
  - 深蓝曜石黑 `--ink` (`#101827`) 作为主干文字与主要确认动作底色。
  - 品牌绿 `--accent` (`#2fbe63`) 作为视觉画龙点睛之笔（品牌图标底色、激活标签圆点和学习提示）。
- **学习证据的真实性**：
  - 界面绝不混淆“一次性语法纠错成功”、“当次测试答对”、“词汇自评分数”与“长期记忆掌握”。
  - 维持现有 Hash 路由与 Markdown 存储心智（Obsidian Vault 真实关联）。

---

## 2. 颜色与 Token 系统

共享全局 CSS 变量定义如下：

| Token | 色值 | 语义与用途 |
|---|---|---|
| `--canvas` | `#f6f8fb` | 全站浅灰蓝画布背景；比旧值略冷、略收敛，让白卡成为唯一的亮面 |
| `--paper` | `#ffffff` | 卡片表面、输入主体、顶部栏、弹窗背景 |
| `--ink` | `#101827` | 主标题、深色主按钮底色、重要阅读文字 |
| `--muted` | `#64748b` | 次要文字、占位符、辅助时间戳与元数据说明 |
| `--wash` | `#f1f5f9` | 胶囊导航槽底、弱化辅助区域、浅灰背景 |
| `--tab-track-surface` | `#ffffff` | My learning 二级页签轨道：白面 + 1px 描边，替代原先深两档的冷灰凹槽，减少一整条满宽色带 |
| `--tab-track-line` | `#e3eaf3` | 二级页签轨道的 1px 内描边 |
| `--topbar-line` | `#e7ecf3` | 顶部栏底部分隔线 |
| `--line` | `#e2e8f0` / `#e5ecf4` | 极细分割线、静止卡片轮廓（1px） |
| `--control` | `#8391a4` | 可聚焦与可编辑表单控件外边框 |
| `--accent` | `#2fbe63` | 品牌图标底色、激活圆点和关键节点标示 |
| `--accent-hover` | `#218343` | 绿色主色 hover / active 态 |
| `--accent-text` | `#166534` | 浅底上的绿色品牌文字、徽标标题及小图标 |
| `--accent-soft` | `#edfbf2` | 极淡绿背景、选中参数卡片、提示区高亮 |
| `--accent-border` | `#d5efdf` | 浅绿标签底色、选中标签和状态提示的细边框 |
| `--accent-outline` | `#16a34a` | 选中页签的描边与图标（白底上 ≥ 3:1） |
| `--accent-active-text` | `#0e7c46` | 选中页签的文字（白底上 ≥ 4.5:1） |
| `--success` / `--success-bg` | `#10b981` / `#ecfdf5` | 修正达成、连续记忆掌握 (Retained) |
| `--learning` / `--learning-bg`| `#0284c7` / `#eff6ff` | 学习推进中状态 (Learning) |
| `--warning` / `--warning-bg` | `#f59e0b` / `#fffbeb` | 强化复习标记 (Needs reinforcement)、Remember 提示 |
| `--danger` / `--danger-bg`  | `#ef4444` / `#fef2f2` | 语法错误标红、删除危险操作 |
| `--focus-ring` | `#218343` | 2px 键盘焦点轮廓 |
| `--shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` | 基础控件与浅卡片微阴影 |
| `--shadow-surface` | `0 4px 20px -2px rgba(16, 24, 39, 0.04)` | 标准白色内容卡片环境柔影 |
| `--shadow-floating` | `0 12px 32px -4px rgba(16, 24, 39, 0.12)` | FAB、对话浮层、下拉菜单与阅读弹窗立体阴影 |

---

## 3. 导航、面板与 Markdown 文件设置

- 顶部栏使用白底、1px `--topbar-line` 细分隔线与 `--shadow-sm` 轻投影，桌面高度 `84px`（`5.25rem`），吸顶滚动时保持不透明。绿色圆角方形标识（`--accent`）与深色 ClearWrite 字标组成品牌入口。页面目的地（Writing / Vocabulary / Practice / Ask）直接排在白底上，每项为 18px 线性图标 + 文字标签（图标只辅助识别，文字始终保留）。当前入口用 `--accent-soft` 浅绿圆角底、`--accent-active-text` 深绿文字、`--accent-outline` 绿色图标和 1px `--accent-border` 内描边标识，是导航区唯一彩色元素；未选中项的悬停仍只加 `--wash` 浅灰底。选中态不改变字重、内边距或盒模型尺寸，切换页面时宽度不跳动。右侧工具组以 1px `--line` 竖线与目的地切开，依次是 `My learning`、圆形轮廓齿轮设置按钮（`--target-size` 44px、`--line` 描边）与语言选择器；齿轮是唯一的偏好 / 设置入口，不另设主题切换图标，避免两个入口管同一件事。语言选择器使用 `--wash` 浅底、`--line` 描边与下拉箭头；`My learning` 带图标，选中态与目的地一致（浅绿底 + 深绿字 + 绿色图标），齿轮按钮在设置页也用同一套浅绿选中样式。窄屏收起为可键盘操作的菜单，工具组随菜单展开，竖线隐藏，图标与文字标签始终同时保留，`My learning` 与主导航项同宽。全部色值、圆角与触控尺寸只取本文件第 2 节 token。
- 页面标题区按分类标签、主标题、简短说明排列。沿用同一标题层级和浅绿标签处理，各学习页面按任务需要保留编辑器、练习选择、词表或报告布局。
- 学习洞察区（My learning）用一条随页面滚动的二级页签栏承载**当前子页面标题 + 子页签**：标题不再由页签代替，也不在内容区新增页级大标题（各子页原有的小节标题不受影响）。栏内自上而下是 `MY LEARNING` 小字 kicker 与 `h1` 子页面标题（与当前 `aria-current="page"` 页签同名，随语言切换）、然后是页签轨道；两者共用 `--canvas` 页面底色、不带分隔线和投影，因此不会在吸顶主导航之下再压出第二层白色头部。栏不做 `position: sticky`，滚出首屏即随内容离开，`scroll-padding-top` 只补偿吸顶的主导航高度。轨道与顶部栏之间保留 `24px` 页面底色空带（窄屏 `16px`），标题与轨道之间 `10px`，内容区起始处保留 `24px` 间隙。`56px` 高的轨道改用 `--tab-track-surface` (`#ffffff`) 白面，比页面底色亮一档，替代原先深两档的冷灰凹槽 `--wash-sunken`，整页少一条满宽色带；轨道宽度与下方内容面板完全一致、左右边缘共用工作区起线；带浮动滚动按钮的子页会为右侧控件预留 `4rem` 轨道，页签栏同步预留，避免窄屏下轨道比内容宽出一截。页签保持自然宽度依次左排，不做拉伸或均分，轨道右侧的空白原样保留、不再补控件。轨道用 `1px` `--tab-track-line` (`#e3eaf3`) 内描边加 `--shadow-sm` 轻投影划边界，圆角 `14px`、内边距 `8px`，内嵌 `40px` 页签，页签圆角 `10px`、间距 `4px`，图标 `16px` 配 `14px` Medium 文字。两条 `1px` `--control`（50% 不透明度）分隔线把页签分成概览、资料库、洞察三组。未选中为中性灰，悬停加 `--wash` 浅底并加深文字；选中态为 `--accent-soft` 浅绿底加 `--accent-outline` (`#16a34a`) 描边、`--accent-active-text` 文字、绿色图标和 `--shadow-sm`，让激活页签成为导航区唯一的彩色元素，同时保持深绿文字在浅绿底上的可读对比；键盘焦点保留 `2px` 轮廓。画布上的浅绿描边 `#cde8d8` 不直接采用，因为它在白底上不足 3:1。窄屏下页签保持完整图标与标签，由轨道横向滚动承接，分隔线不隐藏；标题缩到 `19px`。
- 设置页面使用带图标的独立标签按钮。默认白底细边框，选中态为浅绿底、深绿文字和图标。支持方向键、Home 和 End 切换。Markdown 标题右侧的文件夹插图为装饰，手机端隐藏。
- 模型设置和 Markdown 文件设置共用工作区的宽度、左右边距和标题区高度。标题、标签和面板的左边缘对齐，切换标签时内容起始位置保持稳定。
- Markdown 设置使用一个白色面板，桌面圆角 `32px`。面板标题区包含浅绿图标、标题和说明。下方通过细分隔线区分文件夹、文件和操作区。
- 每项依次显示标签、说明和路径控件。路径使用等宽字体和浅灰底，保留可编辑性。桌面将浏览按钮放在输入框右侧，手机端移至输入框下方。文件夹和文件各自按单列排列。
- 面板底部左侧显示深色保存按钮和白底重置按钮，右侧显示浅绿状态提示。手机端可换行。成功提示以实际配置和保存结果为依据，错误在操作区内显示。

### 3.1 学习概览（My learning）数据面板

- 「How performance changes」面板的时段按钮与日期输入是**面板局部状态**：只驱动该面板趋势图的独立 `/dashboard/growth` 请求，页面其他数字（指标卡、Saved material、错误分布、Top priorities、最近活动）保持进入页面时的时段不变。`Saved material` 的大数字是全量库存、`Word retention` 是当前库存状态，二者按设计不随时段回溯。控件区「拉平」：`Last 7/30/90 days` 与 `All history` 用 `repeat(4, minmax(0, 1fr))` 四等分铺满面板内容宽度（≤560px 收成 2×2、仍满宽且允许标签换行），两个日期框压到 `32px` 高（以 `input[type="date"]` 提权覆盖全局 48px 输入规则），与时段行等高。图表下方两条说明——作用域提示与指标口径提示——按需求移除；此后「改时段不影响整页数字」不再有文字提醒，只能由标题区日期区间体现。若后续出现误读，优先用 `title` / 无障碍描述补回，不要恢复整行文字。
- `Top priorities` 最多列出 5 项，来自当前时段内实际出现过的错误类型（服务端 `summary.counts.slice(0, 5)`，仅保留 `count > 0` 的项）。数据里只有 3 类诊断时就只显示 3 行；标题改为不带数字的 `Top priorities`，并在标题区用 `N / 5` 计数标签说明，不再用固定「Top 5」标题误导。
- 字体色彩做语义分层：正文与标题保持 `--ink`，说明与元数据保持 `--muted`；指标卡大数字按语义分绿 / 蓝 / 琥珀 / 青绿，资料卡标签与数字同色系，环比增减用绿 / 红 / 灰，状态名、排名、分类计数与标签用对应语义色。语义色在白底上保持可读对比，色相只标数据、不改变正文可读性。
- Overview 收敛为「一屏可读的结论」：移除底部「Compare evidence」的三组对比表（时段 / 模块 / 错误类型）和「Sources and evidence boundaries」的来源明细折叠面板，两者都是低频自助分析控件，留在概览末尾会与主结论争夺注意力。页脚证据说明句也一并移除；来源不可读时仍由页面顶部的 `growth-notice` 提示，不因移除面板而丢失异常反馈。
- **说明文字纪律**：My learning 全段清掉「口径 / 证据边界 / 免责声明」式说明性文字（如 `Affected records, counted once per category.`、`Based on recorded recall evidence.`、`Review intervals and streaks do not prove mastery…`、`Based on locally saved records…`），覆盖 Overview 各面板标题区副标题与页脚、记录详情抽屉、Handbook 右栏提示与卡片副标题、Saved words「About statuses」弹窗首尾段、Grammar 追问输入区脚注。保留的是**反馈与数据**：来源读取异常提示、无日期记录提示、空状态与操作引导、卡片数据状态、状态释义 `<dl>`、快捷键提示、图表无障碍描述，以及日期区间、`N / 5`、`Current state` 等数据徽标。Error distribution 的 `n = N` 徽标一并移除，柱条改用 `title` 承接「点击查看记录」的发现性。删掉副标题后只有趋势面板仍带日期区间，标题区用 `min-height: 3.125rem` 统一下方内容起始线。**代价**：统计口径与「不等于掌握」的边界不再有文字兜底，若后续出现误读，优先用 `title` / `aria-label` 补回，不恢复整行文字。

### 3.2 Grammar check log · 低疲劳内容布局

以「优化页面布局减少视觉疲劳」设计稿（`ClearWrite · Grammar check log — 布局优化 v2`）为视觉基准，落到 Handbook 实际页面。疲劳源是**重复的高对比满宽色块**，不是留白不足，因此改法是「一张安静白面 + 单一绿色强调」：

- **筛选区**：四列表单 + 独立按钮行压成一条 `40px` 高的工具栏（搜索框 + 三个下拉 + 深色 Search + Clear）。标签文案用 `.sr-only` 保留在无障碍树里，不占视觉行高；窄屏自动折行而非横向溢出。
- **单条记录**：白卡 + `1px --line` 细边 + 无投影，去掉内嵌的浅蓝对比块、浅绿替代块和蓝灰说明块。层级交给排版：`ORIGINAL` 与原文用 `--muted` 弱化，`CORRECTED` 用 `--accent-text` 标签 + `--ink` 加粗正文；「More natural」是全卡唯一被强调的部分：文案由 `More natural alternative` 简化为 `More natural`，用 `--accent-soft` 浅绿底 + `--accent-border` 细边 + 左侧 `3px --accent` 竖线构成一条约 52px 高的强调条，标签配 sparkle 图标、正文 `1rem`/600 加深。只强调这一行，不恢复满宽满高的绿色色块，避免重新引入色块堆叠。
- **说明按需展开**：`<details>` 默认折叠成一行「Saved explanations and notes」，仅最新一条默认展开作状态示例；右下浮动按钮仍可一键展开 / 收起全部，单条也可单独点开。卡片从 ~320px 压到 ~170–230px，一屏能看到三条。
- **行长与节奏**：正文与说明 `max-width: 64ch`；桌面用主栏 + `19rem` 右栏的双列结构，把主栏从满宽收窄。右栏是概览数字、错误类型条形图和标签快捷筛选，用真实 `categories` / `pagination` 数据，不引入新数据口径；卡片副标题与主栏面板副标题、底部「一次纠错不是掌握证据」提示均已移除，仅保留大数字的单位标签 `Saved checks`。≤1080px 收成单列、右栏卡片平铺。
- **配色纪律**：全局只用品牌绿（`--accent` / `--accent-soft` / `--accent-text`）与语义红，不引入第二套色系；页面底色统一 `--canvas` (`#f6f8fb`)，卡片 `--paper`，弱化信息用 `--wash` 而非彩色底。

## 4. 按钮系统与微交互规范

系统将全站操作明确划分为五大层级，提供极致的手感、无障碍保障与微交互：

### 4.1 主动作按钮 (Primary Action Button)
- **外观**：深蓝曜石色背景（`background: var(--ink)`），白色字（`color: #ffffff`），右侧用白色箭头（`→`）表示提交或继续。
- **规格**：高度统一为 `48px`（大面板核心动作为 `52px`），内边距 `0 1.5rem`，圆角 `var(--radius-control)`（`12px` 或 `16px`）。
- **交互状态**：
  - *Default*：深邃平整，文字清晰，无重投影。
  - *Hover*：背景转为 `#1e293b`，小箭头带轻微平移 `transform: translateX(3px)`，整体微浮升 `transform: translateY(-1px)`。
  - *Active*：缩放微反馈 `transform: scale(0.98)`，背景转为 `#080f1b`。
  - *Focus-visible*：`outline: 2px solid var(--accent)`，带 `2px` 间隙偏移。
  - *Disabled*：背景 `#e2e8f0`，文字 `#94a3b8`，光标 `not-allowed`。
- **代表操作**：`Check answer →`、`Look up →`、`Start practice →`、`Send →`、`Save file locations`。

### 4.2 次级与轮廓按钮 (Secondary & Outlined Buttons)
- **外观**：纯白表面（`var(--paper)`），细边框（`1px solid var(--line)`），文字为中深色 slate（`#334155`）。
- **规格**：高度 `44px` 或 `48px`，圆角 `12px`。
- **交互状态**：
  - *Hover*：边框强化为 `var(--control)`，背景轻微置换为 `var(--wash)` (`#f8fafc`)。
  - *Active*：`transform: scale(0.98)`。
- **代表操作**：`Saved words`、`Reset`、`Previous / Next`、`Start a new session`。

### 4.3 品牌轻量辅助与学习提示 Chip 按钮 (Hint & Soft Action Chips)
- **外观**：浅绿色底色（`var(--accent-soft)`），深绿文案与图标（`var(--accent-text)`），边框为半透明绿色边（`1px solid #d5efdf`）。
- **规格**：高度 `36px - 40px`，圆角胶囊（`rounded-full` 或 `8px`）。
- **代表操作**：`🔊 Audio hint`、`💡 Show first letter`、`Review due words` 快捷条。

### 4.4 图标按钮 (Icon Buttons)
- **规格**：外层触控命中区域严格保持 `≥ 44×44px`（无障碍黄金法则），视觉图标区域可居中为 `32×32px` 或 `20px` 矢量图形。
- **外观**：默认透明或浅灰底，hover 时呈现浅圆底面（`var(--wash)`）。
- **代表操作**：复制气泡（`Copy`）、发音圆圈、关闭弹窗（`Close / Esc`）、日历与设置切换。

---

## 5. 悬浮操作按钮与快捷入口规范 (FABs System)

为提升长文档与阅读视图下的操作触达率，制定 Floating Action Buttons (FAB) 体系：

### 5.1 扩展型胶囊悬浮按钮 (Extended FAB)
- **尺寸与形态**：高度 `52px`，全圆角（`border-radius: 9999px`），内边距 `0 1.5rem`。
- **视觉风格**：
  - 风格 A（主功能悬浮）：深曜石黑背景（`var(--ink)`），白色字与高亮绿色图标，搭配深层阴影（`box-shadow: var(--shadow-floating)`）。
  - 风格 B（高能唤起）：白底搭配 1px 细线边框，左侧带动态绿色小圆点或高亮图标。
- **动效微交互**：
  - 页面初次滚动至阈值时淡入上浮：`animation: fabEnter 250ms var(--ease-out)`。
  - Hover：`box-shadow: 0 16px 36px -4px rgba(16, 24, 39, 0.18); transform: translateY(-2px);`。
  - Active：`transform: scale(0.97);`。
- **代表场景**：Saved notes 列表长滚动时的 `+ Ask a question →` 浮动条、长词汇库底部的 `Review due words` 浮动胶囊。

### 5.2 紧凑型圆形悬浮按钮 (Compact Circle FAB)
- **尺寸**：直径 `56px × 56px` 正圆形。
- **布局定位**：桌面端/移动端右下角（`bottom: 2rem; right: 2rem`），避开内容安全边界与滚动条。
- **功能**：快捷唤起“Ask AI 浮动研讨窗”或快速回到顶部。

---

## 6. 多选项卡片与状态选择按钮组 (Choice & Selector Group)

在 Practice 设置与 Review 评价中，选项卡片兼具 Button 的可点击特性与表单的互斥状态：

- **普通态**：白底，1px `--line` 边框，无下沉。
- **选中态**：
  - 背景切换为浅绿色（`var(--accent-soft)`）。
  - 边框切换为聚焦青绿色（`#2fbe63` 或 `#218343`）。
  - 右上角带浅绿勾选标记（`✓`）。
  - **禁止仅改变文字颜色**，必须有整体背景与边框的明显材质响应。
- **Review 四级自评按键组**：
  - `Again`（未想起）/ `Hard`（费力想起）/ `Good`（正常想起）/ `Easy`（轻松想起）。
  - 四个选项保持**同等视觉权重与尺寸**，杜绝诱导评分。

---

## 7. 排版与空间节律

- **字体栈**：`Plus Jakarta Sans`, `DM Sans`, `system-ui`, `-apple-system`, `sans-serif`。
- **正文字号**：默认 `1rem` (16px)，行高 `1.65`；辅助说明 `.875rem` (14px)；标签 `.75rem` (12px)。
- **页面主标题**：`2.25rem - 3.25rem`，加粗，主标题文案下方搭配一段通透解说。
- **居中流式布局**：全站通用居中最大宽 `--workspace-max: 80rem` (1280px)，左右 `--page-gutter` 桌面 `2rem`，平板 `1.25rem`，手机 `1rem`。

---

## 8. 动效标准 (Motion Tokens)

| Token | 数值 | 适用范围 |
|---|---|---|
| `--duration-fast` | `150ms` | 按钮 Hover、背景色彩置换、边框高亮 |
| `--duration-normal` | `200ms` | 弹窗淡入、FAB 浮起、折叠抽屉展开 |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 柔和回弹缓动 |
| `prefers-reduced-motion` | 降级处理 | 关闭位移动画与缩放，保留即时状态切换 |
