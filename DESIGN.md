---
name: ClearWrite Design System
description: 以 Markdown 文件设置示例为基准的 ClearWrite 界面规范
---

# ClearWrite Design System · v2.2

更新日期：2026-11-09。以 Markdown 文件设置示例为基准，统一 ClearWrite 的导航、标题、面板、表单和交互状态。

---

## 1. 设计方向与设计原则

ClearWrite 是一款集“写作润色（Writing/Grammar/Express）”、“词汇构建（Vocabulary/Lookup/Review/Library）”、“独立练习（Practice）”、“AI 研讨（Ask/Saved Notes）”与“学情洞察（Overview/Handbook/Coach）”于一体的高专注度语言工作台。

- **三层认知底色**：
  - `--canvas` (`#f5f7f9`): 极淡灰蓝底色，提供宁静、不刺眼的阅读底景。
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
| `--canvas` | `#f5f7f9` | 全站浅灰蓝画布背景 |
| `--paper` | `#ffffff` | 卡片表面、输入主体、顶部栏、弹窗背景 |
| `--ink` | `#101827` | 主标题、深色主按钮底色、重要阅读文字 |
| `--muted` | `#64748b` | 次要文字、占位符、辅助时间戳与元数据说明 |
| `--wash` | `#f1f5f9` | 胶囊导航槽底、弱化辅助区域、浅灰背景 |
| `--line` | `#e2e8f0` / `#e5ecf4` | 极细分割线、静止卡片轮廓（1px） |
| `--control` | `#8391a4` | 可聚焦与可编辑表单控件外边框 |
| `--accent` | `#2fbe63` | 品牌图标底色、激活圆点和关键节点标示 |
| `--accent-hover` | `#218343` | 绿色主色 hover / active 态 |
| `--accent-text` | `#166534` | 浅底上的绿色品牌文字、徽标标题及小图标 |
| `--accent-soft` | `#edfbf2` | 极淡绿背景、选中参数卡片、提示区高亮 |
| `--accent-border` | `#d5efdf` | 浅绿标签底色、选中标签和状态提示的细边框 |
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

- 顶部栏使用白底和细分隔线，桌面高度约 `84px`。绿色圆角方形标识与深色 ClearWrite 字标组成品牌入口。主导航直接排在白底上，当前入口用浅灰圆角底和绿点标识。设置使用圆形轮廓图标按钮，语言选择器使用浅灰底和下拉箭头。窄屏收起为可键盘操作的菜单。
- 页面标题区按分类标签、主标题、简短说明排列。沿用同一标题层级和浅绿标签处理，各学习页面按任务需要保留编辑器、练习选择、词表或报告布局。
- 设置页面使用带图标的独立标签按钮。默认白底细边框，选中态为浅绿底、深绿文字和图标。支持方向键、Home 和 End 切换。Markdown 标题右侧的文件夹插图为装饰，手机端隐藏。
- 模型设置和 Markdown 文件设置共用工作区的宽度、左右边距和标题区高度。标题、标签和面板的左边缘对齐，切换标签时内容起始位置保持稳定。
- Markdown 设置使用一个白色面板，桌面圆角 `32px`。面板标题区包含浅绿图标、标题和说明。下方通过细分隔线区分文件夹、文件和操作区。
- 每项依次显示标签、说明和路径控件。路径使用等宽字体和浅灰底，保留可编辑性。桌面将浏览按钮放在输入框右侧，手机端移至输入框下方。文件夹和文件各自按单列排列。
- 面板底部左侧显示深色保存按钮和白底重置按钮，右侧显示浅绿状态提示。手机端可换行。成功提示以实际配置和保存结果为依据，错误在操作区内显示。

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
