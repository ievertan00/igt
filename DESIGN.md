---
name: ClearWrite Design System
description: 以 Markdown 文件设置示例为基准的 ClearWrite 界面规范
---

# ClearWrite Design System · v2.16

更新日期：2026-11-13。以 Markdown 文件设置示例为基准，统一 ClearWrite 的导航、标题、面板、表单和交互状态。v2.3 按「优化页面布局减少视觉疲劳」设计稿调整了页面底色、My learning 子导航（新增子页面标题 + 白面页签轨道）与 Grammar check log 的内容布局，并按「说明文字纪律」清理了 My learning 全段的口径 / 证据边界类说明文字。v2.4 按「导航栏设计修改」评审结论定稿顶栏：`My learning` 归入右侧工具组、保留圆形齿轮设置入口、取消独立的主题切换图标，顶栏边界补上 1px 分隔线与轻投影；所有色值与尺寸统一取本文件 token，不采用参考稿的第二套绿色（`#0E9F6E` / `#E8F8EE` / `#0A6E4B`）。v2.5 补齐导航图标与选中态：每个导航项改为「线性图标 + 文字标签」，选中态由浅灰底 + 绿点改为浅绿底 + 深绿字 + 绿色图标 + 1px 细描边，与二级页签的选中语言一致；齿轮按钮的选中态同步。v2.6 收敛 Overview 的文字色彩表达：卡片标签与数字同色系、空数据与零计数退为中性、浅灰底上的安静控件文字改用 `--ink-soft`、观察面板正文回归墨色，并补齐悬停态的对比度与可见反馈。v2.7 按评审把 `My learning` 放在分隔线左侧、靠右独立成组，与目的地之间以弹性留白分开；右侧工具组只保留齿轮与语言选择器，二者间距 `1rem`，分隔线两侧各 `1.25rem`（961–1240px 档收紧为 `.75rem`）。v2.8 按三张 Overview 参考截图合并观察与优先级卡、重做错误分布与资料 / 指标卡；只取版式与数据标签，色值全量沿用第 2 节 token。v2.9 按第二轮评审收紧 Overview：移除 Recent activity、重排两行面板宽度与等高、压缩第一行高度、把资料区入口改为 `View recent activity`，并对四个标题统一做光学左移。v2.10 按第三轮微调：`Top priorities` 由 5 项收为 3 项（`N / 3`），`Word retention` 状态图例改单列垂直排列。v2.11 撤销 My learning 页面对主导航的专属缩放，恢复 §3.1 的全局 84px 顶栏与字号，页面切换时主导航位置与尺寸不变。v2.12 把子页面名与两个区块标题由「左突出 6px」改为「右内缩 6px」，并同步到全部子页面。v2.13 收紧三条 Top priorities 白卡内的文字高度，把腾出的垂直空间放到每条卡的顶部留白。v2.14 把趋势图 legend 移到绘图区上方右侧、重做 Previous period 图标，并让图表纵向填满趋势卡以消除底部空白。v2.15 收敛趋势图的点标记：去掉 Previous period 数据点外层的实心大圆盘、改用空心圈，Current period 保持实心点；两枚图例统一为不带圆圈的纯线段（实线 / 虚线）。v2.16 把词汇复习题面上的 IPA 由常显改为按需揭示：去掉会泄露答案的音标行，原来的 `Show first letter` 提示改名为 `Show the IPA` 并用于手动揭开音标。

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
| `--ink-soft` | `#475569` | 浅灰底（`--wash`）上的安静控件文字与中性状态名；`--muted` 在浅灰底上不足 4.5:1 时的中性替代 |
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

- 顶部栏使用白底、1px `--topbar-line` 细分隔线与 `--shadow-sm` 轻投影，桌面高度 `84px`（`5.25rem`），吸顶滚动时保持不透明。绿色圆角方形标识（`--accent`）与深色 ClearWrite 字标组成品牌入口。页面目的地（Writing / Vocabulary / Practice / Ask）直接排在白底上，每项为 18px 线性图标 + 文字标签（图标只辅助识别，文字始终保留）。当前入口用 `--accent-soft` 浅绿圆角底、`--accent-active-text` 深绿文字、`--accent-outline` 绿色图标和 1px `--accent-border` 内描边标识，是导航区唯一彩色元素；未选中项的悬停仍只加 `--wash` 浅灰底。选中态不改变字重、内边距或盒模型尺寸，切换页面时宽度不跳动。`My learning` 靠右贴近分隔线左侧，与目的地之间以弹性留白分开；右侧工具组以 1px `--line` 竖线切开，依次是圆形轮廓齿轮设置按钮（`--target-size` 44px、`--line` 描边）与语言选择器，二者间距 `1rem`；竖线两侧各留 `1.25rem`，宽于工具组内部间距，让分隔线读作组边界（961–1240px 档统一收紧为 `.75rem`）；齿轮是唯一的偏好 / 设置入口，不另设主题切换图标，避免两个入口管同一件事。语言选择器使用 `--wash` 浅底、`--line` 描边与下拉箭头；`My learning` 带图标，选中态与目的地一致（浅绿底 + 深绿字 + 绿色图标），齿轮按钮在设置页也用同一套浅绿选中样式。窄屏收起为可键盘操作的菜单，工具组随菜单展开，竖线隐藏，图标与文字标签始终同时保留，`My learning` 与主导航项同宽。全部色值、圆角与触控尺寸只取本文件第 2 节 token。
- 页面标题区按分类标签、主标题、简短说明排列。沿用同一标题层级和浅绿标签处理，各学习页面按任务需要保留编辑器、练习选择、词表或报告布局。
- 学习洞察区（My learning）用一条随页面滚动的二级页签栏承载**当前子页面标题 + 子页签**：标题不再由页签代替，也不在内容区新增页级大标题（各子页原有的小节标题不受影响）。栏内自上而下是 `MY LEARNING` 小字 kicker 与 `h1` 子页面标题（与当前 `aria-current="page"` 页签同名，随语言切换）、然后是页签轨道；两者共用 `--canvas` 页面底色、不带分隔线和投影，因此不会在吸顶主导航之下再压出第二层白色头部。栏不做 `position: sticky`，滚出首屏即随内容离开，`scroll-padding-top` 只补偿吸顶的主导航高度。轨道与顶部栏之间保留 `24px` 页面底色空带（窄屏 `16px`），标题与轨道之间 `10px`，内容区起始处保留 `24px` 间隙。`56px` 高的轨道改用 `--tab-track-surface` (`#ffffff`) 白面，比页面底色亮一档，替代原先深两档的冷灰凹槽 `--wash-sunken`，整页少一条满宽色带；轨道宽度与下方内容面板完全一致、左右边缘共用工作区起线；右下浮动按钮是 `position: fixed` 的覆盖式浮层，不占布局宽度，带浮动滚动按钮的子页同样使用与其它页面一致的标准工作区宽度，页签栏不为按钮预留侧边轨道。页签保持自然宽度依次左排，不做拉伸或均分，轨道右侧的空白原样保留、不再补控件。轨道用 `1px` `--tab-track-line` (`#e3eaf3`) 内描边加 `--shadow-sm` 轻投影划边界，圆角 `14px`、内边距 `8px`，内嵌 `40px` 页签，页签圆角 `10px`、间距 `4px`，图标 `16px` 配 `14px` Medium 文字。两条 `1px` `--control`（50% 不透明度）分隔线把页签分成概览、资料库、洞察三组。未选中为中性灰，悬停加 `--wash` 浅底并加深文字；选中态为 `--accent-soft` 浅绿底加 `--accent-outline` (`#16a34a`) 描边、`--accent-active-text` 文字、绿色图标和 `--shadow-sm`，让激活页签成为导航区唯一的彩色元素，同时保持深绿文字在浅绿底上的可读对比；键盘焦点保留 `2px` 轮廓。画布上的浅绿描边 `#cde8d8` 不直接采用，因为它在白底上不足 3:1。窄屏下页签保持完整图标与标签，由轨道横向滚动承接，分隔线不隐藏；标题缩到 `19px`。
- 设置页面使用带图标的独立标签按钮。默认白底细边框，选中态为浅绿底、深绿文字和图标。支持方向键、Home 和 End 切换。Markdown 标题右侧的文件夹插图为装饰，手机端隐藏。
- 模型设置和 Markdown 文件设置共用工作区的宽度、左右边距和标题区高度。标题、标签和面板的左边缘对齐，切换标签时内容起始位置保持稳定。
- Markdown 设置使用一个白色面板，桌面圆角 `32px`。面板标题区包含浅绿图标、标题和说明。下方通过细分隔线区分文件夹、文件和操作区。
- 每项依次显示标签、说明和路径控件。路径使用等宽字体和浅灰底，保留可编辑性。桌面将浏览按钮放在输入框右侧，手机端移至输入框下方。文件夹和文件各自按单列排列。
- 面板底部左侧显示深色保存按钮和白底重置按钮，右侧显示浅绿状态提示。手机端可换行。成功提示以实际配置和保存结果为依据，错误在操作区内显示。

### 3.1 学习概览（My learning）数据面板

- 「How performance changes」面板的时段按钮与日期输入是**面板局部状态**：只驱动该面板趋势图的独立 `/dashboard/growth` 请求，页面其他数字（指标卡、Saved material、错误分布、Top priorities、最近活动）保持进入页面时的时段不变。`Saved material` 的大数字是全量库存、`Word retention` 是当前库存状态，二者按设计不随时段回溯。控件区「拉平」：`Last 7/30/90 days` 与 `All history` 用 `repeat(4, minmax(0, 1fr))` 四等分铺满面板内容宽度（≤560px 收成 2×2、仍满宽且允许标签换行），两个日期框压到 `32px` 高（以 `input[type="date"]` 提权覆盖全局 48px 输入规则），与时段行等高。图表下方两条说明——作用域提示与指标口径提示——按需求移除；此后「改时段不影响整页数字」不再有文字提醒，只能由标题区日期区间体现。若后续出现误读，优先用 `title` / 无障碍描述补回，不要恢复整行文字。
- `Top priorities` 最多列出 5 项，来自当前时段内实际出现过的错误类型（服务端 `summary.counts.slice(0, 5)`，仅保留 `count > 0` 的项）。数据里只有 3 类诊断时就只显示 3 行；标题改为不带数字的 `Top priorities`，并在标题区用 `N / 5` 计数标签说明，不再用固定「Top 5」标题误导。
- 字体色彩做语义分层：正文与标题保持 `--ink`，说明与元数据保持 `--muted`，浅灰底上的安静控件文字（未选中时段按钮、中性状态名）用 `--ink-soft`。指标卡与资料卡的标签和大数字同色系（绿 / 蓝 / 琥珀 / 青绿），不再用混色把标签调脏；资料卡「期内新增」数字跟随该卡色相，不再一律绿色。环比增减用绿 / 红 / 灰；状态名与计数、排名、分类计数与标签用对应语义色，中性状态（New / Insufficient history / Status unavailable）用 `--ink-soft`。**空数据不着色**：不可用指标的大数字、零计数的分类行与状态行、为 0 的期内增量一律退为 `--muted`，色相只标记真实存在的观察。观察面板的正文回归 `--ink`，绿只留在底色、标题与链接；趋势图上一时段的线与图例色块用 `--control`（白底 ≥ 3:1）。卡片悬停换浅绿底时次要文字同步升一档到 `--ink-soft` 保持对比；分类行与状态行的悬停反馈改为标签下划线（分类行另加轨道加深），不再依赖会被语义色覆盖的文字变色。语义色在白底上保持可读对比，色相只标数据、不改变正文可读性。
- Overview 收敛为「一屏可读的结论」：移除底部「Compare evidence」的三组对比表（时段 / 模块 / 错误类型）和「Sources and evidence boundaries」的来源明细折叠面板，两者都是低频自助分析控件，留在概览末尾会与主结论争夺注意力。页脚证据说明句也一并移除；来源不可读时仍由页面顶部的 `growth-notice` 提示，不因移除面板而丢失异常反馈。
- **说明文字纪律**：My learning 全段清掉「口径 / 证据边界 / 免责声明」式说明性文字（如 `Affected records, counted once per category.`、`Based on recorded recall evidence.`、`Review intervals and streaks do not prove mastery…`、`Based on locally saved records…`），覆盖 Overview 各面板标题区副标题与页脚、记录详情抽屉、Handbook 右栏提示与卡片副标题、Saved words「About statuses」弹窗首尾段、Grammar 追问输入区脚注。保留的是**反馈与数据**：来源读取异常提示、无日期记录提示、空状态与操作引导、卡片数据状态、状态释义 `<dl>`、快捷键提示、图表无障碍描述，以及日期区间、`N / 5`、`Current state` 等数据徽标。Error distribution 的 `n = N` 徽标一并移除，柱条改用 `title` 承接「点击查看记录」的发现性。删掉副标题后只有趋势面板仍带日期区间，标题区用 `min-height: 3.125rem` 统一下方内容起始线。**代价**：统计口径与「不等于掌握」的边界不再有文字兜底，若后续出现误读，优先用 `title` / `aria-label` 补回，不恢复整行文字。

### Overview visual hierarchy refinement (2026-11-13)

- Panel headings use their natural height; removed helper copy must not leave an empty reserved line. Analysis and secondary panels align at the top and keep natural heights.
- Error distribution sorts categories by descending count. The highest nonzero count (including ties) uses the brand green; remaining bars use a muted green and neutral labels. This replaces the earlier per-category hue treatment; zero counts remain neutral.
- Word retention uses a 16px status band, breathing room before the legend, and stronger counts. Preserve the existing status meanings and colors.
- Top priorities emphasizes the first item with a soft green surface and a stronger rank; other ranks stay neutral. Recent activity remains compact, with module icons, fine separators, and readable timestamps on narrow screens.

### Overview card refinement (2026-11-13, v2.8)

以三张参考截图为版式基准；**只取结构与数据标签，颜色仍全量取第 2 节 token**，不采用参考稿自身的第二套绿色。以下条目覆盖 §3.1 中的旧表述。

- **合并结论卡**：`A brief observation` 与 `Top priorities` 合成一张 `--accent-soft` 浅绿卡（桌面 7 列）。卡内依次是墨色标题 + 白圆 sparkle 徽标、观察正文、绿色 `Top priorities` 小标题配 `N / 5`、白底细边的编号优先级卡（名次 + 类型 + `N records · N distinct inputs` 灰药丸 + 数据副行）、前三项的胶囊 chips、页脚计数与 `Open full report →`。`.growth-priorities` 保留为卡内子区块，仍持有 `h2`、`N / 5` 与可点击行，数据 / 证据逻辑与既有断言不变。`Recent activity` 独占 12 列一行，≥901px 时内部两列，窄屏自动收成单列。
- **Error distribution**：标题右侧 `N total` 灰徽标、标题下 `Flagged issues in this period` 副标题；柱条按降序，最高非零项用 `--accent`、其余柔绿、零计数保持中性，去掉整行浅绿底。分隔线下方是 `Focus area` 浅绿提示框：白圆 info 图标 + 最大分类、真实占比 `(N / total)`、反复出现的具体错误类型、打开该分类记录的 `Review … corrections →`。无标记问题时整块不渲染。
- **资料卡与指标卡**：§3.1「标签和大数字同色系」改为——大数字回归 `--ink`、标签回归 `--muted`，四种语义色只落在资料卡 32px 图标方块与 `+N this period` 药丸上；`Saved material` 标题右侧 `View all material →` 打开全量记录抽屉。指标条四项各自补一条按真实比例填充的细进度条（回忆率 / 翻译分 / 有诊断占比 / 保留占比），环比增减改绿 / 红 / 灰药丸；`Performance snapshot` 标题右侧写 `Compared with the previous N days`（由 `previous.filters` 真实区间计算）。
- **说明文字纪律的四条例外**：`N total`、`Flagged issues in this period`、`Compared with the previous N days`、`N flagged issues in this period` 都是计数 / 时段数据标签，不是口径或证据边界声明；其余说明文字仍按 §3.1 不恢复。副标题与提示框文本不放进 `.growth-section-title`，避免与趋势面板的日期区间共用标题区高度。

### Overview density & alignment pass (2026-11-13, v2.9)

本轮只做版式与入口收敛，不新增说明文字、不改动数据与证据逻辑；以下条目覆盖 v2.8 中 `Recent activity` 独占一行、结论卡 7 列、`View all material` 三处旧表述，以及 §3.1 关于「最近活动」的旧表述。

- **两行栅格**：第一行 `How performance changes` 7 列 / `Error distribution` 5 列不变；第二行 `Word retention` 由 5 列收为 **4 列**、结论卡由 7 列扩为 **8 列**。两卡 `align-items: stretch` 等高，去掉 `align-self: start`；窄状态栏多出的高度不追加内容，而是把状态带加厚到 `1.5rem`，并用上下 `margin: auto` 把「堆叠条 + 图例」作为一组垂直居中，避免半截空卡。≤1120px 两卡各自满行，恢复自然高度。
- **第一行压缩**：趋势图 `viewBox` 高度 238 → 202（上下留白同步收紧），图表 `min-height` 桌面 `13.75rem → 10.5rem`、≤620px `11.25rem → 8.5rem`（后者防止缩短后的 SVG 在手机上被 letterbox 成一条空白带）；标题区 / 控件区下边距各减 4px。错误分布的副标题下边距、柱行最小高度（40 → 34px）与行距、列表下内边距、focus 提示框外边距 / 内边距 / 段距全部收紧。1440px 实测第一行由 562.7px 降到 488.4px。
- **图例语义**：上一时段在图中是虚线，其图例标记由实心 `--control` 色块改为 `repeating-linear-gradient` 虚线色块，与线型一致；当前时段仍是实心 `--accent`。
- **入口与文案**：`Recent activity` 面板整块移除，`.growth-recent` / `.growth-practice-log` 相关样式一并清理。`View all material` 更名 `View recent activity`，点击打开 `Recent activity` 全量记录抽屉（承接被移除面板的「查看全部记录」）；`Open practice log` 移到 `Saved material` 标题右侧动作组，保证练习日志视图仍有唯一入口。标题右侧动作组可换行、链接允许断行，200% 文字缩放 + 320px 不产生横向溢出。
- **光学对齐**：`MY LEARNING`（含其右侧子页面标题）、`Saved material`、`Performance snapshot` 四个标题统一 `position: relative; left: -.375rem`。首字字形左侧边距让文字在硬卡片边缘旁看起来略微内缩，这个 6px 微调让四者共享同一条视觉起笔线；它不参与布局、不影响页签轨道与工作区边缘的既有对齐断言。

### Overview third-pass tweaks (2026-11-13, v2.10)

两项微调，覆盖 v2.9 中「优先级 5 项」与「状态图例两列」的旧表述：

- **Top priorities 收为 3 项**：前端 `data.priorities.slice(0, 3)`，计数标签由 `N / 5` 改 `N / 3`；胶囊 chips 同步只取前三项，与服务端排序的前三名保持一致。冒烟断言改为 3 行 / `3 / 3`。
- **Word retention 状态图例单列**：`.growth-status-list` 由两列改 `grid-template-columns: 1fr`，六类状态一行一个、自上而下；窄状态栏被拉高时「堆叠条 + 图例」仍整组垂直居中，≤620px 行距收紧到 `.375rem`，≤350px 的旧单列覆盖规则删除（已无两列布局）。

### Global primary navigation (2026-11-15, v2.11)

主导航（`.topbar` / 品牌 / `.top-nav`）属于全局，不属于任何子页面；以下规则覆盖 `MyLearning.css` 里曾经存在的桌面专属覆写：

- **不按页面缩放**：My learning 不改写 `.topbar` 高度、`.brand-mark` 尺寸、`.brand-wordmark` / `.top-nav` / `.learner-language-menu` 字号，也不改写导航项内边距。桌面全站统一 §3.1 的 `84px`（`5.25rem`）顶栏、`42px` 品牌方块、`24px` 字标、`17px` 导航文字；≤1320px 与 ≤960px 的响应式档位同样只由 `visual-system.css` 决定（实测 1100px 导航 15px、390px 顶栏 77px，My learning 与其它页面完全一致）。
- **切换不动**：`html:has(.my-learning-shell)` 的 `--learning-topbar-height` 与 `scroll-padding-top` 回退值同步恢复 `5.25rem`，只用于锚点偏移补偿，不参与顶栏尺寸；`hashchange` 原地切换路由时主导航的 top / left / width / height 与字号、字重、间距全部保持原值。
- **回归断言**：`my-learning-web-smoke.mjs` 在 `#dashboard` 与 `#grammar` 之间原地切换，深比较主导航指纹（顶栏与品牌方块矩形、字标字号 / 字重、导航字号 / 字重 / gap、导航项字号 / 内边距、语言选择器字号），任何页面级覆写都会让断言失败。

### Sub-page name inset (2026-11-15, v2.12)

覆盖 v2.9「四个标题统一 `left: -.375rem` 光学左移」的旧表述：

- **由左突出改为右内缩**：`.my-learning-navigation-head`（`MY LEARNING` kicker + 子页面 `h1`）与 `.growth-saved-heading h2` / `.growth-snapshot-heading h2` 统一 `left: .375rem`（+6px）。三处文字最左缘落在主内容左边缘内侧 6px，页签轨道、卡片、面板仍严格贴齐 0，不参与布局流。
- **全子页同步**：导航头由 `MyLearning.tsx` 单一组件渲染，五个子页（Overview / Saved words / Saved notes / Handbook / Learning reports）与 1440 / 1100 / 390px 各档实测偏移完全一致：kicker +6px、标题 +119.97px（390px +106.36px）、区块标题 +6px、卡片 0。
- **回归断言**：`headingNudge` 改为要求三者 offset 在 `(1, 12)` 且彼此差 <1.5px；路由循环新增逐宽度比较，任一子页的 kicker / 标题位置漂移都会失败。

### Priority bar text density (2026-11-15, v2.13)

只改三条 `Top priorities` 白卡内的文字与内边距，不动观察正文、chips、页脚与栅格。

- **根因**：通用 `.growth-activity-row:first-child { padding-top: .125rem }` 本意只作用于证据列表首行，但每个优先级按钮都是自己 `<li>` 的首个子元素，导致三条白卡实际为「上 2px / 下 14px」，文字贴着上沿、下方反而空。该规则收窄为 `.growth-activity-list > .growth-activity-row:first-child`，抽屉里的证据列表行为不变。
- **文字减高**：标题 `.875rem/1.5 → .8125rem/1.35`（14px/21px → 13px/17.6px），副行 `.75rem/1.7 → .6875rem/1.4` 且上间距 `.3125rem → .1875rem`（12px/20.4px → 11px/15.4px），徽标行高 `1.6 → 1.4`、上下内边距 `.125rem → .0625rem`。文字块整体约减 13px。
- **腾出的高度放到顶部**：行内边距改 `.75rem 1rem`（上下各 12px），`align-items: center` 让编号方块、箭头与文字块一起居中；顶部留白 2px → 12px，与底部相等。1440px 实测单卡 64px → 61.9px，结论卡 574.1px → 568px，仍与 `Word retention` 等高。窄屏徽标折行时按内容自然增高，不裁切。
- **回归断言**：`my-learning-web-smoke.mjs` 校验首条白卡上下内边距 ≥10px 且相等、标题行高 ≤18px、副行行高 ≤16px、单卡高度 ≤66px。

### Trend legend & chart fill (2026-11-15, v2.14)

覆盖 v2.9「viewBox 高度 238 → 202」「图例标记改为虚线色块」与 v2.9 之后「legend 在图表下方」的旧表述；本轮只改趋势面板，错误分布面板与两卡等高关系不动。

- **根因**：第一行两卡 `align-items: stretch` 等高 488.4px，但行高由 `Error distribution` 的内容撑起；趋势卡原有内容只到 411px，legend 下方有 57px 纯空白（含 20px 底部内边距共 77px）。
- **图表填满**：`TrendChart` 的 `viewBox` 高度 `202 → 254`（宽度仍 680，等比缩放、图形不变形），1440px 下 SVG 渲染高 `206.8 → 260.1px`，图表底缘距卡片底只剩 `21.8px`（即底部内边距），空白带消失；两卡仍同为 488.4px。≤620px 的 `min-height` 由 `8.5rem → 7rem`、≤350px 再降为 `0`，避免变高后的 SVG 在窄屏被 letterbox 成空白带（390px 实测 SVG 115.4px 恰高于 112px 下限）。
- **legend 位置**：由图表下方左侧移到**绘图区上方、右对齐**（`justify-content: flex-end; margin: 0 0 .5rem`），与日期控件右缘对齐；窄屏可换行。这样 x 轴标签可以直接落在卡片底部，不必再为下方图例预留一整行。
- **Previous period 图标**：与 Current period 统一为 `1.5rem × 3px`，虚线沿用图表的 `5/5` 节奏（`repeating-linear-gradient(90deg, var(--control) 0 5px, transparent 5px 10px)`，原先是 `16 × 2px` 的两小块 `5/9`）；中央加 `10px` 空心圆点（`--paper` 底 + `2px --control` 边）呼应图上的空心点。Current period 保持连续实心绿线、不加圆点，避免白色描边把实线切断而看起来也像虚线。
- **回归断言**：`my-learning-web-smoke.mjs` 校验 legend 在 SVG 上方且右对齐、图表底缘到卡片底 ≤26px、两枚 key 尺寸相同、Previous period 的虚线渐变与空心点边框。

### Trend point markers & pure line keys (2026-11-15, v2.15)

覆盖 v2.14「Previous period 图标中央加空心圆点」的表述；本轮只改趋势图的点与图例标识，图表尺寸、legend 位置、两卡等高关系均不动。

- **根因**：`.growth-series.is-previous circle`（特异性 0,3,1）盖过 `.growth-series .growth-point-hit`（0,3,0），把 `r=12` 的透明点击热区也填成 `--control`，于是每个 Previous period 数据点外面出现一个 24px 实心大圆盘，看起来像「点外面套了圆圈」。把热区规则提到 `circle.growth-point-hit`（0,3,1）并让比较序列的点规则用 `:not(.growth-point-hit)`（0,4,1）限定到可见点，两条序列的热区都保持透明。
- **点标记语义**：Current period = 实心绿点（`--accent` 填充 + `--paper` 描边），Previous period = 空心圈（`--paper` 填充 + `2px --control` 描边），只靠实心/空心区分，不再叠加任何外圈或光晕。键盘聚焦时的 `focus-visible` 描边仍由更高特异性规则接管。
- **图例统一**：两枚 key 都是 `1.5rem × 3px`、`border-radius: 2px` 的纯线段，Current 为连续绿实线、Previous 为 `5/5` 灰虚线；移除 `i.is-previous::after` 的空心圆点，图例中不再出现任何圆圈。取消原先 `is-previous` 的 `border-radius: 0`，两项形状完全一致。
- **回归断言**：`my-learning-web-smoke.mjs` 校验两枚 key 圆角一致且均无 `::after` 标记、两条序列的点击热区填充透明且无描边、Current 点填 `--accent`、Previous 点填 `--paper` 且描边为 `--control`（≥2px）。

### Vocabulary review IPA hint (2026-11-15, v2.16)

覆盖 §4.3 里「💡 Show first letter」这一代表操作的旧表述；本轮只改 `WordReview` 题面，答案侧、评分流程与复习记录口径不动。

- **问题**：题面在中文线索下方常显 IPA（`.review-phonetic`，等宽字体、完整音标），读音几乎直接给出答案，与「先回忆、再核对」的复习目标冲突。原先的 `Show first letter` 只提供首字母，属于另一条提示路径。
- **规则**：题面不再渲染 IPA 行；只有词条存在 `phonetic` / `phonetics` 时才在 hints 行出现 `💡 Show the IPA`（中文界面 `显示音标`），点击后在同一位置揭晓音标。首字母提示（`Starts with "x"`）整条移除，避免两套提示并存。
- **布局稳定**：沿用固定 `min-height: 44px` 的提示槽（`.review-ipa-slot`，`min-width: 176px`、可随内容增宽），按钮与揭晓后的 `.review-ipa-hint` 互换而不改变槽高；`.review-ipa-hint` 用等宽字体 + `overflow-wrap: anywhere` 容纳长音标，答题框不会因揭示而跳动。题面删除音标行后同时清理 `.review-phonetic` 及窄屏 `max-width` 规则。
- **答案侧保留**：核对答案后 `review-word-meta` 仍显示 `词性 · 音标`，此时答案已揭晓，不再构成泄题；揭晓状态用 `role="status"` + `sr-only` 的 `IPA:` 前缀播报。
- **回归断言**：`vocabulary-ratings-web-smoke.mjs` 校验题面不含 `/ˈfɒləʊ ʌp/`、按钮文案为 `Show the IPA`、无 `.review-letter-hint`、点击后出现音标且答题框 `top` 不变。

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
- **宽度统一**：共享最小宽度 `var(--action-min-width)`（`9rem` / `144px`）作用于 `.primary`，让短标签主动作（`Send` / `Search` / `Look up` / `Ask AI`）宽度一致、不再过窄；长标签按钮与突出 CTA（`Check answer` `180px`、`Start practice` `13rem`）按内容自然加宽，不被压缩。圆形变体（紧凑悬浮按钮 `48px`、Handbook 笔记开关 `44px`）单独声明最小宽度以保持正圆；窄屏仍沿用各页 `width: 100%` / `min-width: 0` 规则。次级按钮与分页（`Previous` / `Next`）保持内容自适应，不套用该最小宽度。
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
- **代表操作**：`🔊 Audio hint`、`💡 Show the IPA`、`Review due words` 快捷条。

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
