-- Core IGT schema (Squashed 001-003: initial tables + consultations).
-- Idempotent (CREATE IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  total_inputs INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS inputs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  original_text TEXT NOT NULL,
  correction TEXT,
  refine TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  input_id INTEGER,
  error_type TEXT NOT NULL,
  severity TEXT,
  explanation TEXT,
  FOREIGN KEY (input_id) REFERENCES inputs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS advice (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  input_id INTEGER,
  rule TEXT,
  tip TEXT,
  FOREIGN KEY (input_id) REFERENCES inputs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  level TEXT NOT NULL,
  score_raw TEXT,
  inputs_window_start INTEGER,
  inputs_window_end INTEGER,
  inputs_count INTEGER
);

CREATE TABLE IF NOT EXISTS srs_cards (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type    TEXT    NOT NULL CHECK (source_type IN ('input', 'vocab')),
  source_id      INTEGER,           -- input.id for grammar cards; NULL for vocab cards
  prompt         TEXT    NOT NULL,
  answer         TEXT    NOT NULL,
  ease           REAL    DEFAULT 2.5,
  interval_days  INTEGER DEFAULT 1,
  due_date       DATE    NOT NULL,
  last_reviewed  TIMESTAMP,
  total_reviews  INTEGER DEFAULT 0,
  correct_streak INTEGER DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  word           TEXT,              -- vocab cards only
  pos            TEXT,
  zh             TEXT,
  meaning        TEXT,
  example        TEXT,
  note           TEXT
);

CREATE TABLE IF NOT EXISTS status_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    type TEXT NOT NULL, -- 'tip', 'quote', 'grammar_fact'
    author TEXT,
    source TEXT,
    last_shown_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consultations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    INTEGER NOT NULL,
  timestamp     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  question      TEXT NOT NULL,
  response_json TEXT NOT NULL,
  turn_count    INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_inputs_timestamp ON inputs(timestamp);
CREATE INDEX IF NOT EXISTS idx_diagnoses_input_id ON diagnoses(input_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_error_type ON diagnoses(error_type);
CREATE INDEX IF NOT EXISTS idx_advice_input_id ON advice(input_id);
CREATE INDEX IF NOT EXISTS idx_assessments_timestamp ON assessments(timestamp);
CREATE INDEX IF NOT EXISTS idx_srs_due ON srs_cards(due_date);
CREATE INDEX IF NOT EXISTS idx_srs_source ON srs_cards(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_inputs_session_id ON inputs(session_id);
CREATE INDEX IF NOT EXISTS idx_status_messages_last_shown_at ON status_messages(last_shown_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_status_messages_content ON status_messages(content);
CREATE INDEX IF NOT EXISTS idx_consultations_session_id ON consultations(session_id);
CREATE INDEX IF NOT EXISTS idx_consultations_timestamp ON consultations(timestamp);
