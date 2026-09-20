CREATE TABLE IF NOT EXISTS practice_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_type TEXT NOT NULL,
  target_error_type TEXT,
  target_pattern TEXT,
  prompt TEXT NOT NULL,
  learner_answer TEXT NOT NULL,
  reference_answer TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  feedback TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_practice_attempts_target
  ON practice_attempts(target_error_type, created_at);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_created_at
  ON practice_attempts(created_at);
