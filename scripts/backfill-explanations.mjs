// Retroactively attach diagnoses + explanations to legacy SRS / inputs data.
//
// Two modes:
//   --mode=orphan (default) — grammar SRS cards imported with source_id=NULL
//     (e.g. via scripts/import-warehouse.mjs). For each, ask the LLM to identify
//     each error between the card's `prompt` and `answer`, then atomically:
//       1. INSERT a synthetic row into `inputs`.
//       2. INSERT one row per diagnosis into `diagnoses`.
//       3. UPDATE the card's `source_id` to the new input id.
//
//   --mode=empty — inputs rows that already have diagnoses, but those diagnosis
//     rows carry NULL/blank explanation (legacy markdown importer). For each,
//     re-diagnose with the LLM and replace the input's diagnoses wholesale.
//     Skips inputs where correction is empty or equals original (nothing to
//     diagnose).
//
// Forces Ollama + gemma family for this run.
//
// Usage:
//   node scripts/backfill-explanations.mjs                     # orphan cards
//   node scripts/backfill-explanations.mjs --mode=empty        # legacy nulls
//   node scripts/backfill-explanations.mjs --limit=5           # cap N
//   node scripts/backfill-explanations.mjs --dry-run           # no writes
//   node scripts/backfill-explanations.mjs --due-only          # orphan mode only
//
// Re-runnable: rows already in good shape are skipped.

import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

import initializeLLMProviders, { configLoader } from "../lib/server/llm/init.mjs";
import { classifyErrorType, getErrorTypePath } from "../lib/domain/error-types.mjs";
import { GRAMMAR_RESPONSE_SCHEMA } from "../lib/domain/parse-diagnosis.mjs";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.join(path.dirname(__filename), "..");

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.slice("--limit=".length), 10) : null;
const dryRun = args.includes("--dry-run");
const dueOnly = args.includes("--due-only");
const modeArg = args.find((a) => a.startsWith("--mode="));
const mode = modeArg ? modeArg.slice("--mode=".length) : "orphan";
if (!["orphan", "empty"].includes(mode)) {
  console.error(`Unknown --mode=${mode}. Expected: orphan | empty`);
  process.exit(2);
}

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

console.log(`Provider: ollama · model: ${model}  · mode: ${mode}${dryRun ? "  [dry-run]" : ""}`);

// ── Build the work queue per mode ─────────────────────────────────────────────
// Each item is normalized to { kind, id, original, correction, label }.
let queue;
if (mode === "orphan") {
  queue = db
    .prepare(
      `SELECT id, prompt AS original, answer AS correction
         FROM srs_cards
        WHERE source_type = 'input'
          AND source_id IS NULL
          ${dueOnly ? "AND due_date <= date('now')" : ""}
        ORDER BY id ASC
        ${limit ? `LIMIT ${Math.max(1, limit | 0)}` : ""}`
    )
    .all()
    .map((r) => ({ kind: "orphan", id: r.id, original: r.original, correction: r.correction, label: `card ${r.id}` }));
} else {
  // empty mode: inputs whose diagnoses are NULL/blank AND there's a real correction to diagnose
  queue = db
    .prepare(
      `SELECT i.id, i.original_text AS original, i.correction AS correction
         FROM inputs i
        WHERE EXISTS (
                SELECT 1 FROM diagnoses d
                 WHERE d.input_id = i.id
                   AND (d.explanation IS NULL OR TRIM(d.explanation) = '')
              )
          AND i.correction IS NOT NULL
          AND TRIM(i.correction) != ''
          AND TRIM(i.correction) != TRIM(i.original_text)
        ORDER BY i.id ASC
        ${limit ? `LIMIT ${Math.max(1, limit | 0)}` : ""}`
    )
    .all()
    .map((r) => ({ kind: "empty", id: r.id, original: r.original, correction: r.correction, label: `input ${r.id}` }));
}

console.log(`Items to process: ${queue.length}\n`);
if (queue.length === 0) {
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
const deleteDiagnosesForInput = db.prepare(`DELETE FROM diagnoses WHERE input_id = ?`);

async function diagnoseEdit(original, correction) {
  const userMessage = `Original: ${original}\nCorrection: ${correction}`;
  const raw = await llm.generateWithFallback(userMessage, SYSTEM_PROMPT, {
    taskType: "grammar",
    jsonSchema: GRAMMAR_RESPONSE_SCHEMA,
  });
  return parseDiagnoses(raw)
    .map((d) => {
      const rawType = (d.type || d.error_type || "").trim();
      if (!rawType) return null;
      const explanation = (d.explanation || "").trim();
      const errorType = getErrorTypePath(classifyErrorType(rawType));
      return {
        error_type: errorType,
        severity: ["Minor", "Moderate", "Major"].includes(d.severity) ? d.severity : "Minor",
        // Same fallback rule as parseDiagnosis core: never leave explanation empty.
        explanation: explanation || errorType,
      };
    })
    .filter(Boolean);
}

let backfilled = 0;
let skippedEmpty = 0;
let failed = 0;

for (let i = 0; i < queue.length; i++) {
  const item = queue[i];
  const tag = `[${i + 1}/${queue.length}] ${item.label}`;
  const preview = item.original.length > 60 ? item.original.slice(0, 60) + "…" : item.original;
  process.stdout.write(`${tag} ${preview}\n`);

  let normalized;
  try {
    normalized = await diagnoseEdit(item.original, item.correction);
  } catch (err) {
    failed++;
    console.log(`    ✗ LLM error: ${err.message}\n`);
    continue;
  }

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
      if (item.kind === "orphan") {
        const timestamp = new Date().toISOString();
        const res = insertInput.run(timestamp, item.original, item.correction);
        const inputId = res.lastInsertRowid;
        for (const d of normalized) {
          insertDiagnosis.run(inputId, d.error_type, d.severity, d.explanation);
        }
        linkCard.run(inputId, item.id);
      } else {
        // empty mode — replace this input's diagnoses in place
        deleteDiagnosesForInput.run(item.id);
        for (const d of normalized) {
          insertDiagnosis.run(item.id, d.error_type, d.severity, d.explanation);
        }
      }
    })();
    backfilled++;
    const detail = item.kind === "orphan"
      ? `linked to new input · ${normalized.length} diagnosis row(s)`
      : `replaced with ${normalized.length} diagnosis row(s)`;
    console.log(`    ✓ ${detail}\n`);
  } catch (err) {
    failed++;
    console.log(`    ✗ DB error: ${err.message}\n`);
  }
}

console.log(`Done. backfilled=${backfilled} skipped_empty=${skippedEmpty} failed=${failed}`);
db.close();
