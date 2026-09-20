CREATE TABLE IF NOT EXISTS learning_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal TEXT NOT NULL,
  window_days INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES learning_plans(id) ON DELETE CASCADE,
  priority_index INTEGER NOT NULL,
  error_type TEXT NOT NULL,
  phase INTEGER NOT NULL CHECK (phase BETWEEN 1 AND 4),
  phase_name TEXT NOT NULL,
  task TEXT NOT NULL,
  check_text TEXT NOT NULL,
  scheduled_day INTEGER NOT NULL CHECK (scheduled_day BETWEEN 1 AND 14),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_learning_plans_status
  ON learning_plans(status, created_at);
CREATE INDEX IF NOT EXISTS idx_learning_tasks_due
  ON learning_tasks(plan_id, status, scheduled_day);
