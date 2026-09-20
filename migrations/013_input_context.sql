ALTER TABLE inputs ADD COLUMN context_label TEXT;
ALTER TABLE inputs ADD COLUMN context_confidence TEXT;
ALTER TABLE inputs ADD COLUMN context_source TEXT;
CREATE INDEX IF NOT EXISTS idx_inputs_context
  ON inputs(context_label, context_confidence, timestamp);
