import { getDb } from "../../db/connection.mjs";

export function normalizeQuizText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[，。！？、；：、“”‘’"'!?.,;:()[\]{}]/g, "");
}

function ngrams(value) {
  const normalized = normalizeQuizText(value);
  if (!normalized) return new Set();
  const chars = [...normalized];
  if (chars.length < 4) return new Set(chars);
  return new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1]));
}

export function quizFingerprint(chinese) {
  return normalizeQuizText(chinese);
}

export function isSimilarQuizQuestion(candidate, previous, threshold = 0.45) {
  const left = normalizeQuizText(candidate);
  const right = normalizeQuizText(previous);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const a = ngrams(left);
  const b = ngrams(right);
  if (!a.size || !b.size) return false;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return intersection / (a.size + b.size - intersection) >= threshold;
}

export function isNovelQuizQuestion(question, previousQuestions = []) {
  return !previousQuestions.some((previous) => isSimilarQuizQuestion(
    question.chinese || question.prompt,
    previous.chinese || previous.prompt || previous,
  ));
}

export async function getQuizHistory(limit = 500) {
  const db = await getDb({ readonly: true });
  const safeLimit = Math.min(2000, Math.max(1, Number.isInteger(limit) ? limit : 500));
  return db.prepare(`
    SELECT chinese, reference_answer, error_type, fingerprint, created_at
    FROM quiz_questions
    ORDER BY id DESC
    LIMIT ?
  `).all(safeLimit);
}

export async function saveQuizQuestions(questions) {
  if (!questions?.length) return 0;
  const db = await getDb();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO quiz_questions (chinese, reference_answer, error_type, fingerprint)
    VALUES (?, ?, ?, ?)
  `);
  const saveMany = db.transaction((items) => {
    let saved = 0;
    for (const question of items) {
      const result = insert.run(
        question.chinese,
        question.reference_answer,
        question.error_type || null,
        quizFingerprint(question.chinese),
      );
      saved += result.changes;
    }
    return saved;
  });
  return saveMany(questions);
}
