/**
 * Add ON DELETE CASCADE to diagnoses and advice FK constraints.
 * Add missing idx_inputs_session_id index.
 * SQLite requires full table recreation to modify existing FK constraints.
 */

export function up(db) {
  db.pragma("foreign_keys = OFF");

  db.transaction(() => {
    db.exec(`
      ALTER TABLE diagnoses RENAME TO _diagnoses_old;
      CREATE TABLE diagnoses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input_id INTEGER,
        error_type TEXT NOT NULL,
        severity TEXT,
        explanation TEXT,
        FOREIGN KEY (input_id) REFERENCES inputs(id) ON DELETE CASCADE
      );
      INSERT INTO diagnoses SELECT * FROM _diagnoses_old;
      DROP TABLE _diagnoses_old;

      ALTER TABLE advice RENAME TO _advice_old;
      CREATE TABLE advice (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input_id INTEGER,
        rule TEXT,
        tip TEXT,
        FOREIGN KEY (input_id) REFERENCES inputs(id) ON DELETE CASCADE
      );
      INSERT INTO advice SELECT * FROM _advice_old;
      DROP TABLE _advice_old;

      CREATE INDEX IF NOT EXISTS idx_diagnoses_input_id ON diagnoses(input_id);
      CREATE INDEX IF NOT EXISTS idx_diagnoses_error_type ON diagnoses(error_type);
      CREATE INDEX IF NOT EXISTS idx_advice_input_id ON advice(input_id);
      CREATE INDEX IF NOT EXISTS idx_inputs_session_id ON inputs(session_id);
    `);
  })();

  db.pragma("foreign_keys = ON");
}
