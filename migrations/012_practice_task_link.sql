ALTER TABLE practice_attempts ADD COLUMN learning_task_id INTEGER REFERENCES learning_tasks(id);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_task
  ON practice_attempts(learning_task_id);
