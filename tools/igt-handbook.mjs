import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initializeLLMProviders, { configLoader } from "../lib/llm/init.mjs";
import { getErrorFrequency, getTrendData, getTotalStats, getExamples } from "../lib/handbook/queries.mjs";
import { generateTailoredRule, generateOverallSummary } from "../lib/handbook/generator.mjs";
import { clearCache, cacheStats } from "../lib/handbook/cache.mjs";
import { buildReport } from "../lib/handbook/report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const args = process.argv.slice(2);
const days = (() => {
  const a = args.find((s) => s.startsWith("--days="));
  return a ? parseInt(a.split("=")[1]) : 30;
})();
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
const handbookModel = (() => {
  if (provider === "qwen") return config.QwenProModel || "qwen3-max";
  if (provider === "deepseek") return config.DeepseekProModel || "deepseek-reasoner";
  if (provider === "ollama") return config.OllamaModel || "phi4";
  return config.GeminiProModel || "gemini-3.0-pro";
})();

const [errorFrequency, trendData, stats] = await Promise.all([
  getErrorFrequency(days), getTrendData(days), getTotalStats(days),
]);

const examplesByType = new Map();
for (const err of errorFrequency) {
  examplesByType.set(err.error_type, await getExamples(err.error_type, 5));
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

const dateStr = new Date().toISOString().split("T")[0];
const md = buildReport({ provider, handbookModel, date: dateStr, days, stats, errorFrequency, trendData, examplesByType, rules, overallSummary });

const reportDir = config.ReportPath
  ? (path.isAbsolute(config.ReportPath) ? config.ReportPath : path.join(projectRoot, config.ReportPath))
  : path.join(projectRoot, "docs");
const outputPath = path.join(reportDir, `handbook_${dateStr}_${provider}.md`);
if (!fs.existsSync(path.dirname(outputPath))) fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, md, "utf8");

console.log(`\n✅ Personal Error Handbook generated: ${outputPath}`);
console.log(`📊 Analyzed ${stats.total_inputs} inputs with ${stats.total_diagnoses} diagnoses`);
console.log(`🎯 Found ${errorFrequency.length} unique error types`);
if (incremental) {
  const { files } = cacheStats();
  console.log(`⚡ Incremental mode: ${files.length} rules cached`);
}
console.log(`\n💡 Tip: Use --incremental flag to reduce API calls by 60-80%`);
process.exit(0);
