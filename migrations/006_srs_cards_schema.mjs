/**
 * Fixes srs_cards schema alignment:
 * - source_id: NOT NULL → nullable (vocab cards have no DB source entity)
 * - source_type: add CHECK ('input' | 'vocab')
 * - created_at: new column, backfilled with CURRENT_TIMESTAMP
 * - word/pos/zh/meaning/example/note: explicit vocab columns (NULL for grammar cards)
 * - prompt: vocab cards set to word (was VOCAB|||... pipe-delimited struct)
 */

export function up(db) {
  db.pragma("foreign_keys = OFF");

  // Step 1 — rename old table and create new schema
  db.exec(`
    ALTER TABLE srs_cards RENAME TO _srs_cards_old;

    CREATE TABLE srs_cards (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type    TEXT    NOT NULL CHECK (source_type IN ('input', 'vocab')),
      source_id      INTEGER,
      prompt         TEXT    NOT NULL,
      answer         TEXT    NOT NULL,
      ease           REAL    DEFAULT 2.5,
      interval_days  INTEGER DEFAULT 1,
      due_date       DATE    NOT NULL,
      last_reviewed  TIMESTAMP,
      total_reviews  INTEGER DEFAULT 0,
      correct_streak INTEGER DEFAULT 0,
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      word           TEXT,
      pos            TEXT,
      zh             TEXT,
      meaning        TEXT,
      example        TEXT,
      note           TEXT
    );
  `);

  // Step 2 — copy grammar cards as-is (source_id = input_id stays)
  db.exec(`
    INSERT INTO srs_cards
      (id, source_type, source_id, prompt, answer, ease, interval_days,
       due_date, last_reviewed, total_reviews, correct_streak)
    SELECT
      id, source_type, source_id, prompt, answer, ease, interval_days,
      due_date, last_reviewed, total_reviews, correct_streak
    FROM _srs_cards_old
    WHERE source_type = 'input';
  `);

  // Step 3 — backfill vocab cards: parse VOCAB||| prompt into columns
  const vocabCards = db.prepare(`SELECT * FROM _srs_cards_old WHERE source_type = 'vocab'`).all();
  const ins = db.prepare(`
    INSERT INTO srs_cards
      (id, source_type, source_id, prompt, answer, ease, interval_days,
       due_date, last_reviewed, total_reviews, correct_streak,
       word, pos, zh, meaning, example, note)
    VALUES
      (?, 'vocab', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const card of vocabCards) {
      let word = card.answer, pos = "", zh = "", meaning = "", example = "", note = "";
      if (card.prompt.startsWith("VOCAB|||")) {
        const p = card.prompt.split("|||");
        // format: VOCAB|||word|||pos|||zh|||meaning|||example|||note
        word    = p[1] || card.answer;
        pos     = p[2] || "";
        zh      = p[3] || "";
        meaning = p[4] || "";
        example = p[5] || "";
        note    = p[6] || "";
      }
      ins.run(
        card.id,
        word, card.answer,                    // prompt = word, answer = word
        card.ease, card.interval_days,
        card.due_date, card.last_reviewed,
        card.total_reviews, card.correct_streak,
        word, pos, zh, meaning, example, note
      );
    }
  })();

  // Step 4 — drop old table and recreate indexes
  db.exec(`
    DROP TABLE _srs_cards_old;
    CREATE INDEX IF NOT EXISTS idx_srs_due    ON srs_cards(due_date);
    CREATE INDEX IF NOT EXISTS idx_srs_source ON srs_cards(source_type, source_id);
  `);

  db.pragma("foreign_keys = ON");
}
