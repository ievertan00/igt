ALTER TABLE practice_attempts ADD COLUMN context_label TEXT;
CREATE INDEX IF NOT EXISTS idx_practice_attempts_context
  ON practice_attempts(context_label, created_at);
