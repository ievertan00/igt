-- Review history is stored in Markdown; SQLite keeps only rebuildable runtime
-- state and vocabulary SRS cards.
PRAGMA foreign_keys = ON;

DELETE FROM srs_cards WHERE source_type = 'input';
DROP TABLE IF EXISTS consultations;
DROP TABLE IF EXISTS advice;
DROP TABLE IF EXISTS diagnoses;
DROP TABLE IF EXISTS inputs;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS assessments;
