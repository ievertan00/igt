import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb, closeAll } from "../lib/db/connection.mjs";

// Explicit authoring operation: read the configured authority, write only JSON.
if (!process.argv.includes("--export")) throw new Error("Use --export to replace the versioned Practice content export from the authoritative database.");
const db = await getDb({ readonly: true });
try {
  const questions = db.prepare(`SELECT id, prompt_zh, reference_answer, difficulty, context,
    practice_fields_json, hint_json, generated_by, active FROM practice_questions ORDER BY id`).all();
  const exportPath = path.join(import.meta.dirname, "..", "lib", "features", "practice", "canonical-questions.json");
  const data = { version: 1, captured_at: new Date().toISOString(), content_sha256: crypto.createHash("sha256").update(JSON.stringify(questions)).digest("hex"), questions };
  fs.writeFileSync(exportPath, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`Exported ${questions.length} authoritative Practice questions; runtime counters and attempts were not exported or modified.`);
} finally { closeAll(); }
