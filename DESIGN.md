---
name: ClearWrite Design System
description: 以 Writing 及全功能学习套件示例图为基准的全站界面、控件规范与交互体系
---

# ClearWrite Design System · v2.1 (Polished Edition)

更新日期：2026-11-02。本规范全面整合 ClearWrite 英文学习工作台的视觉层级、响应式布局、状态契约及**深度打磨的按钮与悬浮操作体系（Buttons & FABs System）**。

---

## 1. 设计方向与设计原则

ClearWrite 是一款集“写作润色（Writing/Grammar/Express）”、“词汇构建（Vocabulary/Lookup/Review/Library）”、“独立练习（Practice）”、“AI 研讨（Ask/Saved Notes）”与“学情洞察（Overview/Handbook/Coach）”于一体的高专注度语言工作台。

- **三层认知底色**：
  - `--canvas` (`#f7f9fc`): 极淡灰蓝底色，提供宁静、不刺眼的阅读底景。
  - `--paper` (`#ffffff`): 高亮白表面，承载主操作卡片、主要阅读区、对话流。
  - `--wash` (`#f1f5f9`): 浅灰辅色区，用于胶囊导航槽底、辅助区块与次要提示。
- **高对比核心视觉焦点**：
  - 深蓝曜石黑 `--ink` (`#101827`) 作为主干文字与主要确认动作底色。
  - 品牌青柠色 `--accent` (`#84cc16` / `#a8e540`) 作为视觉画龙点睛之笔（Logo星标、主操作推进箭头、激活标签小圆点、学习提示高亮）。
- **学习证据的真实性**：
  - 界面绝不混淆“一次性语法纠错成功”、“当次测试答对”、“词汇自评分数”与“长期记忆掌握”。
  - 维持现有 Hash 路由与 Markdown 存储心智（Obsidian Vault 真实关联）。

---

## 2. 颜色与 Token 系统

共享全局 CSS 变量定义如下：

| Token | 色值 | 语义与用途 |
|---|---|---|
| `--canvas` | `#f7f9fc` | 全站浅灰蓝画布背景 |
| `--paper` | `#ffffff` | 卡片表面、输入主体、顶部栏、弹窗背景 |
| `--ink` | `#101827` | 主标题、深色主按钮底色、重要阅读文字 |
| `--muted` | `#64748b` | 次要文字、占位符、辅助时间戳与元数据说明 |
| `--wash` | `#f1f5f9` | 胶囊导航槽底、弱化辅助区域、浅灰背景 |
| `--line` | `#e2e8f0` / `#e5ecf4` | 极细分割线、静止卡片轮廓（1px） |
| `--control` | `#8391a4` | 可聚焦与可编辑表单控件外边框 |
| `--accent` | `#84cc16` | 品牌青柠色、主操作右移小箭头、关键节点标示 |
| `--accent-hover` | `#65a30d` | 青柠主色 hover / active 态 |
| `--accent-text` | `#486b1b` | 浅底上的青柠品牌文字、徽标标题及小图标 |
| `--accent-soft` | `#f1fbdf` / `#ecfccb` | 极淡青柠背景、选中参数卡片、提示区高亮 |
| `--success` / `--success-bg` | `#10b981` / `#ecfdf5` | 修正达成、连续记忆掌握 (Retained) |
| `--learning` / `--learning-bg`| `#0284c7` / `#eff6ff` | 学习推进中状态 (Learning) |
| `--warning` / `--warning-bg` | `#f59e0b` / `#fffbeb` | 强化复习标记 (Needs reinforcement)、Remember 提示 |
| `--danger` / `--danger-bg`  | `#ef4444` / `#fef2f2` | 语法错误标红、删除危险操作 |
| `--focus-ring` | `#74836c` | 1px/2px 无障碍键盘焦点轮廓环 |
| `--shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.05)` | 基础控件与浅卡片微阴影 |
| `--shadow-surface` | `0 4px 20px -2px rgba(16, 24, 39, 0.04)` | 标准白色内容卡片环境柔影 |
| `--shadow-floating` | `0 12px 32px -4px rgba(16, 24, 39, 0.12)` | FAB、对话浮层、下拉菜单与阅读弹窗立体阴影 |

---

## 3. 按钮系统与微交互规范 (Polished Buttons System)

系统将全站操作明确划分为五大层级，提供极致的手感、无障碍保障与微交互：

### 3.1 主动作按钮 (Primary Action Button)
- **外观**：深蓝曜石色背景（`background: var(--ink)`），白色字（`color: #ffffff`），右侧常驻青柠定向箭头（`→`，颜色为 `var(--accent)`）。
- **规格**：高度统一为 `48px`（大面板核心动作为 `52px`），内边距 `0 1.5rem`，圆角 `var(--radius-control)`（`12px` 或 `16px`）。
- **交互状态**：
  - *Default*：深邃平整，文字清晰，无重投影。
  - *Hover*：背景转为 `#1e293b`，小箭头带轻微平移 `transform: translateX(3px)`，整体微浮升 `transform: translateY(-1px)`。
  - *Active*：缩放微反馈 `transform: scale(0.98)`，背景转为 `#080f1b`。
  - *Focus-visible*：`outline: 2px solid var(--accent)`，带 `2px` 间隙偏移。
  - *Disabled*：背景 `#e2e8f0`，文字 `#94a3b8`，光标 `not-allowed`。
- **代表操作**：`Check answer →`、`Look up →`、`Start practice →`、`Send →`、`Save file locations`。

### 3.2 次级与轮廓按钮 (Secondary & Outlined Buttons)
- **外观**：纯白表面（`var(--paper)`），细边框（`1px solid var(--line)`），文字为中深色 slate（`#334155`）。
- **规格**：高度 `44px` 或 `48px`，圆角 `12px`。
- **交互状态**：
  - *Hover*：边框强化为 `var(--control)`，背景轻微置换为 `var(--wash)` (`#f8fafc`)。
  - *Active*：`transform: scale(0.98)`。
- **代表操作**：`Saved words`、`Reset`、`Previous / Next`、`Start a new session`。

### 3.3 品牌轻量辅助与学习提示 Chip 按钮 (Hint & Soft Action Chips)
- **外观**：浅青柠底色（`var(--accent-soft)`），深青柠文案与图标（`var(--accent-text)`），边框为半透明青柠边（`1px solid #d9f99d`）。
- **规格**：高度 `36px - 40px`，圆角胶囊（`rounded-full` 或 `8px`）。
- **代表操作**：`🔊 Audio hint`、`💡 Show first letter`、`Review due words` 快捷条。

### 3.4 图标按钮 (Icon Buttons)
- **规格**：外层触控命中区域严格保持 `≥ 44×44px`（无障碍黄金法则），视觉图标区域可居中为 `32×32px` 或 `20px` 矢量图形。
- **外观**：默认透明或浅灰底，hover 时呈现浅圆底面（`var(--wash)`）。
- **代表操作**：复制气泡（`Copy`）、发音圆圈、关闭弹窗（`Close / Esc`）、日历与设置切换。

---

## 4. 悬浮操作按钮与快捷入口规范 (FABs System)

为提升长文档与阅读视图下的操作触达率，制定 Floating Action Buttons (FAB) 体系：

### 4.1 扩展型胶囊悬浮按钮 (Extended FAB)
- **尺寸与形态**：高度 `52px`，全圆角（`border-radius: 9999px`），内边距 `0 1.5rem`。
- **视觉风格**：
  - 风格 A（主功能悬浮）：深曜石黑背景（`var(--ink)`），白色字与高亮青柠图标，搭配深层阴影（`box-shadow: var(--shadow-floating)`）。
  - 风格 B（高能唤起）：白底搭配 1px 细线边框，左侧带动态青柠小圆点或高亮图标。
- **动效微交互**：
  - 页面初次滚动至阈值时淡入上浮：`animation: fabEnter 250ms var(--ease-out)`。
  - Hover：`box-shadow: 0 16px 36px -4px rgba(16, 24, 39, 0.18); transform: translateY(-2px);`。
  - Active：`transform: scale(0.97);`。
- **代表场景**：Saved notes 列表长滚动时的 `+ Ask a question →` 浮动条、长词汇库底部的 `Review due words` 浮动胶囊。

### 4.2 紧凑型圆形悬浮按钮 (Compact Circle FAB)
- **尺寸**：直径 `56px × 56px` 正圆形。
- **布局定位**：桌面端/移动端右下角（`bottom: 2rem; right: 2rem`），避开内容安全边界与滚动条。
- **功能**：快捷唤起“Ask AI 浮动研讨窗”或快速回到顶部。

---

## 5. 多选项卡片与状态选择按钮组 (Choice & Selector Group)

在 Practice 设置与 Review 评价中，选项卡片兼具 Button 的可点击特性与表单的互斥状态：

- **普通态**：白底，1px `--line` 边框，无下沉。
- **选中态**：
  - 背景切换为浅青柠（`var(--accent-soft)`）。
  - 边框切换为聚焦青绿色（`#84cc16` 或 `#74836c`）。
  - 右上角带浅绿勾选标记（`✓`）。
  - **禁止仅改变文字颜色**，必须有整体背景与边框的明显材质响应。
- **Review 四级自评按键组**：
  - `Again`（未想起）/ `Hard`（费力想起）/ `Good`（正常想起）/ `Easy`（轻松想起）。
  - 四个选项保持**同等视觉权重与尺寸**，杜绝诱导评分。

---

## 6. 排版与空间节律

- **字体栈**：`Plus Jakarta Sans`, `DM Sans`, `system-ui`, `-apple-system`, `sans-serif`。
- **正文字号**：默认 `1rem` (16px)，行高 `1.65`；辅助说明 `.875rem` (14px)；标签 `.75rem` (12px)。
- **页面主标题**：`2.25rem - 3.25rem`，加粗，主标题文案下方搭配一段通透解说。
- **居中流式布局**：全站通用居中最大宽 `--workspace-max: 80rem` (1280px)，左右 `--page-gutter` 桌面 `3rem`，移动端 `1rem`。

---

## 7. 动效标准 (Motion Tokens)

| Token | 数值 | 适用范围 |
|---|---|---|
| `--duration-fast` | `150ms` | 按钮 Hover、背景色彩置换、边框高亮 |
| `--duration-normal` | `200ms` | 弹窗淡入、FAB 浮起、折叠抽屉展开 |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 柔和回弹缓动 |
| `prefers-reduced-motion` | 降级处理 | 关闭位移动画与缩放，保留即时状态切换 |
