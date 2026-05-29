// Retroactively attach diagnoses + explanations to grammar SRS cards that were
// imported with source_id=NULL (e.g. via scripts/import-warehouse.mjs).
//
// For each orphan card, ask the active LLM to identify each error between the
// card's `prompt` (original) and `answer` (correction), then atomically:
//   1. INSERT a synthetic row into `inputs` (original_text, correction).
//   2. INSERT one row per diagnosis into `diagnoses`.
//   3. UPDATE the card's `source_id` to the new input id.
//
// Forces Ollama + gemma family for this run.
//
// Usage:
//   node scripts/backfill-explanations.mjs               # all orphan cards
//   node scripts/backfill-explanations.mjs --limit=5     # cap N
//   node scripts/backfill-explanations.mjs --dry-run     # no writes
//   node scripts/backfill-explanations.mjs --due-only    # only due cards
//
// Re-runnable: cards already linked to a real inputs row are skipped.

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

import initializeLLMProviders, { configLoader } from "../lib/server/llm/init.mjs";
import { classifyErrorType, getErrorTypePath } from "../lib/domain/error-types.mjs";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.join(path.dirname(__filename), "..");

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.slice("--limit=".length), 10) : null;
const dryRun = args.includes("--dry-run");
const dueOnly = args.includes("--due-only");

// ── Force Ollama + gemma for this run ─────────────────────────────────────────
process.env.IGT_LLM_PROVIDER = "ollama";
const baseConfig = configLoader.load();
const config = { ...baseConfig, OllamaFamily: "gemma" };
const llm = initializeLLMProviders(config);
const model = llm.getCurrentProvider().getModelName(config, "grammar");

// ── DB ────────────────────────────────────────────────────────────────────────
const dbPath = path.isAbsolute(config.DbPath || "")
  ? config.DbPath
  : path.join(projectRoot, config.DbPath || "igt_data.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

const orphans = db
  .prepare(
    `SELECT id, prompt, answer, due_date
       FROM srs_cards
      WHERE source_type = 'input'
        AND source_id IS NULL
        ${dueOnly ? "AND due_date <= date('now')" : ""}
      ORDER BY id ASC
      ${limit ? `LIMIT ${Math.max(1, limit | 0)}` : ""}`
  )
  .all();

console.log(`Provider: ollama · model: ${model}`);
console.log(`Orphan cards to process: ${orphans.length}${dryRun ? "  [dry-run]" : ""}\n`);

if (orphans.length === 0) {
  db.close();
  process.exit(0);
}

// ── Prompt focused on diagnosing a known fix ──────────────────────────────────
const SYSTEM_PROMPT = `You are a Linguistic Validator. Given an English sentence and its corrected version, identify EACH error that was fixed.

For each error, output: type (exact taxonomy string), severity (Minor | Moderate | Major), and a one-sentence explanation.

### Taxonomy:
- Grammar: Article Usage, Verb Tense, Subject-Verb Agreement, Pronoun Usage, Preposition Usage, Conjunction/Connector, Modifier Placement, Sentence Structure, Parallel Structure, Word Form, Comparison, Negation.
- Vocabulary: Word Choice, Collocation, Idiomatic Expression, Redundancy.
- Mechanics: Spelling, Punctuation, Capitalization, Spacing & Formatting.
- Style: Phrasing, Conciseness, Tone & Register, Repetition, Voice (Active/Passive).
- Clarity: Ambiguity, Unclear Reference, Logical Inconsistency.

Output raw JSON only — no markdown fences:
{
  "diagnoses": [
    { "type": "<exact taxonomy string>", "severity": "Minor|Moderate|Major", "explanation": "<one short sentence>" }
  ]
}

If Original and Correction are identical, return {"diagnoses": []}.`;

function parseDiagnoses(raw) {
  const cleaned = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  // Some local models prepend prose; grab the first {...} block as fallback.
  let json = cleaned;
  if (!json.startsWith("{")) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) json = m[0];
  }
  const data = JSON.parse(json);
  return Array.isArray(data.diagnoses) ? data.diagnoses : [];
}

// ── Insert statements (prepared once) ─────────────────────────────────────────
const insertInput = db.prepare(`
  INSERT INTO inputs (session_id, timestamp, original_text, correction, refine)
  VALUES (NULL, ?, ?, ?, NULL)
`);
const insertDiagnosis = db.prepare(`
  INSERT INTO diagnoses (input_id, error_type, severity, explanation)
  VALUES (?, ?, ?, ?)
`);
const linkCard = db.prepare(`UPDATE srs_cards SET source_id = ? WHERE id = ?`);

let backfilled = 0;
let skippedEmpty = 0;
let failed = 0;

for (let i = 0; i < orphans.length; i++) {
  const card = orphans[i];
  const tag = `[${i + 1}/${orphans.length}] card ${card.id}`;
  const preview = card.prompt.length > 60 ? card.prompt.slice(0, 60) + "…" : card.prompt;
  process.stdout.write(`${tag} ${preview}\n`);

  const userMessage = `Original: ${card.prompt}\nCorrection: ${card.answer}`;

  let diagnoses;
  try {
    const raw = await llm.generateWithFallback(userMessage, SYSTEM_PROMPT, {
      taskType: "grammar",
      responseFormat: { type: "json_object" },
    });
    diagnoses = parseDiagnoses(raw);
  } catch (err) {
    failed++;
    console.log(`    ✗ LLM error: ${err.message}\n`);
    continue;
  }

  const normalized = diagnoses
    .map((d) => {
      const rawType = (d.type || d.error_type || "").trim();
      if (!rawType) return null;
      return {
        error_type: getErrorTypePath(classifyErrorType(rawType)),
        severity: ["Minor", "Moderate", "Major"].includes(d.severity) ? d.severity : "Minor",
        explanation: (d.explanation || "").trim(),
      };
    })
    .filter(Boolean);

  if (normalized.length === 0) {
    skippedEmpty++;
    console.log(`    – no diagnoses returned, skipping\n`);
    continue;
  }

  if (dryRun) {
    for (const d of normalized) {
      console.log(`    · [${d.severity}] ${d.error_type} — ${d.explanation}`);
    }
    console.log();
    backfilled++;
    continue;
  }

  try {
    db.transaction(() => {
      const timestamp = new Date().toISOString();
      const res = insertInput.run(timestamp, card.prompt, card.answer);
      const inputId = res.lastInsertRowid;
      for (const d of normalized) {
        insertDiagnosis.run(inputId, d.error_type, d.severity, d.explanation);
      }
      linkCard.run(inputId, card.id);
    })();
    backfilled++;
    console.log(`    ✓ linked to new input · ${normalized.length} diagnosis row(s)\n`);
  } catch (err) {
    failed++;
    console.log(`    ✗ DB error: ${err.message}\n`);
  }
}

console.log(`Done. backfilled=${backfilled} skipped_empty=${skippedEmpty} failed=${failed}`);
db.close();
