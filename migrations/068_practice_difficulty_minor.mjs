// Milestone C (P1b) from docs/practice-bank-revision-plan.md: recalibrate the
// sixteen documented minor "easy" mislabels to "standard". Each is an intermediate
// sentence (formal announcement, modal passive/perfect, noun clause, compound with
// perfect tense, or abstract vocabulary) that a beginner cannot reliably produce.
// All sixteen rows are outside the "native" seed group, so the native-seed 50/50
// difficulty test is unaffected. The native group itself is intentionally left
// unchanged: its standard/challenge labels reflect grammar load (e.g. present
// perfect continuous and passive are intermediate even when structurally simple).
// Idempotent and guarded; re-export afterwards.

const P = (n) => `practice-202610-${n}`;

const DIFFICULTY_FIXES = [
  { id: P("0113"), before: "easy", after: "standard" },
  { id: P("0114"), before: "easy", after: "standard" },
  { id: P("0320"), before: "easy", after: "standard" },
  { id: P("0325"), before: "easy", after: "standard" },
  { id: P("0371"), before: "easy", after: "standard" },
  { id: P("0374"), before: "easy", after: "standard" },
  { id: P("0447"), before: "easy", after: "standard" },
  { id: P("0618"), before: "easy", after: "standard" },
  { id: P("0624"), before: "easy", after: "standard" },
  { id: P("0667"), before: "easy", after: "standard" },
  { id: P("0669"), before: "easy", after: "standard" },
  { id: P("0722"), before: "easy", after: "standard" },
  { id: P("0937"), before: "easy", after: "standard" },
  { id: P("0939"), before: "easy", after: "standard" },
  { id: P("0952"), before: "easy", after: "standard" },
  { id: P("0954"), before: "easy", after: "standard" },
];

export function up(db) {
  db.transaction(() => {
    const get = db.prepare("SELECT difficulty FROM practice_questions WHERE id = ?");
    const setDifficulty = db.prepare("UPDATE practice_questions SET difficulty = ? WHERE id = ?");
    for (const { id, before, after } of DIFFICULTY_FIXES) {
      const row = get.get(id);
      if (!row) throw new Error(`Migration 068: missing Practice row ${id}.`);
      if (row.difficulty === after) continue;
      if (row.difficulty !== before) throw new Error(`Migration 068: ${id} difficulty conflict; expected ${before}, found ${row.difficulty}.`);
      setDifficulty.run(after, id);
    }
  })();
}

export function down() {
  throw new Error("Migration 068 is irreversible without restoring the pre-migration database backup.");
}