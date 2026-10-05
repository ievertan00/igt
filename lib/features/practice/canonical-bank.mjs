import snapshot from "./canonical-questions.json" with { type: "json" };
import groups from "./historical-seed-ids.json" with { type: "json" };

// A versioned export of the authoritative live database, never a runtime writer.
export const PRACTICE_CONTENT_COLUMNS = ["id", "prompt_zh", "reference_answer", "difficulty", "context", "practice_fields_json", "hint_json", "generated_by", "active"];
export const CANONICAL_PRACTICE_QUESTIONS = snapshot.questions;
export const PRACTICE_SNAPSHOT = snapshot;

export function practiceContent(row) {
  return Object.fromEntries(PRACTICE_CONTENT_COLUMNS.map(key => [key, row[key]]));
}

export function legacyQuestion(row, variant) {
  const fields = JSON.parse(row.practice_fields_json);
  const metadata = Object.fromEntries(Object.entries(fields)
    .filter(([key]) => key !== "grammar_point")
    .map(([key, values]) => [key, values.length === 1 ? values[0] : values]));
  const focus = fields.grammar_point?.join("; ") || "";
  const register = fields.register?.[0];
  return {
    id: row.id, prompt_zh: row.prompt_zh, reference_answer: row.reference_answer,
    difficulty: row.difficulty, focus, error_type: focus,
    focus_id: row.id.match(/^language-(.+)-[^-]+$/)?.[1].toUpperCase() || "",
    variant, alternative_note: "", metadata,
    style: register === "informal" ? "casual" : register,
    context: metadata.situation === "work-study" ? "work"
      : metadata.situation === "travel-public-life" ? "travel" : "everyday",
    hints: JSON.parse(row.hint_json), generated_by: row.generated_by,
  };
}

export function legacyQuestions(variants) {
  const membership = new Map(variants.flatMap(variant => groups[variant].map(id => [id, variant])));
  return CANONICAL_PRACTICE_QUESTIONS.filter(row => membership.has(row.id))
    .map(row => legacyQuestion(row, membership.get(row.id)));
}

// IDs only: historical migration membership carries no deleted annotations.
export function historicalSeedRows(variant) {
  const ids = new Set(groups[variant]);
  return CANONICAL_PRACTICE_QUESTIONS.filter(row => ids.has(row.id));
}

// Only insert absent IDs. Existing live content and all usage/activation state win.
// Early migrations do not carry provenance, so fill that field only when unknown.
export function restoreCanonicalQuestions(db, rows = CANONICAL_PRACTICE_QUESTIONS, { fillUnknownProvenance = false } = {}) {
  return db.transaction(() => {
    const find = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const pending = [];
    for (const row of rows) {
      const existing = find.get(row.id);
      if (!existing) { pending.push(row); continue; }
      for (const key of PRACTICE_CONTENT_COLUMNS.filter(key => key !== "active" && !(fillUnknownProvenance && key === "generated_by"))) {
        if (existing[key] !== row[key]) {
          throw new Error(`Practice content conflict for ${row.id}/${key}. Export the authoritative database before restoring; existing content was not overwritten.`);
        }
      }
    }
    const insert = db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json, hint_json, generated_by, served_count, active)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @context, @practice_fields_json, @hint_json, @generated_by, 0, @active)`);
    for (const row of pending) insert.run(row);
    const provenance = db.prepare("UPDATE practice_questions SET generated_by = ? WHERE id = ? AND generated_by = 'unknown'");
    if (fillUnknownProvenance) for (const row of rows) if (row.generated_by !== "unknown") provenance.run(row.generated_by, row.id);
    return pending.length;
  })();
}
