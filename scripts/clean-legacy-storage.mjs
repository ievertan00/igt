import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import configLoader from "../lib/shared/config-loader.mjs";
import { getDb, closeAll } from "../lib/db/connection.mjs";

const LEGACY_TABLES = [
  "advice",
  "diagnoses",
  "assessments",
  "consultations",
  "practice_attempts",
  "inputs",
  "sessions",
];

function tableExists(db, table) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(table));
}

export function inspectLegacyStorage(db) {
  const tables = LEGACY_TABLES
    .filter((table) => tableExists(db, table))
    .map((table) => ({ table, rows: db.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count }));
  const grammarCards = tableExists(db, "srs_cards")
    ? db.prepare("SELECT COUNT(*) AS count FROM srs_cards WHERE source_type = 'input'").get().count
    : 0;
  const vocabularyCards = tableExists(db, "srs_cards")
    ? db.prepare("SELECT COUNT(*) AS count FROM srs_cards WHERE source_type = 'vocab'").get().count
    : 0;
  return { tables, grammarCards, vocabularyCards };
}

export function cleanLegacyStorage(db, { apply = false } = {}) {
  const before = inspectLegacyStorage(db);
  if (!apply) return { applied: false, before, after: before };

  const transaction = db.transaction(() => {
    if (tableExists(db, "srs_cards")) {
      db.prepare("DELETE FROM srs_cards WHERE source_type = 'input'").run();
    }
    for (const table of LEGACY_TABLES) {
      if (tableExists(db, table)) db.exec(`DROP TABLE "${table}"`);
    }
  });
  transaction();
  return { applied: true, before, after: inspectLegacyStorage(db) };
}

function printReport(report, dbPath) {
  console.log(`${report.applied ? "Applied" : "Dry-run"} legacy storage cleanup`);
  console.log(`Database: ${dbPath}`);
  for (const row of report.before.tables) console.log(`  ${row.table}: ${row.rows} rows`);
  console.log(`  grammar SRS cards: ${report.before.grammarCards}`);
  console.log(`  vocabulary SRS cards: ${report.before.vocabularyCards}`);
  if (!report.applied) {
    console.log("No changes made. Re-run with --apply to delete these records and tables.");
    return;
  }
  console.log("After cleanup:");
  console.log(`  remaining grammar SRS cards: ${report.after.grammarCards}`);
  console.log(`  remaining vocabulary SRS cards: ${report.after.vocabularyCards}`);
  console.log(`  remaining legacy tables: ${report.after.tables.length}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const config = configLoader.load();
  const dbPath = config.DbPath || "igt_data.db";
  const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(path.dirname(fileURLToPath(import.meta.url)), "..", dbPath);
  if (!fs.existsSync(resolvedDbPath)) {
    console.error(`Database not found: ${resolvedDbPath}`);
    process.exitCode = 1;
  } else {
    const db = await getDb();
    try {
      printReport(cleanLegacyStorage(db, { apply: process.argv.includes("--apply") }), resolvedDbPath);
    } finally {
      closeAll();
    }
  }
}
