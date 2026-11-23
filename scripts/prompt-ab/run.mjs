#!/usr/bin/env node
// Prompt A/B runner for the Grammar / Ask / Coach loops.
// Reuses the production call paths with injected prompt variants, runs
// deterministic contract checks, then blind pairwise LLM judging with position
// swap. Results, judgments and a Markdown report land in prompt-ab-runs/<id>/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import configLoader from "../../lib/shared/config-loader.mjs";
import { TARGETS, RUNS_DIR, loadVariant, listVariants } from "./lib/variants.mjs";
import { createGenerationManager, createJudgeManager, describeGenerationModels } from "./lib/llm.mjs";
import { judgePair } from "./lib/judge.mjs";
import { aggregatePair } from "./lib/aggregate.mjs";
import { buildReport } from "./lib/report.mjs";

const adapters = {};
async function adapterFor(target) {
  if (!adapters[target]) adapters[target] = await import(`./targets/${target}.mjs`);
  return adapters[target];
}

async function pool(tasks, concurrency, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < tasks.length) {
      const current = index++;
      await worker(tasks[current], current);
    }
  });
  await Promise.all(runners);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

export async function runAB({
  targets = TARGETS,
  variantNames = {},
  caseFilter = null,
  repeat = 2,
  concurrency = 1,
  judge = true,
  judgeProvider,
  judgeModel,
  outDir,
  config = configLoader.load(),
  generationManager,
  judgeManager,
  log = () => {},
} = {}) {
  const startedAt = new Date().toISOString();
  const id = startedAt.replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const runDir = outDir || path.join(RUNS_DIR, id);
  fs.mkdirSync(runDir, { recursive: true });

  const manager = generationManager || createGenerationManager(config);
  const models = describeGenerationModels(manager, config);
  let judgeInfo = null;
  let judgeMgr = null;
  if (judge) {
    const created = judgeManager
      ? { manager: judgeManager, provider: "injected", model: "injected" }
      : createJudgeManager(config, { provider: judgeProvider, model: judgeModel });
    judgeMgr = created.manager;
    judgeInfo = { provider: created.provider, model: created.model };
  }

  const run = { id, startedAt, finishedAt: null, repeat, judge: judgeInfo, models, targets: {} };
  const fullCases = {};
  const plan = [];
  for (const target of targets) {
    const adapter = await adapterFor(target);
    const names = (variantNames[target] || ["baseline", "candidate"]).filter(name => listVariants(target).includes(name));
    if (!names.includes("baseline")) names.unshift("baseline");
    const variants = Object.fromEntries(names.map(name => [name, loadVariant(target, name, config)]));
    const cases = adapter.loadCases({ filter: caseFilter });
    if (!cases.length) {
      log(`[${target}] no cases found — skipped (coach needs a snapshot: npm run ab:snapshot)`);
      continue;
    }
    if (names.length < 2) log(`[${target}] only baseline available — outputs will be generated but no pairs judged`);
    run.targets[target] = {
      variants: Object.fromEntries(names.map(name => [name, { description: variants[name].description, hashes: variants[name].hashes }])),
      cases: cases.map(item => ({ id: item.id, label: item.label || item.id })),
      outputs: {},
      judgments: {},
    };
    fullCases[target] = new Map(cases.map(item => [item.id, item]));
    for (const testCase of cases) {
      run.targets[target].outputs[testCase.id] = {};
      for (const name of names) {
        run.targets[target].outputs[testCase.id][name] = [];
        for (let r = 0; r < repeat; r++) {
          plan.push({ target, adapter, testCase, variant: variants[name], variantName: name, r });
        }
      }
    }
  }
  if (!Object.keys(run.targets).length) throw new Error("No evaluable targets/cases. Check --targets and fixtures.");

  writeJson(path.join(runDir, "manifest.json"), { id, startedAt, repeat, judge: judgeInfo, models, targets: Object.fromEntries(Object.entries(run.targets).map(([target, value]) => [target, { variants: value.variants, cases: value.cases }])) });
  log(`Run ${id} → ${runDir}`);
  log(`Generating ${plan.length} outputs (concurrency ${concurrency})…`);

  await pool(plan, concurrency, async task => {
    const { target, adapter, testCase, variant, variantName, r } = task;
    const result = await adapter.run({ variant, case: testCase, manager, config });
    run.targets[target].outputs[testCase.id][variantName][r] = result;
    writeJson(path.join(runDir, "outputs", target, variantName, testCase.id, `r${r + 1}.json`), result);
    const hard = result.checks.filter(check => check.level === "hard" && !check.pass).length;
    log(`  [${target}] ${testCase.id} / ${variantName} r${r + 1}: ${result.ok ? `ok, ${hard} hard failures` : `FAILED (${result.error})`} (${result.ms} ms)`);
  });

  if (judgeMgr) {
    const judgeTasks = [];
    for (const [target, targetRun] of Object.entries(run.targets)) {
      const adapter = await adapterFor(target);
      const names = Object.keys(targetRun.variants);
      for (const candidate of names.filter(name => name !== "baseline")) {
        const pairKey = `baseline__${candidate}`;
        targetRun.judgments[pairKey] = {};
        for (const testCase of targetRun.cases) {
          targetRun.judgments[pairKey][testCase.id] = [];
          for (let r = 0; r < repeat; r++) judgeTasks.push({ target, adapter, pairKey, caseId: testCase.id, testCase: fullCases[target].get(testCase.id), candidate, r });
        }
      }
    }
    log(`Judging ${judgeTasks.length} pairs (2 orders each)…`);
    await pool(judgeTasks, concurrency, async task => {
      const { target, adapter, pairKey, caseId, testCase, candidate, r } = task;
      const a = run.targets[target].outputs[caseId].baseline[r];
      const b = run.targets[target].outputs[caseId][candidate][r];
      let judgment;
      if (!a.ok && !b.ok) judgment = { winner: "tie", consistent: true, contract: "both failed", judgments: [] };
      else if (!a.ok) judgment = { winner: "b", consistent: true, contract: "baseline failed", judgments: [] };
      else if (!b.ok) judgment = { winner: "a", consistent: true, contract: "candidate failed", judgments: [] };
      else {
        const context = adapter.judgeInput(testCase);
        try {
          judgment = await judgePair({ manager: judgeMgr, target, ...context, a: adapter.judgeOutput(a), b: adapter.judgeOutput(b) });
        } catch (error) {
          try {
            judgment = await judgePair({ manager: judgeMgr, target, ...context, a: adapter.judgeOutput(a), b: adapter.judgeOutput(b) });
          } catch {
            judgment = null;
            log(`  [${target}] judge failed for ${caseId} r${r + 1}: ${error.message}`);
          }
        }
      }
      run.targets[target].judgments[pairKey][caseId][r] = judgment;
      writeJson(path.join(runDir, "judgments", target, pairKey, caseId, `r${r + 1}.json`), judgment);
      if (judgment) log(`  [${target}] ${caseId} r${r + 1}: ${judgment.winner}${judgment.consistent ? "" : " (position-inconsistent → tie)"}`);
    });
  }

  run.finishedAt = new Date().toISOString();
  writeJson(path.join(runDir, "run.json"), run);
  const { report } = await assembleAndReport({ run, runDir, log });
  log(`\nReport: ${path.join(runDir, "report.md")}`);
  return { run, runDir, report };
}

export async function assembleAndReport({ run, runDir, log = () => {} }) {
  const humanFile = path.join(runDir, "human-verdicts.json");
  const human = fs.existsSync(humanFile) ? JSON.parse(fs.readFileSync(humanFile, "utf8")) : {};
  for (const [target, targetRun] of Object.entries(run.targets)) {
    const adapter = await adapterFor(target);
    targetRun.renderOutput = adapter.judgeOutput;
    targetRun.pairs = [];
    for (const [pairKey, judgmentsByCase] of Object.entries(targetRun.judgments || {})) {
      const [a, b] = pairKey.split("__");
      const caseResults = {};
      const allJudgments = [];
      for (const [caseId, judgments] of Object.entries(judgmentsByCase)) {
        caseResults[caseId] = judgments.map((judgment, r) => {
          if (judgment) allJudgments.push(judgment);
          return { repeat: r + 1, judgment, a: targetRun.outputs[caseId]?.[a]?.[r], b: targetRun.outputs[caseId]?.[b]?.[r] };
        });
      }
      const summary = aggregatePair({ caseResults, humanVerdicts: human[target]?.[pairKey] || {} });
      targetRun.pairs.push({ a, b, caseResults, allJudgments, summary });
      log(`[${target}] ${a} vs ${b}: candidate W-L-T ${summary.wins}-${summary.losses}-${summary.ties} (p=${summary.pValue.toFixed(3)}) → ${summary.recommendation}`);
    }
  }
  const report = buildReport(run);
  fs.writeFileSync(path.join(runDir, "report.md"), report);
  writeJson(path.join(runDir, "summary.json"), Object.fromEntries(Object.entries(run.targets).map(([target, targetRun]) => [target, targetRun.pairs.map(pair => ({ a: pair.a, b: pair.b, ...pair.summary }))])));
  const template = {};
  for (const [target, targetRun] of Object.entries(run.targets)) {
    template[target] = {};
    for (const pairKey of Object.keys(targetRun.judgments || {})) {
      template[target][pairKey] = Object.fromEntries(Object.keys(targetRun.judgments[pairKey]).map(caseId => [caseId, { winner: "tie", note: "" }]));
    }
  }
  const templateFile = path.join(runDir, "human-verdicts.template.json");
  if (!fs.existsSync(templateFile)) writeJson(templateFile, template);
  return { run, report };
}

export async function reportOnly(runDir) {
  const run = JSON.parse(fs.readFileSync(path.join(runDir, "run.json"), "utf8"));
  return assembleAndReport({ run, runDir, log: console.log });
}

function parseArgs(argv) {
  const options = { targets: TARGETS, variantNames: {}, repeat: 2, concurrency: 1, judge: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === "--targets") options.targets = next().split(",").map(value => value.trim());
    else if (arg === "--variants") {
      const spec = next();
      if (spec.includes("=")) {
        for (const part of spec.split(";")) {
          const [target, names] = part.split("=");
          options.variantNames[target.trim()] = names.split(",").map(value => value.trim());
        }
      } else options.defaultVariants = spec.split(",").map(value => value.trim());
    } else if (arg === "--cases") options.caseFilter = next().split(",").map(value => value.trim());
    else if (arg === "--repeat") options.repeat = Math.max(1, Number(next()) || 2);
    else if (arg === "--concurrency") options.concurrency = Math.max(1, Number(next()) || 1);
    else if (arg === "--no-judge") options.judge = false;
    else if (arg === "--judge-provider") options.judgeProvider = next();
    else if (arg === "--judge-model") options.judgeModel = next();
    else if (arg === "--out") options.outDir = next();
    else if (arg === "--report-only") options.reportOnly = next();
    else if (arg === "--list") options.list = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.defaultVariants) {
    for (const target of options.targets) options.variantNames[target] = options.defaultVariants;
  }
  for (const target of options.targets) {
    if (!TARGETS.includes(target)) throw new Error(`Unknown target: ${target}`);
  }
  return options;
}

const HELP = `Prompt A/B testing for Grammar / Ask / Coach.

Usage: node scripts/prompt-ab/run.mjs [options]

  --targets grammar,ask,coach     Targets to evaluate (default: all)
  --variants baseline,candidate   Variants for all targets, or per target:
                                  --variants "grammar=baseline,idea-a;ask=baseline,idea-b"
  --cases id1,id2                 Restrict to specific case ids
  --repeat N                      Generations per variant×case (default 2)
  --concurrency N                 Parallel LLM calls (default 1; keep 1 for local Ollama)
  --no-judge                      Generate outputs + contract checks only
  --judge-provider NAME           Judge provider override (default: generation provider)
  --judge-model NAME              Judge model override (default: configured Pro/handbook tier)
  --out DIR                       Run output directory (default prompt-ab-runs/<timestamp>)
  --report-only DIR               Rebuild report from a finished run (applies human-verdicts.json)
  --list                          List available variants and cases
  --help                          This help

Workflow: npm run ab:snapshot → edit variants/<target>/<name>/*.txt → npm run ab:run`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(HELP); return; }
  if (options.list) {
    for (const target of TARGETS) {
      console.log(`\n${target} variants: ${listVariants(target).join(", ")}`);
      const adapter = await adapterFor(target);
      const cases = adapter.loadCases({});
      console.log(`${target} cases (${cases.length}): ${cases.map(item => item.id).join(", ") || "(none)"}`);
    }
    return;
  }
  if (options.reportOnly) { await reportOnly(options.reportOnly); return; }
  await runAB({ ...options, log: console.log });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message || error); process.exit(1); });
}