-- Initial IGT schema. Idempotent (CREATE IF NOT EXISTS) so it's safe on existing DBs.

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
  FOREIGN KEY (input_id) REFERENCES inputs(id)
);

CREATE TABLE IF NOT EXISTS advice (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  input_id INTEGER,
  rule TEXT,
  tip TEXT,
  FOREIGN KEY (input_id) REFERENCES inputs(id)
);

CREATE TABLE IF NOT EXISTS vocab (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  input_id INTEGER,
  original_word TEXT NOT NULL,
  better_word TEXT NOT NULL,
  context TEXT,
  explanation TEXT,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  quiz_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  FOREIGN KEY (input_id) REFERENCES inputs(id)
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

CREATE INDEX IF NOT EXISTS idx_inputs_timestamp ON inputs(timestamp);
CREATE INDEX IF NOT EXISTS idx_diagnoses_input_id ON diagnoses(input_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_error_type ON diagnoses(error_type);
CREATE INDEX IF NOT EXISTS idx_advice_input_id ON advice(input_id);
CREATE INDEX IF NOT EXISTS idx_vocab_quiz ON vocab(quiz_count, correct_count);
CREATE INDEX IF NOT EXISTS idx_assessments_timestamp ON assessments(timestamp);
