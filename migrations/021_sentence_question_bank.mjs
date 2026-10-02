import { DEFAULT_PRACTICE_QUESTIONS } from "../lib/features/practice/default-questions.mjs";

export function up(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS practice_questions (
    id TEXT PRIMARY KEY,
    prompt_zh TEXT NOT NULL UNIQUE,
    reference_answer TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'standard', 'challenge')),
    style TEXT NOT NULL CHECK (style IN ('casual', 'neutral', 'formal')),
    context TEXT NOT NULL CHECK (context IN ('everyday', 'work', 'travel')),
    focus TEXT NOT NULL,
    error_type TEXT NOT NULL,
    served_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS practice_questions_categories ON practice_questions(difficulty, style, context);`);
  const insert = db.prepare(`INSERT OR IGNORE INTO practice_questions
    (id, prompt_zh, reference_answer, difficulty, style, context, focus, error_type)
    VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @style, @context, @focus, @error_type)`);
  for (const question of DEFAULT_PRACTICE_QUESTIONS) insert.run(question);
}
