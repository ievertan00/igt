import crypto from "node:crypto";

const ID = "language-g01.1-1";
const EXPECTED = "47b65efa88c625e0c012d14e7cef13b321dca200e9790c678d5456fe82ac57a1";
const RATIONALE = "The plural subject children takes the base verb play in the present simple; every day signals a repeated routine.";

export function up(db) {
  return db.transaction(() => {
    const row = db.prepare("SELECT * FROM practice_questions WHERE id = ?").get(ID);
    if (!row) throw new Error(`Practice rationale target missing: ${ID}`);
    const fields = JSON.parse(row.practice_fields_json);
    if (fields.learning_rationale?.[0] === RATIONALE) return { updated: 0 };
    const digest = crypto.createHash("sha256").update(JSON.stringify([
      row.id, row.prompt_zh, row.reference_answer, row.difficulty, row.context,
      row.practice_fields_json, row.hint_json, row.generated_by,
    ])).digest("hex");
    if (digest !== EXPECTED) throw new Error(`Practice rationale preimage conflict: ${ID}`);
    fields.learning_rationale = [RATIONALE];
    db.prepare("UPDATE practice_questions SET practice_fields_json = ? WHERE id = ?")
      .run(JSON.stringify(fields), ID);
    return { updated: 1 };
  })();
}

export function down() {
  throw new Error("Restore the verified pre-repair database backup to reverse this content repair.");
}

export default { up, down };
