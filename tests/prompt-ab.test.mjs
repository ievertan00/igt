// Offline tests for the prompt A/B harness. Every LLM call is mocked; no
// network, no real database, no writes outside a temp directory.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { signTestPValue, caseWinner, aggregatePair } from "../scripts/prompt-ab/lib/aggregate.mjs";
import { parseJudgeResponse, judgePair, buildJudgePrompt } from "../scripts/prompt-ab/lib/judge.mjs";
import { checkGrammar } from "../scripts/prompt-ab/checks/grammar.mjs";
import { checkAsk } from "../scripts/prompt-ab/checks/ask.mjs";
import { checkCoach } from "../scripts/prompt-ab/checks/coach.mjs";
import { loadVariant, listVariants } from "../scripts/prompt-ab/lib/variants.mjs";
import { runAB, reportOnly } from "../scripts/prompt-ab/run.mjs";

const fakeConfig = {
  LLMProvider: "custom",
  Prompts: { SystemPrompt: "BASE SYSTEM", AskPrompt: "ASK TEMPLATE {{history}}" },
};

test("sign test p-values match exact binomial tails", () => {
  assert.equal(signTestPValue(0, 0), 1);
  assert.ok(Math.abs(signTestPValue(5, 0) - 0.0625) < 1e-9);
  assert.ok(Math.abs(signTestPValue(3, 1) - 0.625) < 1e-9);
  assert.ok(signTestPValue(10, 0) < 0.01);
});

test("caseWinner uses majority across repeats", () => {
  assert.equal(caseWinner([{ winner: "a" }, { winner: "a" }, { winner: "b" }]), "a");
  assert.equal(caseWinner([{ winner: "a" }, { winner: "b" }]), "tie");
  assert.equal(caseWinner([{ winner: "tie" }]), "tie");
});

test("aggregatePair recommends promotion only with consistent wins", () => {
  const caseResults = {};
  for (let i = 0; i < 6; i++) {
    caseResults[`c${i}`] = [{ judgment: { winner: "b", consistent: true }, a: { ok: true, checks: [] }, b: { ok: true, checks: [] } }];
  }
  const summary = aggregatePair({ caseResults });
  assert.equal(summary.wins, 6);
  assert.match(summary.recommendation, /promote/);
  const flipped = aggregatePair({ caseResults, humanVerdicts: Object.fromEntries(Object.keys(caseResults).map(id => [id, { winner: "a" }])) });
  assert.equal(flipped.losses, 6);
  assert.match(flipped.recommendation, /keep baseline/);
});

const grammarOutput = overrides => ({
  correction: "My brother works in a bank and he enjoys his job.",
  refine: "My brother works at a bank and enjoys his job.",
  evaluate: "Two agreement errors were fixed.",
  diagnoses: [{ error_type: "Grammar > Subject-Verb Agreement", severity: "Moderate", explanation: "Third-person singular needs -s." }],
  remember: "Check the subject of each clause.",
  ...overrides,
});

test("grammar checks catch contract violations", () => {
  const input = "My brother work in a bank and he enjoy his job.";
  const good = checkGrammar({ input, output: grammarOutput(), expectations: { mustFix: ["work in", "enjoy his"] } });
  assert.ok(good.filter(check => check.level === "hard").every(check => check.pass));

  const echo = checkGrammar({ input, output: grammarOutput({ correction: input }), expectations: {} });
  assert.ok(echo.find(check => check.id === "correction_not_echo" && !check.pass));

  const emptyRefine = checkGrammar({ input, output: grammarOutput({ refine: "" }), expectations: {} });
  assert.ok(emptyRefine.find(check => check.id === "refine_nonempty" && !check.pass));

  const unfixed = checkGrammar({ input, output: grammarOutput({ correction: "My brother works in a bank and he enjoy his job." }), expectations: { mustFix: ["enjoy his"] } });
  assert.ok(unfixed.find(check => check.id === "expected_errors_fixed" && !check.pass));

  const clean = checkGrammar({ input: "The meeting has been moved to Friday.", output: grammarOutput({ correction: "", diagnoses: [] }), expectations: { clean: true } });
  assert.ok(clean.filter(check => check.level === "hard").every(check => check.pass));
});

const askOutput = overrides => ({
  question: "q",
  title: "现在完成时与过去时辨析",
  answer: "现在完成时强调过去动作对现在的影响，一般过去时只说明事情发生在过去。Have/has 加过去分词是它的结构。",
  related: ["什么时候用过去完成时？"],
  tags: ["Tenses"],
  category: "Grammar",
  ...overrides,
});

test("ask checks enforce metadata and formatting contract", () => {
  const good = checkAsk({ language: "zh-CN", output: askOutput(), expectations: {} });
  assert.ok(good.filter(check => check.level === "hard").every(check => check.pass));
  const englishTitle = checkAsk({ language: "zh-CN", output: askOutput({ title: "Present perfect guide" }), expectations: {} });
  assert.ok(englishTitle.find(check => check.id === "title_chinese" && !check.pass));
  const badTag = checkAsk({ language: "zh-CN", output: askOutput({ tags: ["present-perfect"] }), expectations: {} });
  assert.ok(badTag.find(check => check.id === "tags_allowed" && !check.pass));
  const table = checkAsk({ language: "zh-CN", output: askOutput({ answer: "| A | B |\n|---|---|\n| 1 | 2 |" }), expectations: {} });
  assert.ok(table.find(check => check.id === "no_markdown_tables" && !check.pass));
});

const coachMarkdown = marker => `## 1. 综合能力概览
学习者在动词补语结构上存在重复问题，但整体表达清楚。[S1]

## 2. 评估范围与证据局限
本次评估仅覆盖书面语法与词汇维度，练习答案属于给定提示下的作答，不能等同于自由写作。

## 3. 英语能力评估
语法维度：动词不定式补语使用不稳定。[S2] 词汇维度：基础词汇运用正常。

## 4. 语言知识与薄弱环节诊断
### 4.1. 错误分类与严重度
动词模式错误属于 Grammar 类别，严重度中等。[S1]
### 4.2. 具体错误与规则对照
want + 宾语 + to do 结构需要动词原形。[S1]
### 4.3. 重复错误模式
allow 与 let 的补语差异在多个独立输入中反复出现。[S2]
### 4.4. 深层原因分析
可能是补语模式未与动词整体存储，属于假设。[S3]
### 4.5. 语言知识地图
动词补语与介词搭配存在依赖关系。
### 4.6. 具体规则掌握程度
allow somebody to do 处于 Developing 阶段。[S2]
### 4.7. 重复错误与独立应用
练习中的正确作答使用了提示，不能证明独立掌握。[S5]
### 4.8. 知识关联与依赖关系
建议将 allow、let、want 的补语模式对比学习。${marker}

## 5. 个性化学习建议
你已经能清楚表达日常安排，接下来可以把动词补语模式放在真实句子里反复体会，保持目前的表达优势。`;

test("coach checks enforce boundaries beyond the production validator", () => {
  const evidence = Array.from({ length: 6 }, (_, index) => ({ entryId: `e${index}` }));
  const good = checkCoach({ markdown: coachMarkdown(""), language: "zh-CN", evidence, expectations: {} });
  assert.ok(good.filter(check => check.level === "hard").every(check => check.pass));
  const plan = checkCoach({ markdown: coachMarkdown("").replace("保持目前的表达优势。", "以下是你的学习计划：每天完成十个句子。"), language: "zh-CN", evidence, expectations: {} });
  assert.ok(plan.find(check => check.id === "no_study_plan" && !check.pass));
  const invented = checkCoach({ markdown: coachMarkdown("").replace("[S1]", "[S99]"), language: "zh-CN", evidence, expectations: {} });
  assert.ok(invented.find(check => check.id === "citations_valid" && !check.pass));
});

test("judge response parsing accepts fenced JSON and rejects bad winners", () => {
  const value = { dimensions: [{ name: "x", winner: "1", reason: "r" }], overall: "2", confidence: "high" };
  assert.deepEqual(parseJudgeResponse("```json\n" + JSON.stringify(value) + "\n```"), value);
  assert.throws(() => parseJudgeResponse(JSON.stringify({ ...value, overall: "3" })));
});

test("judgePair cancels position bias via swap", async () => {
  const slotBiased = { generateWithFallback: async () => JSON.stringify({ dimensions: [], overall: "1", confidence: "low" }) };
  const biased = await judgePair({ manager: slotBiased, target: "grammar", instruction: "i", input: "x", a: "A", b: "B" });
  assert.equal(biased.winner, "tie");
  assert.equal(biased.consistent, false);

  const contentBased = {
    generateWithFallback: async (_input, systemPrompt) => {
      const first = systemPrompt.split("<<<RESPONSE_1")[1].split("RESPONSE_1")[0];
      const winner = first.includes("GOOD") ? "1" : "2";
      return JSON.stringify({ dimensions: [{ name: "correction_accuracy", winner, reason: "r" }], overall: winner, confidence: "high" });
    },
  };
  const fair = await judgePair({ manager: contentBased, target: "grammar", instruction: "i", input: "x", a: "GOOD output", b: "bad output" });
  assert.equal(fair.winner, "a");
  assert.equal(fair.consistent, true);
});

test("variant loading resolves baseline from config and candidate from disk", () => {
  const baseline = loadVariant("grammar", "baseline", fakeConfig);
  assert.equal(baseline.parts.system, "BASE SYSTEM");
  assert.ok(baseline.hashes.system);
  const candidate = loadVariant("grammar", "candidate", fakeConfig);
  assert.ok(candidate.parts.system.length > 100);
  assert.notEqual(candidate.hashes.system, baseline.hashes.system);
  assert.ok(listVariants("ask").includes("candidate"));
  assert.throws(() => loadVariant("grammar", "does-not-exist", fakeConfig));
});

// ---- end-to-end with mocked providers -------------------------------------

function mockGenerationManager() {
  return {
    getCurrentProviderName: () => "custom",
    getCurrentProvider: () => ({ getModelName: () => "mock-model" }),
    generateWithFallback: async (input, systemPrompt, options = {}) => {
      if (options.taskType === "grammar") {
        const isBaseline = systemPrompt.startsWith("BASE SYSTEM");
        return JSON.stringify({
          correction: isBaseline
            ? "My brother works in a bank and he enjoy his job."
            : "My brother works in a bank and he enjoys his job.",
          refine: isBaseline
            ? "My brother works at a bank and likes his job."
            : "My brother works at a bank and enjoys his job.",
          evaluate: "Agreement check.",
          diagnoses: [{ error_type: "Subject-Verb Agreement", severity: "Moderate", explanation: "Third-person singular -s." }],
          remember: "Check each clause subject.",
        });
      }
      if (options.taskType === "ask") {
        const isBaseline = systemPrompt.startsWith("ASK TEMPLATE");
        const zh = /[\u4e00-\u9fff]/.test(input) || systemPrompt.includes("Simplified Chinese. Keep English");
        return JSON.stringify({
          question: input,
          title: "现在完成时与过去时辨析",
          answer: zh
            ? `关于这个问题：现在完成时（have/has 加过去分词）强调对现在的影响，一般过去时只陈述过去。${isBaseline ? "" : "BETTER 补充了对比例句。"}`
            : `A clear explanation of: ${input}. With examples and common mistakes.${isBaseline ? "" : " BETTER"}`,
          related: ["Related follow-up question?"],
          tags: ["Tenses"],
          category: "Grammar",
        });
      }
      if (options.taskType === "handbook") {
        // Both coach variants start as identical copies of production (A/A),
        // so the mock returns the same report for either prompt.
        return coachMarkdown("");
      }
      throw new Error(`unexpected taskType ${options.taskType}`);
    },
  };
}

function mockJudgeManager(markerByTarget) {
  return {
    generateWithFallback: async (_input, systemPrompt) => {
      const target = systemPrompt.includes("correction_accuracy") ? "grammar" : systemPrompt.includes("answer_quality") ? "ask" : "coach";
      const marker = markerByTarget[target];
      const first = systemPrompt.split("<<<RESPONSE_1")[1].split("RESPONSE_1")[0];
      const second = systemPrompt.split("<<<RESPONSE_2")[1].split("RESPONSE_2")[0];
      const winner = first.includes(marker) ? "1" : second.includes(marker) ? "2" : "tie";
      return JSON.stringify({
        dimensions: [{ name: "dim", winner, reason: "marker" }],
        overall: winner,
        confidence: "high",
      });
    },
  };
}

test("runAB end-to-end with mocks: outputs, checks, judging, report, human override", async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "prompt-ab-test-"));
  try {
    const { run, runDir } = await runAB({
      targets: ["grammar", "ask", "coach"],
      caseFilter: null,
      repeat: 1,
      judge: true,
      outDir,
      config: fakeConfig,
      generationManager: mockGenerationManager(),
      judgeManager: mockJudgeManager({ grammar: "enjoys", ask: "BETTER", coach: "QUALITY_MARKER" }),
    });
    assert.equal(runDir, outDir);
    assert.ok(fs.existsSync(path.join(runDir, "report.md")));
    assert.ok(fs.existsSync(path.join(runDir, "run.json")));
    assert.ok(fs.existsSync(path.join(runDir, "manifest.json")));

    const grammarPair = run.targets.grammar.pairs[0];
    const agreement = grammarPair.summary.cases.find(item => item.caseId === "g-agreement");
    assert.equal(agreement.winner, "b");
    const baselineResult = run.targets.grammar.outputs["g-agreement"].baseline[0];
    const candidateResult = run.targets.grammar.outputs["g-agreement"].candidate[0];
    assert.ok(baselineResult.checks.find(check => check.id === "expected_errors_fixed" && !check.pass));
    assert.ok(candidateResult.checks.filter(check => check.level === "hard").every(check => check.pass));

    const askPair = run.targets.ask.pairs[0];
    assert.ok(askPair.summary.wins >= 6);
    const coachPair = run.targets.coach.pairs[0];
    // A/A sanity: identical coach prompts must not produce a fake winner.
    assert.equal(coachPair.summary.cases[0].winner, "tie");
    assert.ok(run.targets.coach.outputs.synthetic.candidate[0].ok);
    assert.ok(run.targets.coach.outputs.synthetic.baseline[0].ok);

    // Human override flips the grammar agreement case and the report rebuilds.
    fs.writeFileSync(path.join(runDir, "human-verdicts.json"), JSON.stringify({ grammar: { baseline__candidate: { "g-agreement": { winner: "a", note: "test override" } } } }));
    const { run: rebuilt } = await reportOnly(runDir);
    const flipped = rebuilt.targets.grammar.pairs[0].summary.cases.find(item => item.caseId === "g-agreement");
    assert.equal(flipped.winner, "a");
    assert.equal(flipped.source, "human");
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test("buildJudgePrompt hides variant identity and includes both responses", () => {
  const prompt = buildJudgePrompt({ target: "grammar", instruction: "inst", input: "inp", output1: "AAA", output2: "BBB" });
  assert.ok(prompt.includes("AAA") && prompt.includes("BBB"));
  assert.ok(!prompt.includes("baseline") && !prompt.includes("candidate"));
});