# Grammar / Ask / Coach 优化提示词（v1）

**状态：候选版本，仅落袋，未接入生产。** 本目录只新增文件，没有修改 `lib/**`、`igt_config.json`、两套 A/B harness 的任何现有代码或配置，也没有改动 `variants.json` / `candidates.json`。现行生产提示词仍在原位运行。

基线取自当前工作树的实际运行值（指纹见 [meta.json](meta.json)），对照 [RUBRIC.md](../RUBRIC.md) 的严重错误定义、[cases.mjs](../cases.mjs) 的题型分组，以及 `candidates.json` 中 context / teaching 两轮试跑所针对的问题。

## 文件清单

| 文件 | 替换对象 | 说明 |
|---|---|---|
| `grammar/system.txt` | `igt_config.json → Prompts.SystemPrompt` | 完整系统提示词 |
| `grammar/inputScope.txt` | `lib/application/grammar.mjs → INPUT_SCOPE` | 整段检查与输出完整性规则 |
| `ask/ask.txt` | `igt_config.json → Prompts.AskPrompt` | 保留 `{{history}}` 占位符 |
| `coach/system.txt` | `lib/application/coach-report.mjs → SYSTEM` | 诊断报告系统提示词 |
| `strategy.json` | 可选桥接 | 三条单行增量指令，`variants.json` 同形状，供根目录 `generate.mjs` 盲测用；**不是**完整优化版本 |
| `meta.json` | — | 基线/成品 SHA-256、装配方式、契约清单、A/B 命令 |

字节级相同的副本已放入 `scripts/prompt-ab/variants/{grammar,ask,coach}/optimized/`，因此可直接跑完整 A/B，无需改任何 harness 代码。

## 三处主要改动

**Grammar — 消除自相矛盾 + 先读语境再改**
- 现行 system 说「refine 可以返回空字符串」，而 INPUT_SCOPE 说「refine 必须非空，此要求覆盖前面任何指令」；同时 system 说「无改动时 diagnoses 返回空数组」，INPUT_SCOPE 又要求每条 refine 都在 diagnoses 里有 Minor「Optional」解释。两个版本现在统一：refine 恒非空、属可选措辞；无错句 `correction=""`，`diagnoses` 只放一条 Optional Minor；改动与替换都必须有对应 Why。
- 新增「读整段 → 定时间框架/数量/确定性/语域 → 逐项判定 → 复查每处编辑」的流程。明确要求：原句在上下文中有标准语法读法时保留，不能只因另一形式更常见就改（finished-time past、虚拟式、时刻表现在时、不可数名词、合法双重否定、标题/列表短语）；编辑必须能指出客观错误并引用最小改动片段。这直接对应 RUBRIC 中「把学习者原本正确的表达断言为错误」这一严重错误。
- 保留数字、日期、金额、编号、顺序、礼貌程度、时间关系；Why 要求引用本句线索，`remember` 改为可迁移到别句的自检，而不是复述规则。

**Ask — 先解指代，再直接作答**
- 新增「先解析当前问题」：把 `那 / 呢 / 换成… / 如果… / What if… / Does that sound…` 绑定到历史轮次或学习者原句；历史与当前问题冲突时以当前问题为准；两种解读都成立时分别给对应形式，只有上下文无法消解才提一个澄清问题。对应 followup 组用例。
- 首句直接给可用答案；单一事实题给事实 + 一个自然例句即停；对比题只给一组「仅改变决定性特征」的最小对比例句并说明差别，不堆砌无助于选择的例句；区分规则与语域偏好，避免绝对化。
- 修正合同层面的潜在冲突：明确 `title` 恒为简体中文、由后续 metadata 片段（中文标题、固定 tags、category）统一裁决；越界/含糊兜底改用「按回答语言简短说明」，不再硬编码英文句子；输出示例补齐六个必填字段。

**Coach — 把证据边界变成可执行核对流程**
- 新增 `EVIDENCE VERIFICATION` 四步：① 逐字引用学习者原文 + `[S#]`、不得把纠错后的词当错词；② 固定来源属性（练习作答 ≠ 自由写作，参考答案/反馈/AI 纠正/AI 润色均非学习者输出，hints > 0 为受助、null 为未知、0 也不能证明独立，同题重复可能是重试）；③ 全量扫描反例（独立正确使用、合法读法、参考答案之外的有效译文）；④ 把结论收窄到能站住的范围，冲突时并列两条观察并降级为「证据不足」。
- 保留原 SYSTEM 的全部硬约束（五章、4.1–4.8 八节、`[S#]` 引用、不虚构引文/统计/CEFR、第二章不写流水线统计、第五章不成学习计划），并把重复表述合并；新增「八个二级小节各给不同信息」「最高优先级且有证据支持的弱点 → 一处原文引用 + 一处最小修复 + 一个可用于全新写作的独立核验」「证据稀疏时点明一份能解决不确定性的小型新写作样本」。

## 保持不变的契约（必须）

- Grammar：只返回 `correction / refine / evaluate / diagnoses / remember` 原始 JSON；`refine` 非空；无错句 `correction=""`；有错时返回完整段落供逐词 diff；severity 仅 Minor/Moderate/Major；分类法原样保留。
- Ask：保留 `{{history}}`；六个必填字段；简体中文标题与固定 tags/category 由 `ASK_METADATA_PROMPT` 决定；回答语言由 `askLanguagePrompt` 决定；禁 markdown 表格；越界/含糊时 `related=[]`。
- Coach：`## 1.`–`## 5.`、`### 4.1.`–`### 4.8.`、至少一个合法 `[S#]`、只输出 Markdown；语言指令由 `languageInstruction` 前置、`outputRequirements` 后置，优化版不设置报告语言。

装配细节与逐文件哈希见 `meta.json`。注意 A/B 清单里的哈希是「LF 规范化后 trim 的文本」的前 16 位，与文件原始字节哈希不同，两份都已记录。

## 如何验证（不改动现有代码）

**方式一：`scripts/prompt-ab` 完整提示词 A/B（推荐，可直接跑）**

```powershell
npm run ab:list
npm run ab:run -- --variants "grammar=baseline,optimized;ask=baseline,optimized;coach=baseline,optimized" --no-judge
# 需要 LLM 盲评时去掉 --no-judge
```

`baseline` 仍从 config / 源码实时加载，`optimized` 从新增变体目录加载，其余装配片段保持生产原样。正式比较请按 README / RUBRIC 的正式集、确认集流程走，别只跑 pilot。

**方式二：根目录 `generate.mjs` 单行增量盲测**

把 `strategy.json` 中三条字符串覆盖进 `prompt-ab/variants.json`（或作为 `optimized` 键合并进 `candidates.json`），然后：

```powershell
node .\generate.mjs --ollama --candidate optimized --split formal --pilot
node .\generate.mjs --ollama --split formal --pilot
```

这一步需要手动改数据文件，本次没有执行，以免触碰现有配置。它衡量的是「增量指令」的效果，与方式一的「完整重写」不是同一件事，结果不要混算。

## 校验记录（2026-11-22，离线）

- `npm run ab:list`：三个目标均列出 `baseline, candidate, optimized`。
- `node --test tests/prompt-ab.test.mjs`：**11/11 通过**，既有 harness 行为未变。
- 用 mock LLM 走真实生产调用路径（`analyzeGrammar` / `askStateless` / `generateCoachReport`），baseline 与 optimized 各跑 21 个用例：**0 项回归**；两种版本都能被加载、装配、解析并通过各自的契约检查。此项只验证「装配与契约连通」，**不衡量提示词实际效果**——效果必须由真实模型的盲评轮次给出。
- 已知既存 harness 问题（非本次改动引入）：`scripts/prompt-ab/checks/coach.mjs` 的 `citations_present` 在 `[S1]` 被 `generateCoachReport` 重写为 `[entryId]` 之后才执行，因此通过 coach 适配器跑出的报告在**两种版本上同样**报这一项 hard failure。现有单元测试直接把替换前的 markdown 传给检查器，所以不会暴露。按「不改代码」的要求未修复，正式看报告时请以 `call_succeeded` 与人工核引文为准。

## 后续

本目录只是候选。若确认轮胜出，再另行决定是否把文本写回 `igt_config.json` 的 `Prompts.SystemPrompt` / `Prompts.AskPrompt`，以及 `lib/application/grammar.mjs` 的 `INPUT_SCOPE` 与 `lib/application/coach-report.mjs` 的 `SYSTEM`；那一步会改动生产文件，本次未做。

`lib/features/learning-diagnosis/coach-prompt.mjs` 的 `COACH_PROMPT` 是另一条 JSON-schema 诊断链路，两套 A/B harness 都不走它，故未纳入本次优化；`AskCompactPrompt` 等其他模板同样未改。
