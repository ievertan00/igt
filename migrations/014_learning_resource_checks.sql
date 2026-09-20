CREATE TABLE IF NOT EXISTS learning_resource_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL UNIQUE,
  ok INTEGER NOT NULL CHECK (ok IN (0, 1)),
  status INTEGER,
  final_url TEXT,
  reason TEXT NOT NULL,
  checked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_resource_checks_checked_at
  ON learning_resource_checks(checked_at);
