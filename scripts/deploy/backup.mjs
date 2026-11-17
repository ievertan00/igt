// Consistent deployment backup: SQLite Backup API + Markdown vault + config.
// Usage: node scripts/deploy/backup.mjs --dest DIR [--mirror DIR]
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { ConfigLoader } from "../../lib/shared/config-loader.mjs";

const projectRoot = path.join(import.meta.dirname, "..", "..");

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

const dest = arg("dest");
if (!dest) {
  console.error("Usage: node scripts/deploy/backup.mjs --dest DIR [--mirror DIR]");
  process.exit(1);
}

const config = new ConfigLoader(projectRoot).load();
const dbPath = path.isAbsolute(config.DbPath) ? config.DbPath : path.join(projectRoot, config.DbPath);
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = path.join(dest, stamp);
fs.mkdirSync(target, { recursive: true });

const source = new Database(dbPath, { readonly: true });
await source.backup(path.join(target, "igt_data.db"));
const questions = source.prepare("SELECT COUNT(*) n FROM practice_questions").get().n;
const cards = source.prepare("SELECT COUNT(*) n FROM srs_cards").get().n;
source.close();

const vaultDir = config.VaultDir;
if (vaultDir && fs.existsSync(vaultDir)) {
  fs.cpSync(vaultDir, path.join(target, "vault"), { recursive: true });
}
for (const file of [".env", "igt_config.json"]) {
  const full = path.join(projectRoot, file);
  if (fs.existsSync(full)) fs.copyFileSync(full, path.join(target, file));
}

const files = listFiles(target).map((file) => ({
  path: path.relative(target, file).replaceAll("\\", "/"),
  size: fs.statSync(file).size,
  sha256: sha256(file),
}));
const manifest = { createdAt: new Date().toISOString(), sourceDb: dbPath, vaultDir, questions, cards, files };
fs.writeFileSync(path.join(target, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`backup ok: ${target} (${questions} questions, ${cards} SRS cards, ${files.length} files)`);

const mirror = arg("mirror");
if (mirror) {
  fs.cpSync(target, path.join(mirror, stamp), { recursive: true });
  console.log(`mirrored to ${path.join(mirror, stamp)}`);
}

// Retention: 14 most recent dailies plus 8 weekly (Sunday) snapshots.
const entries = fs.readdirSync(dest, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(e.name))
  .map((e) => e.name)
  .sort();
const keep = new Set(entries.slice(-14));
const sundays = entries.filter((name) => new Date(name.slice(0, 10) + "T00:00:00Z").getUTCDay() === 0);
for (const name of sundays.slice(-8)) keep.add(name);
for (const name of entries) {
  if (!keep.has(name)) {
    fs.rmSync(path.join(dest, name), { recursive: true, force: true });
    console.log(`pruned ${name}`);
  }
}