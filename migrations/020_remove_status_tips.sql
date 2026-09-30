-- Remove tip status messages. Usage tips described retired commands (/undo,
-- /vocab, /stats, /review/grade) and no longer reflect the current CLI surface.
-- Quotes and grammar facts are kept as the status bar source.
DELETE FROM status_messages
WHERE type = 'tip';
