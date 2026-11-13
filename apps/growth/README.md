# ClearWrite Growth

独立的 Sites 静态工作台，沿用 ClearWrite 设计规范和现有数据结构。

## 主 Web 整合入口

主 Web 的 **My learning** 现在是直接入口，内部通过 Overview、Saved words、Saved notes、Handbook、Learning reports 五个 Tabs 切换，保留原有 hash 路由。

整合后的 Overview 直接通过 Local Runtime 的只读 `/dashboard/growth`、`/dashboard/records` 和 `/dashboard/record` 接口读取当前配置的数据，无需导入快照。四张资料卡片为完整库存；四张表现卡片注明所选时段或当前保留状态。趋势支持指标切换、数据表、时段对比和证据下钻。

主 Web 使用 `npm run web:dev` 或构建后 `npm run web:start` 启动。下文的独立 HTML 与快照导入方式仍作为独立入口保留。

整合验证：主 Web 类型检查与生产构建、数据与路由测试均已通过。浏览器渲染和交互验收因当前环境拒绝本地端口连接而未完成；`npm run test:my-learning-web` 已更新为覆盖新版导航、八张卡片、证据下钻、失败恢复和响应式布局的合成数据检查。

也可直接用浏览器打开 `clearwrite-growth.html`，点击“导入记录”选择导出的 JSON，无需启动本地服务。此离线文件与 Sites 使用同一实现，默认不含学习数据。修改源码后运行 `node scripts/build-growth.mjs` 重新生成。

## 本地运行

在 IGT 根目录运行：

```powershell
node scripts/growth-dashboard.mjs
```

打开终端显示的本地 URL。只读访问实际配置的 SQLite、Vocabulary Markdown、纠错日志、Practice Markdown、Ask notes 和 Coach reports；不运行迁移、不调用 LLM、不改变排期。每次刷新重新读取；本地服务仅绑定 127.0.0.1。可在 `.env` 设置 `IGT_GROWTH_PORT`；默认由系统分配端口。

## Sites 中使用

托管页面本身不含学习记录。先在 IGT 根目录导出：

```powershell
node scripts/export-growth.mjs
```

在工作台点击“导入记录”，选择 `.tmp/clearwrite-growth.json`。数据只在浏览器解析，默认仅保留在本次页面会话；选择“在此浏览器保留快照”后写入 IndexedDB。重新导出并导入以更新记录。可清除浏览器快照，不影响原始文件与数据库。

`dist/` 是可直接部署的静态资源；`.openai/hosting.json` 保留当前 Sites 身份。不得把学习快照、数据库、`.env`、vault 内容加入该目录或远程源码。

## 统计定义

- 语法纠错只使用明确 `source=grammar`、受支持格式的记录。文本分析与来源未知记录单独保留。
- 重复 entry ID、明确标记的重复纠错不重复计数；各类型按涉及记录去重，并展示不同输入数。
- 5 个大类和 28 个具体类型来自 `lib/domain/error-types.mjs`。精确匹配现有名称（可移除既有分类前缀），未知标签不猜测具体类型，原始详情保留。
- 翻译练习目标来自实际题库字段和现有 `matchesHandbookTarget` 规则。目标表示练习机会，不作为已发生错误或规则掌握。
- 回忆正确率只使用明确布尔 `feedback.correct`；无提示正确率还要求 `audioPlayed=false`。缺失记录不补为错误或正确。
- 翻译分数仅统计 `practice-sentence` 的整体评分，提示使用与可能重试不能据此排除。不同练习模块不混合计分。
- 词汇保留状态直接复用 `listSavedVocabulary`。时间筛选选择词条加入日期范围，状态始终是当前快照；不伪造历史状态或“掌握度百分比”。
- Practice Markdown 与 SQLite 分开浏览；Markdown 不加入数据库练习分数统计，避免重计。
- 笔记按文件名显示；有保存日期时使用该日期，不把修改日期伪装成学习日期。
- 所有趋势与对比显示分母，缺失观测留空。错误统计为保存的模型诊断线索，未经独立核验。
- 报告包括筛选条件、快照时间、主要观察、原始纠错和统计记录索引。支持 Markdown 下载和打印为 PDF，不生成具体计划或缺少证据的能力等级。

## 验证

```powershell
node --test apps/growth/model.test.mjs
node --check apps/growth/dist/app.mjs
npm run verify:practice-bank
```

本次环境中本地网络连接被限制，浏览器预览未完成；不得将静态检查描述为视觉验收。Sites 项目已创建，源码推送因系统网络错误受阻，尚未发布。
