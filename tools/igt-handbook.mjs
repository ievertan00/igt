import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initializeLLMProviders, { configLoader } from "../lib/server/llm/init.mjs";
import { getErrorFrequency, getTrendData, getTotalStats, getLearningProfileData, getExamples } from "../lib/features/handbook/queries.mjs";
import { generateTailoredRule, generateOverallSummary } from "../lib/features/handbook/generator.mjs";
import { clearCache, cacheStats } from "../lib/features/handbook/cache.mjs";
import { buildReport } from "../lib/features/handbook/report.mjs";
import { resolveModel } from "../lib/server/llm/model-resolver.mjs";
import { buildLearningDiagnosis } from "../lib/features/learning-diagnosis/index.mjs";
import { beijingDate } from "../lib/shared/timezone.mjs";
import { saveHandbookReport } from "../lib/application/handbook-reports.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: /handbook [--days=0..3650] [--incremental] [--format=markdown|html]\nMarkdown and a structured snapshot are always saved. HTML adds an offline reading and print version.\nOther options: --cache-stats, --clear-cache. Historical reports are available in Web Handbook → Past reports.");
  process.exit(0);
}
const format = args.find((value) => value.startsWith("--format="))?.slice(9) || "markdown";
if (!["markdown", "html"].includes(format)) { console.error("Choose --format=markdown or --format=html."); process.exit(1); }
const days = (() => {
  const a = args.find((s) => s.startsWith("--days="));
  return a ? Number(a.split("=")[1]) : 30;
})();
if (!Number.isInteger(days) || days < 0 || days > 3650) { console.error("Days must be an integer between 0 and 3650."); process.exit(1); }
const incremental = args.includes("--incremental") || args.includes("-i");

if (args.includes("--clear-cache") || args.includes("-c")) {
  console.log("🗑️  Clearing LLM rule cache...");
  console.log(`✅ Cleared ${clearCache()} cached rules`);
  process.exit(0);
}
if (args.includes("--cache-stats")) {
  console.log("📊 Cache Statistics:");
  const { files, totalSize } = cacheStats();
  console.log(`  Cached rules: ${files.length}`);
  for (const f of files) console.log(`    - ${f.errorType}: ${f.generatedAt}`);
  console.log(`  Total cache size: ${(totalSize / 1024).toFixed(2)} KB`);
  process.exit(0);
}

if (process.stdin.isTTY) {
  process.stdin.resume();
  process.stdin.on("data", (c) => { if (c.length === 1 && c[0] === 0x03) process.exit(0); });
}

const llmManager = initializeLLMProviders();
const config = configLoader.load();

const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
if (!fs.existsSync(resolvedDbPath)) {
  console.error("Error: Database file not found. Run IGT first to collect data.");
  process.exit(1);
}

const provider = llmManager.getCurrentProviderName();
const handbookModel = resolveModel(provider, "handbook", config).model;

if (provider === "ollama") {
  const baseUrl = config.OllamaBaseUrl || "http://localhost:11434";
  try {
    await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
  } catch {
    console.error(`\n❌ Cannot connect to Ollama at ${baseUrl}`);
    console.error("   Start Ollama first:  ollama serve");
    console.error("   Then load the model: ollama run " + handbookModel + "\n");
    process.exit(1);
  }
}

const [errorFrequency, trendData, stats, learningData] = await Promise.all([
  getErrorFrequency(days), getTrendData(days), getTotalStats(days), getLearningProfileData(days),
]);
const learningProfile = await buildLearningDiagnosis({
  days,
  goal: "general English",
  resourceMode: "local-and-web",
  vaultDir: config.VaultDir,
  loadData: async () => learningData,
});

const examplesByType = new Map();
for (const err of errorFrequency) {
  examplesByType.set(err.error_type, await getExamples(err.error_type, 5, days));
}

console.log(`🤖 Generating overall summary with ${provider.toUpperCase()}...`);
const overallSummary = await generateOverallSummary({ llm: llmManager, config, stats, errorFrequency, days });

console.log(`\n🤖 Generating ${errorFrequency.length} grammar rules with ${provider.toUpperCase()} (${handbookModel})...`);
const ruleResults = await Promise.allSettled(errorFrequency.map((err) =>
  generateTailoredRule({
    llm: llmManager, config,
    errorType: err.error_type, examples: examplesByType.get(err.error_type),
    incremental, log: console.log,
  }).then((rule) => [err.error_type, rule]),
));
const rules = new Map();
for (const r of ruleResults) {
  if (r.status === "fulfilled" && r.value && r.value[1]) rules.set(r.value[0], r.value[1]);
}

const dateStr = beijingDate();
const md = buildReport({ provider, handbookModel, date: dateStr, days, stats, errorFrequency, trendData, examplesByType, rules, overallSummary, learningProfile });

const saved = saveHandbookReport({ markdown: md, provider, date: dateStr, days, stats, errorFrequency, format }, config);
const outputPath = saved.markdownPath;

console.log(`\n✅ Personal Error Handbook generated: ${outputPath}`);
if (saved.htmlPath) console.log(`Offline HTML: ${saved.htmlPath}`);
console.log(`📊 Analyzed ${stats.total_inputs} inputs with ${stats.total_diagnoses} diagnoses`);
console.log(`🎯 Found ${errorFrequency.length} unique error types`);
if (incremental) {
  const { files } = cacheStats();
  console.log(`⚡ Incremental mode: ${files.length} rules cached`);
}
console.log(`\n💡 Tip: Use --incremental flag to reduce API calls by 60-80%`);
process.exit(0);
