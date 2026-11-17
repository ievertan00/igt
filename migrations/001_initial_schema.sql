-- IGT baseline schema, squashed from the historical migration chain (001-071).
-- Creates the final runtime tables only; retired grammar-session, Coach-plan and
-- quiz storage is not recreated. Idempotent (CREATE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS srs_cards (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type    TEXT    NOT NULL CHECK (source_type IN ('input', 'vocab')),
  source_id      INTEGER,
  prompt         TEXT    NOT NULL,
  answer         TEXT    NOT NULL,
  ease           REAL    DEFAULT 2.5,
  interval_days  INTEGER DEFAULT 1,
  due_date       DATE    NOT NULL,
  last_reviewed  TIMESTAMP,
  total_reviews  INTEGER DEFAULT 0,
  correct_streak INTEGER DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  word           TEXT,
  pos            TEXT,
  zh             TEXT,
  meaning        TEXT,
  example        TEXT,
  note           TEXT,
  vocab_details  TEXT
);

CREATE TABLE IF NOT EXISTS status_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  type TEXT NOT NULL, -- 'quote', 'grammar_fact'
  author TEXT,
  source TEXT,
  last_shown_at DATETIME
);

CREATE TABLE IF NOT EXISTS practice_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_type TEXT NOT NULL,
  target_error_type TEXT,
  target_pattern TEXT,
  context_label TEXT,
  prompt TEXT NOT NULL,
  learner_answer TEXT NOT NULL,
  reference_answer TEXT NOT NULL,
  score INTEGER NOT NULL,
  feedback TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS practice_questions (
  id TEXT PRIMARY KEY,
  prompt_zh TEXT NOT NULL UNIQUE,
  reference_answer TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'standard', 'challenge')),
  context TEXT NOT NULL CHECK (context IN ('home', 'dining', 'shopping', 'entertainment', 'social', 'health', 'work', 'transit', 'travel', 'services')),
  practice_fields_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(practice_fields_json) AND json_type(practice_fields_json) = 'object'),
  hint_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(hint_json) AND json_type(hint_json) = 'object'),
  generated_by TEXT NOT NULL DEFAULT 'unknown',
  served_count INTEGER NOT NULL DEFAULT 0 CHECK (served_count >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_srs_due ON srs_cards(due_date);
CREATE INDEX IF NOT EXISTS idx_srs_source ON srs_cards(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_target
  ON practice_attempts(target_error_type, created_at);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_created_at
  ON practice_attempts(created_at);
CREATE INDEX IF NOT EXISTS practice_questions_selection
  ON practice_questions(active, difficulty, context, served_count);