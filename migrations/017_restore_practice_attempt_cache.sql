-- Practice evidence remains a rebuildable cache until the Practice Log writer
-- and reader are implemented. It is not a user-asset authority.
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  learning_task_id INTEGER REFERENCES learning_tasks(id)
);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_target
  ON practice_attempts(target_error_type, created_at);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_created_at
  ON practice_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_task
  ON practice_attempts(learning_task_id);
