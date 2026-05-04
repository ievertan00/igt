-- SRS deck (Phase 1.1). Cloze-style cards (A6); no `graduated` column (A12 — SM-2 handles
-- long-term spacing via exponential interval growth).

CREATE TABLE IF NOT EXISTS srs_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,        -- 'diagnosis' | 'cloze' | 'vocab'
  source_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  answer TEXT NOT NULL,
  ease REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  due_date DATE NOT NULL,
  last_reviewed TIMESTAMP,
  total_reviews INTEGER DEFAULT 0,
  correct_streak INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_srs_due ON srs_cards(due_date);
CREATE INDEX IF NOT EXISTS idx_srs_source ON srs_cards(source_type, source_id);
