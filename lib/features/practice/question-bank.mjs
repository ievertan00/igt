import { getDb } from "../../db/connection.mjs";

export const PRACTICE_CATEGORIES = {
  difficulty: ["easy", "standard", "challenge"],
  style: ["casual", "neutral", "formal"],
  context: ["everyday", "work", "travel"],
};

export function validatePracticeFilters({ count = 3, difficulty = "standard", style = "all", context = "all" } = {}) {
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error("Count must be an integer between 1 and 10.");
  for (const [key, value] of Object.entries({ difficulty, style, context })) {
    if (!(key !== "difficulty" && value === "all") && !PRACTICE_CATEGORIES[key].includes(value)) {
      throw new Error(`Invalid ${key}. Choose one of: ${PRACTICE_CATEGORIES[key].join(", ")}${key === "difficulty" ? "" : ", all"}.`);
    }
  }
  return { count, difficulty, style, context };
}

export function selectPracticeQuestions(db, filters) {
  const { count, difficulty, style, context } = validatePracticeFilters(filters);
  return db.transaction(() => {
    const questions = db.prepare(`SELECT *, 'sentence' AS kind FROM practice_questions
      WHERE active = 1 AND difficulty = ? AND (? = 'all' OR style = ?) AND (? = 'all' OR context = ?)
      ORDER BY served_count ASC, RANDOM() LIMIT ?`).all(difficulty, style, style, context, context, count).map(decodePracticeQuestion);
    const update = db.prepare("UPDATE practice_questions SET served_count = served_count + 1 WHERE id = ?");
    for (const question of questions) update.run(question.id);
    return questions;
  })();
}

export async function getPracticeQuestions(filters) {
  return selectPracticeQuestions(await getDb(), filters);
}

export async function getPracticeQuestion(id) {
  return decodePracticeQuestion((await getDb({ readonly: true })).prepare("SELECT *, 'sentence' AS kind FROM practice_questions WHERE id = ?").get(id));
}

export function decodePracticeQuestion(row) {
  if (!row) return row;
  const { hints_json, metadata_json, ...question } = row;
  return { ...question, hints: JSON.parse(hints_json || "{}"), metadata: JSON.parse(metadata_json || "{}") };
}

// Only learner-facing fields leave the selection endpoint; references and evaluator notes stay private.
export function publicPracticeQuestion(question) {
  const { id, kind, prompt_zh, difficulty, style, context, focus_id, focus, variant, hints, metadata } = question;
  return { id, kind, prompt_zh, difficulty, style, context, focus_id, focus, variant, hints, metadata };
}
