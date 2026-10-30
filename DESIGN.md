---
name: IGT Design System
description: 面向真实表达、理解与独立练习的现代英语学习工作台设计规范
---

# IGT Design System · v1.0

## Overview

### 定位与适用范围

IGT 是现代、专业、交互明确的英语学习平台。界面应让用户读懂语言差异、完成回忆与表达、辨认学习记录的状态，并清楚知道下一步可以做什么。

设计方向为**专注的语言学习工作台**：以米白阅读面、深蓝结构和珊瑚色操作强调延续现有身份；通过排版、内容分组、逐步揭示和及时反馈提高精致度。高信息密度来自清晰组织与渐进披露，不来自缩小正文或堆叠统计卡。

本文件是**待实施的目标规范**，不是对当前 UI 已完成情况的声明。日期：2026-09-24。依据为 [UI 审查报告](archive/UI_AUDIT.md)；原 `docs/UI_AUDIT.md` 已移至该归档位置。本文继承其 F01–F17 编号。现有实现依据为 `apps/web/src/App.tsx`、`apps/web/src/visual-system.css`、`Icon.tsx` 和 `api/client.ts`。当前样式入口由 `main.tsx` 导入；未加载的旧 `styles.css` 已于 2026-10-07 清理。

本阶段仅建立规范，不改 UI、业务逻辑、API、学习数据或导航架构。本文新增组件名称、状态及 token 均指未来实施目标。未创建根目录 DESIGN.md、组件代码或工具专用 sidecar。

### 强制边界

- 保留 9 个页面及 hash 路由；保留总览与“语言工具 / 练习工作台 / Ask / 学习系统”分组。
- 保留学习证据边界：诊断、词汇自评、独立练习和 Coach 分析不能互相替代；一次成功不显示为“已掌握”。
- 保留现有主动保存行为。草稿保留不等于保存到 Review log、Vocabulary 或 Ask Markdown；Practice 的记录策略按现有业务契约执行。
- 统一基础视觉、交互与可访问性；允许页面按任务使用不同的信息结构。
- 当前以浅色内容区、深色导航为正式主题，不借本阶段引入暗色模式、账号、云同步、排行榜或新的业务模块。

### 规范级别与阅读索引

“必须”是全站约束；“默认”允许通过本文件列出的变体调整；未列出的例外需说明业务理由并补充规范。所有尺寸在默认根字号 16px 下说明，字体及间距实施时采用 rem，不能锁死用户字号。

| 所需规范 | 本文位置 |
|---|---|
| Color | Colors：语义 token、允许配对、选中与反馈颜色 |
| Typography | Typography：中英文字体、角色、字号、行宽 |
| Spacing | Layout → Spacing：4px 节奏与密度 |
| Layout | Layout：页面容器、对齐、九页布局矩阵 |
| Surface | Elevation & Depth、Shapes：表面、边框、圆角与层级 |
| Components | Components：统一组件、业务组件、接口责任 |
| States | Components → States：请求、保存、错误、草稿与完成 |
| Responsive Behavior | Layout → Responsive Behavior：断点、重排、导航与触屏 |

## Colors

### 语义 token

以下表格是 v1 的目标色值源。组件引用语义 token，业务页不能直接加入新的 hex 值。既有 token 名能保留的保留；新名字用于消除颜色角色歧义。

| Token | 值 | 使用规则 |
|---|---|---|
| `--color-bg-page` | `#f4f0e8` | 全局画布，保留 |
| `--color-bg-surface` | `#fffdf8` | 编辑区、学习内容容器，保留 |
| `--color-bg-inset` | `#ede8df` | 只读辅助区、禁用填充；不是所有卡片的底色 |
| `--color-bg-sidebar` | `#101827` | 导航；也是珊瑚色按钮上的文字色，保留 |
| `--color-bg-selected` | `#1d2940` | 选中控件、深色重点区域；兼容原 bg-focus |
| `--color-bg-hover` | `#26324a` | 深色导航 hover/active 背景，保留 |
| `--color-text` | `#172033` | 正文、标题，保留 |
| `--color-text-secondary` | `#596579` | 说明、标签、时间、次级信息；替代原偏浅的 muted 文本用途 |
| `--color-text-on-dark` | `#f6f1e7` | 深色表面主要文字，保留 |
| `--color-text-on-dark-secondary` | `#bbc3d1` | 深色表面说明，保留 |
| `--color-accent` | `#d46e5c` | 品牌装饰、活动标记；不作为普通小字色 |
| `--color-accent-button` | `#e37d68` | 主按钮默认背景，保留 |
| `--color-accent-hover` | `#d9715d` | 主按钮 hover 背景，调整 |
| `--color-accent-active` | `#d46e5c` | 主按钮按下背景；文字仍为深蓝 |
| `--color-border` | `#d8d0c4` | 非交互容器边框，保留 |
| `--color-border-light` | `#eee8df` | 分隔线，保留；不能独自承担输入控件识别 |
| `--color-border-control` | `#7c8594` | 输入框、可选项和边框型按钮的必要边界 |
| `--color-focus` | `#315b99` | 浅色表面键盘焦点、正文链接 |
| `--color-focus-inverse` | `#f5b4a5` | 深色表面键盘焦点 |
| `--color-success` / `--color-success-bg` | `#2f6b52` / `#edf5ef` | 已保存、请求成功、修正后的内容标识 |
| `--color-warning` / `--color-warning-bg` | `#875514` / `#fbf2df` | 内容已变化、证据不足、需注意；不代表请求失败 |
| `--color-error` / `--color-error-bg` | `#aa352c` / `#fbefec` | 验证失败、服务失败；破坏性动作如未来出现也使用此语义 |
| `--color-info` / `--color-info-bg` | `#315b99` / `#edf2fa` | 补充说明、可选表达，不代表“正确” |

弱化信息通过字号、位置和字重实现，不再用低对比度浅灰。原 `--color-text-muted` 在过渡期只能映射到 text-secondary；不可继续保留浅色值作为普通文字。旧 `--color-bg-focus` 可暂时映射至 bg-selected；“焦点环”只能使用 focus token。

### 配对与对比度

以下比值按 sRGB 相对亮度计算并四舍五入展示；判定应使用未舍入值。它们是 token 校验，不能替代最终 CSS 合成和浏览器验证。

| 前景 / 背景 | 比值 | 用途 |
|---|---:|---|
| text / bg-surface | 16.00:1 | 正文 |
| text-secondary / bg-page | 5.19:1 | 辅助信息 |
| bg-sidebar / accent-button | 6.26:1 | 主按钮默认文字 |
| bg-sidebar / accent-hover | 5.47:1 | 主按钮 hover 文字 |
| bg-sidebar / accent-active | 5.23:1 | 主按钮按下文字 |
| text-on-dark / bg-hover | 11.39:1 | 深色导航选中项 |
| success / success-bg | 5.65:1 | 成功文字 |
| warning / warning-bg | 5.65:1 | 警告文字 |
| error / error-bg | 5.73:1 | 错误文字 |
| info / info-bg | 6.05:1 | 信息文字 |
| border-control / bg-surface | 3.66:1 | 控件边界 |
| focus / bg-surface | 6.69:1 | 浅色区域焦点 |
| focus-inverse / bg-hover | 7.30:1 | 深色区域焦点 |

规则：普通文字至少 4.5:1；必要控件边界和状态标识以 3:1 为目标；错误、选中、成功均需文字/图形或结构提示，不能只有颜色。依据沿用审查报告中的 [W3C 文字对比度说明](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)。

焦点环使用 2px 实线、3px 外偏移；偏移空隙显示所在表面，使焦点环不直接贴着珊瑚色填充。深色表面切换 inverse 环，不把同一个蓝色环套到所有背景。

### 色彩分工

- **主动作统一**：每个当前任务区只有一个最高强调动作，使用珊瑚色。检查、生成、提交和保存的最高优先级随阶段变化，不因页面名称换色。
- **深蓝表示结构和选择**：导航、分段选中、聚焦内容背景；不能让“保存按钮”与“生成按钮”各自建立第二套主色规则。
- **成功不等于掌握**：绿色可以表达“评价已完成”“保存成功”，不得仅凭一次正确将词条标记为掌握。
- **学习标注**：Original 用中性；Correction 可用成功色边标；Why 用正文；More natural 用信息色；Remember 用警告色小面积提示。长文本仍用 text，避免整篇染色。
- 不使用渐变统计卡、整页饱和彩色面板或无语义彩色标签。图表只用一个强调序列与中性色，比较必须有数据标签和明确尺度。

## Typography

### 字体与加载

统一保留 `"DM Sans", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`。英文学习内容、中文说明、控件使用同一字体系统，通过角色区分，不引入装饰性标题字体。

目标实现应采用项目可用的本地字体资源或系统回退，字体加载不得阻止学习内容显示；如果继续使用远程字体，应保留 swap 与无网络回退。字体是否本地打包需核实资源许可，本规范不要求本阶段下载资源。不要用 CSS 模拟不存在的字重。

### Typography 角色

| Token / 角色 | 桌面字号 | 手机字号 | 字重 / 行高 | 场景 |
|---|---:|---:|---|---|
| `--type-display` | 36px / 2.25rem | 28px / 1.75rem | 600 / 1.3 | 总览短主张；同屏最多一个，不用于每张卡 |
| `--type-page` | 28px / 1.75rem | 24px / 1.5rem | 600 / 1.35 | 各工作区 h1 |
| `--type-section` | 20px / 1.25rem | 20px | 600 / 1.4 | h2、结果大段标题 |
| `--type-subsection` | 16px / 1rem | 16px | 600 / 1.5 | 字段组、结果小标题 |
| `--type-learning` | 18px / 1.125rem | 18px | 400 / 1.7 | 需要仔细辨认的英文原句、修正、译文、题干 |
| `--type-body` | 16px / 1rem | 16px | 400 / 1.65 | 中文解释、对话、正文 |
| `--type-ui` | 14px / .875rem | 14px | 500 / 1.5 | 按钮、导航、字段标签、次级说明 |
| `--type-meta` | 12px / .75rem | 12px | 400 / 1.5 | 时间和不影响决策的补充元信息 |

正文与控件输入不得缩到 13px。输入控件文字至少 16px，字号不随 compact 模式变小。错误、帮助、保存状态至少 14px，不能套 metadata。h1/h2 使用正常中文字距；英文 display 可用 -0.01em，禁止对整段中文加大字间距。

### 阅读和语言内容

- 英文解释默认最大 68ch；中英混排长解释最大约 40em，支持时可用 40ic 约束中文行宽。容器仍以可用宽度为上限。
- 句子允许完整换行，不截断需要学习的 Original、Correction、题干、答案与反馈。单词、音标不按任意字母强制断开；极长 URL 和异常无空格文本才允许 anywhere。
- 原文与修正并排时字号相同。差异除颜色外还需下划线、删除标记或“原句/修正”标签；不把模型无法定位的差异伪造成精确词级 diff。
- Remember 和多条解释用真实列表，保留条目间距，不能将数组直接拼接为段落。
- 对话中的标题、列表、强调使用结构化排版；Markdown 渲染需禁用未信任原始 HTML。用户输入保持文本语义，不作为可执行内容。
- 英文片段按实际语言标记 `lang="en"`，界面主体 `lang="zh-CN"`；图标不被重复朗读。
- 数量、日期使用 tabular-nums。时间以用户配置时区格式化，列表显示可读日期/时间，完整时间可访问；不要把原始 ISO 时间当默认文案。

## Layout

### Spacing 与密度

沿用 4px 基础网格；空间 token 与像素对应如下，实施值用 rem。

| Token | 值 | 默认用途 |
|---|---:|---|
| `--space-1` | 4px | 图标微间距、紧邻辅助文字 |
| `--space-2` | 8px | 图标与标签、字段 label 与控件 |
| `--space-3` | 12px | 同组控件、操作按钮之间 |
| `--space-4` | 16px | 相关字段、段落组、手机容器内边距 |
| `--space-5` | 20px | 中等宽度内容边距、紧凑模块内边距 |
| `--space-6` | 24px | 桌面容器内边距、表单字段组间隔 |
| `--space-8` | 32px | 页面主要分区、标题至内容 |
| `--space-10` | 40px | 少量独立大分区 |
| `--space-12` | 48px | 宽屏页面边距与底部留白 |

默认密度：正文行高不压缩、模块间 24px、内部字段间 16–24px。紧凑密度仅用于最近活动、词条属性、分类列表：行内 padding 可从 16px 降至 12px，辅助间距从 12px 降至 8px；不得缩小正文、错误提示或交互目标。

空间责任必须单一：Button 无外边距；ActionGroup 管理按钮 gap；Field 管理 label/hint/error；Panel 管理内边距；Page 管理模块间距。禁止按钮带 margin-left 后再由不同页面反向抵消。

### 页面壳与容器

- 桌面保留左侧导航与右侧内容；导航宽 240px，平板宽 200px。
- 内容区域居中；**最大宽度定义为内容内框宽度，不含侧栏和外侧 padding**，避免沿用旧 main max-width 的不同解释。
- 顶部全局栏默认最小高度 64px，显示当前位置和简洁服务状态；允许换行，不固定裁切高度。服务详细信息按需展开，不挤占主任务标题。
- PageHeading 与所属 PageContainer 左边缘对齐；聚焦页的标题必须跟随聚焦容器，不能留在外层宽容器边上。
- 页面 h1 只有一个；初次加载和错误也保留 PageHeading。视觉大小不能决定 HTML 标题等级。

| 容器变体 | 内框最大宽度 | 适用 |
|---|---:|---|
| `wide` | 1088px | Dashboard、Handbook 的索引 + 详情、宽屏 Translation |
| `form` | 880px | Grammar、Lookup、Practice 配置 |
| `focus` | 800px | Review、Practice 作答 |
| `reading` | 760px | Ask、Coach 连贯阅读 |

同一路由可在明确业务阶段由配置表单切为聚焦作答容器，但宽度切换不得改变路由或清除草稿。内容较短不是增加大面积装饰的理由；通过合理上对齐与内容宽度消化空白。

### Responsive Behavior

沿用项目 480 / 760 / 1024px 的主要断点，不为单个页面继续叠加近邻断点。

| 视口宽度 | 导航 | 内容左右边距 | 排列 |
|---|---|---:|---|
| ≤480px | 顶部品牌 + 导航展开按钮 | 16px | 单列；操作在内容之后 |
| 481–760px | 同上 | 20px | 单列；紧凑属性可横排 |
| 761–1024px | 200px 侧栏 | 32px | 单列为主；只有容器满足条件才分栏 |
| ≥1025px | 240px 侧栏 | 48px | 按容器变体和任务分栏 |

断点范围不能重叠覆盖。分栏以**容器可用宽度**进一步约束：两列英文对照各至少 360px、间距 24px；Dashboard 两列各至少 360px；不足时自动单列。Handbook 索引 240px、间隔 24px、详情至少 480px，容器不足 744px 时改为上方分类区。

手机行为必须明确：

1. 导航继续使用文档流内展开，保留四个分组，不新增第二套底部导航。展开区过长时内部可滚动，最大高度 `calc(100dvh - 80px)`；Escape 收起并回到按钮，选页后收起并将焦点移至页面标题。非模态导航不使用焦点陷阱。
2. 单行查询表单在 ≤480px 时竖排，主按钮全宽；文本表单操作组允许主按钮全宽、次要动作下一行，维持 DOM 顺序。
3. Review 四个评分控件在 <480px 时固定 2×2，其他宽度足够时四列；禁止出现 3+1 的不均匀布局。
4. 词条标签/值在 <480px 改上下排；解释不折叠或截断。Handbook 分类用可展开的原生选择列表或竖向按钮组，不做隐藏的横向滑动导航。
5. 选择题按选项实际长度排版；只有每列至少 280px 才可两列，否则一列。所有选项允许多行。
6. 默认不固定底部操作条。需要 sticky 的 Ask 输入区或长练习操作区必须预留等高空间，考虑 safe-area；视口高度 <640px 或屏幕键盘遮挡时退回正常流，不遮挡答案和错误。
7. 320px 下主要任务无横向页面滚动；200% 文字放大不裁字，400% 缩放按重排检查。局部代码或真正二维表格可以具名滚动，但当前学习正文不得借此横向溢出。
8. 触屏目标至少 44×44px，主要动作默认高 48px；hover 只能增强，不承载唯一说明或操作。

### 页面差异化矩阵

路由和导航名称保持现状。下列是布局与内容边界，不是要求新增功能；涉及新的动作入口必须使用现有能力与现有路由，不能假设 API 支持预填或跨页恢复。

| 页面 / 路由 | 类型与容器 | 独立设计重点 | 必须共用 |
|---|---|---|---|
| Dashboard `/#dashboard` | 任务总览，wide | 当前建议在前，最近表达按行组织，节奏与资产状态辅助；不用四张大数字卡开场 | AppShell、Heading、Activity、Status、Button |
| Grammar `/#grammar` | 表单 + 诊断详情，form | Original → Correction → Why → 可选 More natural → Remember；保存与提交快照绑定 | Field、ActionGroup、ResultSection、SaveAction |
| Translation `/#translation` | 输入/结果，wide；窄屏一列 | 方向选择与同层级原文/译文；不加入 Grammar 诊断结构 | SegmentedControl、Field、ReadingText、Status |
| Lookup `/#word-lookup` | 查询 + 词条，form | 词、音标、词性、释义、搭配、例句分层；查询后添加 | SearchField、WordEntryDetails、SaveAction |
| Review `/#word-review` | 回忆工作区，focus | 提示 → 揭示 → 自评；未揭示内容不进入可访问树，不提前泄露答案 | Progress、WordEntryDetails、RatingGroup |
| Practice `/#practice` | 配置 form → 作答 focus | 一题一任务；反馈与参考表达分开；末题明确完成 | FormField、ChoiceGroup、Progress、Evaluation、AsyncState |
| Ask `/#ask` | 会话阅读，reading | 用户问题与长回答的层次；稳定输入区；请求失败独立于消息 | Message、Composer、RichText、SaveAction |
| Handbook `/#handbook` | 分类列表 + 参考详情，wide | 分类可扫描，原句/修正/解释紧邻；与“个人掌握”明确分开 | FilterControl、ExamplePair、AsyncState |
| Coach `/#coach` | 证据与计划报告，reading | 样本 → 优先事项 → 建议任务 → 证据限制；不足时说明下一步 | Section、TaskItem、Status、Button |

Dashboard 可使用一张有意义的书桌图片，保留现有素材；图片在手机不应先于当前任务，不为其它页面重复添加 hero。装饰图用空 alt，内容图需有效替代说明。不以插画或卡片数量作为精致度指标。

## Elevation & Depth

### Surface

用表面层次与边线组织信息，阴影仅在需要区分浮层时出现。

| 表面角色 | 背景与边界 | 内边距 | 允许用途 |
|---|---|---|---|
| Canvas | bg-page，无边框/阴影 | 由 Page 控制 | 页标题、阅读式报告、分区之间 |
| Panel | bg-surface，1px border | 桌面 24px、手机 16px | 编辑表单、独立任务、词条 |
| Inset | bg-inset，无阴影 | 16px | 辅助说明、只读摘要；不能包裹全部正文 |
| Semantic callout | 语义 bg，3px 语义色左边线 + 图标/标题 | 16px | 成功/失败/警告/重要提示 |
| Inverse | bg-selected，text-on-dark | 24px | 总览当前任务、小范围选中结构 |
| Floating | bg-surface，1px border + overlay shadow | 16–24px | 未来确需的弹层、浮动菜单 |

同一 Panel 内优先使用分隔线、留白和小标题；默认不再嵌套第二层圆角卡。长报告可以直接排在 Canvas 上。只有可点击容器才出现交互 hover，普通内容卡不漂浮、不显示手型。

### 阴影与层级

| Token | 值 | 规则 |
|---|---|---|
| `--shadow-none` | `none` | 页面、正文容器、主按钮默认 |
| `--shadow-low` | `0 3px 8px rgba(23,32,51,.18)` | 按钮默认层次；不用于页面容器 |
| `--shadow-hover` | `0 5px 12px rgba(23,32,51,.22)` | 按钮 hover 的短暂强调；不用于静止控件 |
| `--shadow-overlay` | `0 8px 24px rgba(23,32,51,.14)` | 浮层；配合边框而非纯阴影识别 |
| z-index：base / sticky / popover / modal / message | `0 / 10 / 20 / 30 / 40` | 层级角色；仅实际出现时使用，不因此新增 modal 或 toast |

## Shapes

| Token | 值 | 用途 |
|---|---:|---|
| `--radius-sm` | 6px | 小标记、提示区域 |
| `--radius-md` | 10px | 按钮、输入、分段控件 |
| `--radius-lg` | 16px | Panel、学习任务容器 |
| `--radius-xl` | 20px | 总览重点区域；不用于所有卡片 |
| `--radius-full` | 999px | 进度轨道、短状态徽标；普通按钮不用 pill |

边框默认 1px；focus 与选中边框可用 2px，但预留空间或内描边，避免状态切换抖动。图标沿用现有 24×24 viewBox、1.65 描边；常规显示 20px、紧凑元信息 16px、品牌 28px。图标与文字 gap 8px，不能各页更换图标风格或混入 emoji 充当系统控件。

## Components

### 必须统一的组件

“统一”包含交互契约与可访问性，不只是 CSS 类。组件暴露少量显式变体，业务模块负责数据与副作用，基础组件不直接请求 API。

| 组件 | 核心接口责任（目标） | 必须统一 |
|---|---|---|
| AppShell / WorkspaceNav | route、items、移动展开状态 | 分组、活动项、焦点、路由标题、导航关闭 |
| PageContainer / PageHeading | width=wide/form/focus/reading；title、description、actions | 对齐、标题级别、间距；eyebrow 可选且不用占位空行 |
| Panel / Section | title、description、actions、children | 表面、内边距、标题语义；Panel 是有表面的容器，Section 可以无表面 |
| Button / IconButton | variant、size、pending、disabled、accessibleName | 颜色、尺寸、焦点、双击防护、请求文案 |
| ActionGroup | align、wrap、mobileLayout | 外部间距、排列顺序；不让按钮自带布局 margin |
| FormField / TextInput / TextArea | id、label、hint、error、required、value | 显式 label、错误关联、字号、只读/禁用区别 |
| SegmentedControl / ChoiceGroup | value、options、onChange、disabled | 互斥选择、键盘、选中语义；不为表单选项误用 tabs |
| AsyncState / StatusMessage | kind、title、detail、retry/action | 空/忙/错/成功的区别、角色和恢复 |
| SaveAction | state、onSave、onRetry、destinationLabel | 保存快照、成功回执、防重复；不决定是否应该自动保存 |
| Progress | completed、total、currentLabel | 已完成比例、数字标签、可访问语义 |
| ReadingText / RichText | 内容、语言、支持的结构 | 行宽、段落、列表、代码与链接安全 |
| WordEntryDetails | 标准化字段、可见字段范围 | 查词与揭示后复习的字段标签、空值、例句 |
| ResultSection / ExamplePair | label、tone、结构化内容 | 标题、英文排版、原文与结果对照；不推断正确性 |
| Icon / StatusBadge | name、size；state、label | 描边、可访问名称、语义配色 |

禁止通用 `UniversalLearningCard(data:any)` 同时处理诊断、评分和计划。它们只能复用排版基础，不共用模糊的结果数据模型。

### Button 与 ActionGroup

- **Primary**：accent-button + bg-sidebar 文字；默认高 48px，水平 padding 20px，ui 字体 500，圆角 md。默认使用低层级阴影与顶部内高光；hover 使用 accent-hover + shadow-hover，按下用 accent-active 与轻微内阴影，不缩放或位移。
- **Secondary**：bg-surface + text，border-control；默认使用低层级阴影，hover 使用 bg-inset + shadow-hover，active 保持深色文字。常规高 44px，水平 padding 16px。
- **Ghost**：透明 + text-secondary，hover 用 bg-inset + text；仍有完整 focus。用于非关键次要操作，不用于唯一提交入口。
- **Danger（仅有真实破坏操作时）**：error 文字/边框，必要的最高级破坏操作可用 error 背景与白字；不可用红色表现词汇 Again 自评。
- 所有按钮共用 `--radius-md` 和 150ms `--ease-out` 颜色/边框/阴影过渡；实心、边框、图标与选项按钮使用 1px 清晰边界，Ghost 与导航按钮维持无边框。保留各自语义色，不用渐变、发光或大面积投影制造质感。
- Secondary 与可选项使用低层级默认阴影，hover 使用 `--color-bg-inset` 和 `--shadow-hover`；边框型按钮使用 `--color-border-control`。
- 图标按钮沿用所在区域的表面色和语义色，hover 强化边界/图标对比；圆形图标按钮保持圆形，不被通用圆角覆盖。
- 所有按钮键盘焦点使用 2px `--color-focus` 焦点环和 3px 外偏移；深色导航使用 `--color-focus-inverse`。selected 状态继续用深蓝填充与反差文字，不能只改变边框。
- IconButton 的外部目标至少 44×44px；必须有可访问名称，tooltip 只能补充。
- pending 保持宽度，显示对应操作名，例如“检查中…”与“保存中…”不能混用；设置 aria-busy，阻止当前操作重复派发，但不冻结无关页面功能。
- disabled 使用 bg-inset、text-secondary、清楚原因和等待/禁用光标，不对整个按钮或容器设 opacity；不能只把可点按钮变浅。ActionGroup gap 12px，状态提示邻接动作。
- 同一任务区同时出现检查和保存时，当前下一步使用 Primary，另一操作使用 Secondary；不可两颗同等强调的“主按钮”长期竞争。

### FormField 与输入

- 单行默认高 48px，padding 12px 16px；textarea 最小高 160px，允许垂直扩展，无固定最大内容高度；控件文字 16px。
- 可见 label 14px/500，下面 8px 放控件；提示/错误在控件后 8px，使用 14px。placeholder 仅举例，不替代 label。
- 默认 bg-surface、border-control；focus 保留轮廓；invalid 用 error 边界和错误文字，关联 aria-invalid/aria-describedby。不要只靠红边。
- readonly 可聚焦、可选择复制、仍有 label；disabled 不接收输入并说明原因，不能用来显示用户需要阅读的结果。
- 输入空白时必须有确定行为：用户尝试提交后提示“请输入一句英文”；不能点击无反馈。若预先禁用提交，附近需能发现原因。
- 单行搜索 Enter 提交；textarea 默认 Enter 换行，可提供明确可见的 Ctrl/Cmd+Enter 提交提示。组合输入期间 `isComposing` 为 true 不提交。

### 选择、导航与焦点

- Translation 方向、Practice 模式和题量属于表单互斥选择，优先使用原生 radio + 可视分段样式；方向键切换、Tab 进入/离开一组。选中后深蓝底、浅色字，同时有 checked 语义。
- Handbook 分类是筛选控件，明确 label 与当前值；若用按钮组则有 aria-pressed；不用只有 selected CSS 的假状态。
- ChoiceGroup 同样使用互斥语义，选中用边界和勾选符号，A/B/C 是序号而非判断正确。提交前不给正确/错误配色。
- 导航使用指向原 hash 的链接，当前项 aria-current=page；分组展开是 button + aria-expanded/controls。整个展开/收起目标至少 44px。
- 页面切换更新文档 title 为“页面名 · IGT”，焦点落至页面标题或主区域，首次进入回到顶部；返回已有草稿可恢复阅读位置，不无条件滚到结果末尾。
- 保留“跳到主内容”；其锚点不得被业务 hash 路由当作新页面。未知 hash 显示“找不到该页面”及返回总览，不显示开发占位。
- 如未来需要 modal，必须有名称、Escape、焦点约束与关闭后恢复；普通导航、内联错误不使用 modal。

### States：全站状态契约

| 状态 | 可见反馈 | 交互与辅助技术 | 必须避免 |
|---|---|---|---|
| idle / ready | 输入与可执行动作，必要提示 | 可正常操作 | 伪造“已准备好”的服务成功状态 |
| loading（初次） | 保留标题，内容区占位 + “正在读取…” | 区域 aria-busy；状态文字礼貌播报一次 | 把加载误显示成“没有到期卡片” |
| refreshing | 旧内容保留，明确“正在更新” | 新结果返回前旧分类/数据关联不变 | 切新标签却显示未标记的旧数据 |
| empty | 没有内容的具体原因 + 一个现有下一步 | 正常空态，不当 alert | 空白卡片、堆“暂无”字段 |
| invalid | 错误贴近字段，保留输入 | 聚焦首个无效字段 | 清空输入或只禁用按钮 |
| request-error | 人话说明、影响、恢复动作；技术详情可展开 | 主任务失败可 role=alert；提供重试 | 原始异常成为整页唯一内容 |
| success | “已检查 / 已记录 / 已保存”等精确回执 | role=status；不抢焦点 | 将完成请求显示为“已掌握” |
| stale-result | “输入已修改，请重新检查/查询” | 禁止把新输入与旧结果保存；旧结果可读 | 悄悄拼接不同版本 |
| saving | “正在保存…”且锁定该快照 | 允许其它无冲突阅读操作 | 全局 busy 导致所有动作同名 |
| saved | 目标位置 + 已保存状态，邻接结果 | 相同快照不再重复提交 | 短暂 toast 消失后看不出状态 |
| save-error / uncertain | 区分确定失败与响应未确认 | 只有可安全重试时给“重试保存” | 网络超时后断言未写入并盲目再次写入 |
| completed | 本轮数量、结果概况、记录状态、下一步 | 末题明确“完成本轮”，允许回看已有结果 | 跳回初始页且无完成反馈 |

错误分类使用现有客户端 code/retryable，不按文案字符串猜测。GET 读取重试与写入重试分开；写入超时可能已被服务端处理，缺少幂等键/状态查询时，先显示“保存结果尚未确认”，提供检查已有记录的实际路径或说明，不能编造后端能力。

加载反馈立即切换动作状态；超过 10 秒可补充“仍在处理，请稍候”，不得伪造百分比。初次加载可延迟约 300ms 再显示骨架避免闪烁，骨架不放在已经有内容的区域上闪回。取消仅在真实可取消时提供；Abort 前端请求不等于撤销服务端写入。

### 草稿、结果与保存的生命周期

1. 路由之间保留输入、会话和进行中的练习；状态所有者高于页面卸载边界。最低交付范围是本标签页内导航，不能声称已持久化到磁盘。
2. 对刷新/关闭造成的未保存内容丢失，至少使用浏览器支持的离开提醒；若后续增加刷新恢复，明确使用位置、保留时间和清除入口，单独验证。不得悄悄写入正式学习资产来冒充草稿保存。
3. 每次请求记录输入快照与 requestId；晚到的旧响应不能覆盖较新请求。输入变化使结果 stale；保存只接受关联结果的原始快照。
4. 页面内可以继续编辑，但必须展示“以下结果对应上次提交”；主路径通过重新提交恢复可保存状态。
5. SaveAction 的状态是 unsaved → saving → saved / error / uncertain。内容改变后变 dirty；已经保存的旧版本仍为已保存，新版本不能沿用旧回执。
6. 评分和写入成功确认后才推进题目/卡片；失败保留当前内容。前端防重复不能替代后端幂等，实施任务需分别验证。

### 学习业务组件：允许独立，语义不可混用

| 组件 | 独立内容规则 | 复用范围 |
|---|---|---|
| GrammarResult | 修正、原因、可选自然表达、逐条 Remember；Original 作为比较上下文 | ResultSection、ReadingText、SaveAction |
| WordEntryDetails | word、读音、词性、中文/英文释义、搭配、例句、备注；无值字段按契约省略 | Lookup 与 Review 揭示后共用；不内置 reveal/grade |
| ReviewSession / RatingGroup | 隐藏答案、揭示、自评、排程；Again/Hard/Good/Easy 附中文回忆程度说明 | Button、Progress、WordEntryDetails |
| PracticeEvaluation | 反馈、参考表达、存在且定义明确的分数、记录状态；禁止原始 JSON | ResultSection、Status；不是 GrammarResult |
| AskMessage / Composer | question、answer、请求错误分别建模；失败消息不成为助手回答或保存正文 | RichText、Field、ActionGroup |
| HandbookExample | 原句 → 修正 → 解释，保留类别与来源语境 | ExamplePair、FilterControl |
| CoachPlan | 样本量、优先级、建议任务、证据限制；无计划与服务失败区别呈现 | Section、TaskItem、AsyncState |

Review 四种自评默认同等视觉权重，不将 Good 预选，也不让 Easy 更鲜艳诱导评分。标签解释为“未想起 / 费力想起 / 正常想起 / 轻松想起”；真实排程间隔只有接口提供时才显示。

Progress 显示 `已完成数 / 总数`，作答前为 0/N；“当前第 i 题”作为独立位置标签。未知总量用不确定进度，不造百分比。优先使用原生 progress 并提供名称与数值说明。

Dashboard 最近活动可先显示 2–3 行摘要，但必须能展开完整内容；学习详情不可截断。图条使用可解释的统一尺度，不固定超过 5 条就满格。Coach 的限制说明保持可访问，不能为了界面积极而隐藏证据不足。

### Motion 与交互反馈

| Token / 行为 | 值 | 使用 |
|---|---|---|
| `--duration-fast` | 150ms | hover、边框、颜色 |
| `--duration-normal` | 200ms | 展开、选中标记、进度变化 |
| `--ease-out` | `cubic-bezier(0.16,1,0.3,1)` | 沿用已有缓动 |
| pending spinner | 700ms linear | 仅请求中，配文字；不持续装饰 |

普通按钮不缩放或位移布局；按下以颜色和轻微内阴影反馈，hover 可使用低层级阴影，不做上浮动画。结果展开不做翻牌、弹跳或全屏转场；避免文档读取后还等待入场动画。超过 200ms 的装饰性动画不进入基础组件。

`prefers-reduced-motion: reduce` 时关闭旋转、位移和尺寸动画，保留静态图标、状态文字与即时展开。交互性来自准确响应、键盘支持、焦点恢复和错误可重试，不通过更多动画证明。

### 文案规范

- 保留当前导航名称与信息架构，首次出现必要时补充一句中文解释；未来统一导航译名应单独评审，不在组件迁移中顺手重命名。
- 操作采用动词 + 对象：“检查这句话”“查询单词”“生成练习”“保存到 Review log”。同一种动作全站保持同名。
- 空态说明发生了什么和下一步；错误说明用户工作是否保留。例如“暂时无法生成练习，你的设置已保留。请重试。”
- “保存成功”只在响应确认后显示；“未找到词汇文件”和“没有到期卡片”不能混用。
- 存储、Runtime、SQLite 等技术信息放到状态详情；涉及保存目标时可以保留 Markdown 文件语义，不为简化文案隐藏资产归属。

## Do's and Don'ts

### 必须遵守

- 以英语学习内容为视觉中心，让用户能比较、回忆、作答、理解；主标题与正文建立稳定层级。
- 必须共用 token、Button、Field、Status、选择控件、页面容器、导航与 focus 规则。
- 业务页可改变布局、信息顺序、阅读宽度、渐进披露和专属结果组成，不能改变相同控件的状态含义。
- 已有功能、存储与证据边界不因“统一设计”被删减；不为迁就通用组件合并 Grammar、Practice、Review 和 Coach。
- 默认用分区和列表承载密度；卡片只表示独立任务、编辑表面或值得独立识别的内容。

### 禁止模式

- 不用“顶部四张 KPI 卡 + 趋势图 + 下方表格”作为所有页面模板。
- 不为每页独立定义主按钮色、圆角、加载图标、错误样式或 13px 版本的正文。
- 不用开发错误、原始 JSON、Markdown 标记或重复“暂无”填充主要结果区。
- 不把一次正确、AI 建议或词汇自评画成持久掌握；不让语义色夸大数据结论。
- 不添加无接口支持的取消、撤销、计划启动、保存验证或跨设备恢复入口。
- 不把后端 Handbook 的故障、重复写入或数据契约不匹配解释为纯视觉问题。

### 前端实施约定（目标，未执行）

仍使用现有 React/TypeScript 与 CSS，不要求引入大型 UI 库或重建路由。推荐逐步形成以下职责；名称可随项目约定调整，但边界不得混淆：

| 层 | 建议归属 | 责任 |
|---|---|---|
| 基础规范 | `apps/web/src/styles/` 的 tokens/base 文件 | 色值、字体、空间、基础语义；只定义一处 |
| UI primitives | `apps/web/src/components/ui/` | 无业务副作用的 Button、Field、Status、Progress |
| 页面布局 | `apps/web/src/components/layout/` | Shell、Nav、PageContainer、Heading |
| 学习展示 | `apps/web/src/components/learning/` | 有类型的 WordEntry、ExamplePair、ResultSection |
| 页面/状态编排 | `apps/web/src/pages/` 与适当的状态层 | 业务请求、快照、保存策略、页面生命周期 |
| API adapter | 保留现有 `api/client.ts`，按需补展示适配 | 将响应形状转换为明确 view model；组件不猜 result/data 分支 |

CSS 按 tokens → base → components → page variants → responsive 的固定职责组织；页面不覆盖基础组件私有选择器。允许动态 style 的情况限于真实数值（例如进度），不用于逐页硬编码颜色/间距。不要通过文件末尾不断增加同名规则维护系统。

### 迁移顺序与审查问题对应

| 阶段 | 内容 | 对应审查问题 | 验收出口 |
|---|---|---|---|
| 1 · 可靠性 | Handbook 契约、练习错误、草稿/结果快照、防重复 | F01–F05 | 页面可用，工作不丢失，错误可恢复；不能靠样式隐藏故障 |
| 2 · 基础系统 | tokens、Typography、Surface、Button/Field/Status、Nav | F06、F07、F10、F11、F15、F17 | 色值与尺寸一致，键盘和动态状态可用 |
| 3 · 业务呈现 | WordEntry、GrammarResult、PracticeEvaluation、AskMessage | F08、F12、F13 | 结果结构清楚，保存绑定正确对象，无原始 JSON |
| 4 · 页面组织 | Dashboard 密度、Handbook 分类、Coach 空计划、文案 | F09、F14、F16 | 保留架构，各页服务自己的学习任务 |
| 5 · 全站验收 | 响应式、字体加载、真实辅助技术、性能回归 | 全部 | 达到下列可观察标准 |

每阶段应小步迁移，不能先大规模移动文件再追补行为。参考现有真实截图作为内容和功能基线，而非要求像素保持旧缺陷。

### Design System 完成标准

以下是未来实施的验收清单，**本次只校验文档与指定色对，未宣称 UI 已通过**。

- [ ] 9 个路由、四个导航分组与现有业务入口全部保留；未知路由、返回与页面 title 正确。
- [ ] 所有主/次按钮的默认、hover、active、focus、pending、disabled 使用统一契约；状态切换无尺寸抖动。
- [ ] 全站至少覆盖 loading / empty / error / success；表单另测 dirty、stale、saving、saved、uncertain；手机亦覆盖结果态。
- [ ] Grammar 修改输入后不保存旧诊断到新原文；快速评分/添加不重复提交或跳项；网络错误不清空内容。
- [ ] Practice 生成失败可见、评价失败可恢复、最后一题明确完成；Ask 请求错误不进入回答和保存数据。
- [ ] 键盘可完成导航、方向切换、作答、保存；焦点可见且不被 sticky 内容遮挡；屏幕阅读器可识别标签、选择态和状态变化。
- [ ] 320 / 390 / 760 / 768 / 1024 / 1440px、200% 文字放大和高倍重排无内容丢失；屏幕键盘不遮挡关键输入和操作。
- [ ] 普通文字对比度 ≥4.5:1，必要边界/状态 ≥3:1；按最终样式检查，而非只检查 token 表。
- [ ] 触控目标 ≥44px；长中英文、音标、超长词条、空例句、缺失可选字段不会破坏布局。
- [ ] 无网络字体时仍可读可操作；图片显式尺寸避免跳动；reduced-motion 下仍可理解状态；最终生产性能单独测量。
- [ ] 无新增页面专属基础色和散落样式覆写；提取组件只承担其清晰职责，不把学习业务塞入万能组件。

本文颜色与布局选择是基于已确认产品方向制定的规范；新增组件和状态在实现前仍需按实际接口契约核对。文档保存在用户指定的 docs 目录；该目录当前被 Git 忽略，本次不修改忽略规则或自动提交。
