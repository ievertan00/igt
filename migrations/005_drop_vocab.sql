-- Drop the vocab table. Vocabulary is stored exclusively in the Markdown vault
-- (IGT Vocabulary.md). SRS cards for vocab words live in srs_cards (source_type='vocab').
DROP TABLE IF EXISTS vocab;
