// Restore a deployment backup into an isolated directory and verify it.
// Usage: node scripts/deploy/restore.mjs --backup DIR --target DIR
// Never point --target at the live data directory while the service is running.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const backup = arg("backup");
const target = arg("target");
if (!backup || !target) {
  console.error("Usage: node scripts/deploy/restore.mjs --backup DIR --target DIR");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(path.join(backup, "manifest.json"), "utf8"));
fs.mkdirSync(target, { recursive: true });
for (const file of manifest.files) {
  if (file.path === "manifest.json") continue;
  const from = path.join(backup, file.path);
  const to = path.join(target, file.path);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  const digest = crypto.createHash("sha256").update(fs.readFileSync(to)).digest("hex");
  if (digest !== file.sha256) throw new Error(`Checksum mismatch after restore: ${file.path}`);
}

const db = new Database(path.join(target, "igt_data.db"), { readonly: true });
const integrity = db.prepare("PRAGMA integrity_check").get();
const questions = db.prepare("SELECT COUNT(*) n FROM practice_questions").get().n;
const cards = db.prepare("SELECT COUNT(*) n FROM srs_cards").get().n;
db.close();
if (integrity.integrity_check !== "ok") throw new Error(`Integrity check failed: ${JSON.stringify(integrity)}`);
if (questions !== manifest.questions || cards !== manifest.cards) {
  throw new Error(`Row counts differ from manifest: questions ${questions}/${manifest.questions}, cards ${cards}/${manifest.cards}`);
}
console.log(`restore ok: ${target} (integrity ok, ${questions} questions, ${cards} SRS cards, checksums verified)`);