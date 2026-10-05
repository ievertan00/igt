import { getDb } from "../../db/connection.mjs";

export const PRACTICE_CATEGORIES = {
  difficulty: ["easy", "standard", "challenge"],
  style: ["casual", "neutral", "formal"],
  context: ["home-routines", "restaurants-cafes", "supermarkets-shopping", "cinema-entertainment", "friends-social", "health-pharmacy", "work-study", "commuting-transit", "travel-accommodation", "appointments-services"],
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
      WHERE active = 1 AND difficulty = ? AND (? = 'all' OR
        CASE json_extract(practice_fields_json, '$.register[0]') WHEN 'informal' THEN 'casual'
          ELSE json_extract(practice_fields_json, '$.register[0]') END = ?)
        AND (? = 'all' OR context = ?)
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
  const { practice_fields_json, hint_json, ...question } = row;
  const practice_fields = JSON.parse(practice_fields_json || "{}");
  const register = practice_fields.register?.[0];
  const metadata = Object.fromEntries(
    Object.entries(practice_fields).map(([key, values]) => [key, values.length === 1 ? values[0] : values]));
  const focus = practice_fields.grammar_point?.join("; ") || "";
  return { ...question, kind: "sentence", focus,
    error_type: focus,
    style: register === "informal" ? "casual" : register,
    hints: JSON.parse(hint_json || "{}"), metadata, practice_fields };
}

// Only learner-facing fields leave the selection endpoint; references and evaluator notes stay private.
export function publicPracticeQuestion(question) {
  const { id, kind, prompt_zh, difficulty, style, context, focus, hints, metadata, practice_fields } = question;
  return { id, kind, prompt_zh, difficulty, style, context, focus, hints, metadata, practice_fields };
}
