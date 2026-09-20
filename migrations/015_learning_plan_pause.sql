ALTER TABLE learning_plans ADD COLUMN paused_at TEXT;

CREATE INDEX IF NOT EXISTS idx_learning_plans_paused_at
  ON learning_plans(paused_at);
