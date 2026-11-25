# Grammar、Ask、Coach 提示词配对盲测

本目录包含两个运行入口。generate.mjs 生成同题双答案，score.mjs 在人工评审后揭盲。所有运行产物保存在仓库根目录的 prompt-ab-runs 下（blind- 前缀），每次生成使用新的目录。本实验随 IGT 仓库运行，使用项目已安装的 Node.js 依赖。

## 快速开始

在 PowerShell 中运行：

```powershell
Set-Location 'C:\Users\Evertan\.igt\scripts\prompt-ab\blind'
node .\generate.mjs
```

默认离线生成 9 对校准样例。终端首行给出本轮目录。打开其中的 review.json 可以查看题目、评审要点和两份答案。模拟文本用于验证流程，不参与提示词效果判断。

首次配置真实模型时复制模板，填写本目录的 .env：

```powershell
Copy-Item -LiteralPath '.env.example' -Destination '.env'
```

AB_BASE_URL 填 OpenAI 兼容服务的 API 根地址（通常以 /v1 结尾），AB_MODEL 填固定模型版本，AB_API_KEY 按服务要求填写。Grammar 和 Ask 需要端点支持 response_format.json_schema；Coach 接收 Markdown，使用项目配置中的报告输出预算。三个任务都使用 temperature=0。模型若不支持这些参数，生成将记为失败。本实验固定单一端点和模型；要测试另一款模型，单独开一轮。两个可选价格均按同一币种每百万 token 填写。

```powershell
node .\generate.mjs --live --split calibration
node .\generate.mjs --live --split formal
```

可加 `--task grammar`、`--task ask` 或 `--task coach` 只跑一项。全部正式集共 164 次初始请求，Coach 的格式或证据验证可能触发第二次请求。生成过程中按题输出 OK 或 CHECK，详细错误见对应 private 文件。一轮中断后，已完成配对保存在 private；重新运行会另建一轮。完整轮次才生成盲评包。

## 提示词与输入

本地 Ollama 可直接使用项目的模型配置和端点。下列两条命令分别将现行版本与 candidates.json 中的 context、teaching 对比。两轮各独立生成基线。正式题库的分层试跑取每种题型的第一题，共 11 对；去掉 `--pilot` 可运行全部 82 对。两轮使用相同的样本；正式确认请换新题。实验固定使用项目配置的 Ollama handbook 模型，关闭思考模式，温度为零。

```powershell
node .\generate.mjs --ollama --candidate context --split formal --pilot
node .\generate.mjs --ollama --candidate teaching --split formal --pilot
```

- A 取运行时应用层的完整提示词。Grammar 使用配置的系统模板和当前工作树的整段检查规则；Ask 使用无状态入口，冻结历史和回答语言；Coach 使用当前报告生成器、注入样例记录，并强制刷新缓存。评审要点只写入评审包。
- B 在同一系统提示词末尾追加 variants.json 中该任务的一条指令；这里可以替换下轮要测的教学策略。每对的生成顺序和评审左右位置独立随机。
- cases.mjs 包含 40 段 Grammar、30 个 Ask 回合、12 个 Coach 证据包，以及每项各 3 个校准样例。均为人工构造数据。切换到个人历史样本时，应保留完整对话或证据包作为一个样本，按组分配校准集、正式集和确认集。
- 每轮 private/settings.json 保存版本差异、实验模式和模型设置；每题 private 文件保存 A/B 映射、实际请求（包含历史和 Coach 证据）、基线和最终提示词的 SHA-256、返回模型名、原始响应、用量及耗时。请求头中的密钥不会写入文件。只把 review.json 和 ballot.json 交给评审者。模拟和真实运行在结果中都有明确标识。

## 评审与汇总

按 [评审手册](RUBRIC.md) 逐题填写 ballot.json。两位评审各用一份副本，分歧在揭盲前裁决。以下示例选取最近一轮真实运行；如同时进行多轮，请将 $runDir 设为生成脚本打印的绝对路径。

```powershell
$runDir = (Get-ChildItem -LiteralPath '..\..\..\prompt-ab-runs' -Directory -Filter 'blind-live-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
node .\score.mjs $runDir
```

可以用第二个位置参数传入裁决后的评分文件。汇总输出 JSON，可用 Out-File 保存。缺题、重复、漏评或未填写理由时脚本会报错。每项单列胜负平、严重错误、首次与最终成功率、耗时、用量和每份可用答案成本；端点未报告完整用量或未填价格时相应指标为 null。模型一致性按服务返回的模型名核对；同名别名背后的版本仍取决于服务端。

正式轮净胜率达到 20%、没有 B 新增严重错误且没有异模型配对时，可进入确认轮。确认轮须使用另外准备的全新题目，并锁定本轮 B。报告提供非平局样本上 B 胜率的双侧 95% 精确二项区间；所有样本均平局时无区间。一次 Coach 报告只计一票。最终采用哪个版本还应结合样本代表性、失败原因、耗时与成本。
