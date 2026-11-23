#!/usr/bin/env node
// Freeze the CURRENT live learning evidence (saved Grammar checks + Practice
// log) into a local Coach A/B fixture. Read-only against the real data; the
// snapshot file stays gitignored because it contains personal learning records.
// Re-run whenever you want the benchmark to reflect newer learning history.
import fs from "node:fs";
import path from "node:path";
import { loadCoachReportData } from "../../lib/application/coach-sources.mjs";
import { CASES_DIR } from "./lib/variants.mjs";

const args = process.argv.slice(2);
const id = args.includes("--id") ? args[args.indexOf("--id") + 1] : `live-${new Date().toISOString().slice(0, 10)}`;
const language = args.includes("--language") ? args[args.indexOf("--language") + 1] : "zh-CN";

const loaded = loadCoachReportData(0);
if (!loaded.entries.length) {
  console.error("No saved Grammar checks or Practice records found — nothing to snapshot.");
  process.exit(1);
}
const fixture = {
  id,
  label: `Live learning evidence snapshot (${loaded.entries.length} records)`,
  capturedAt: new Date().toISOString(),
  language,
  days: 0,
  sourceStatus: loaded.sourceStatus,
  entries: loaded.entries,
};
const dir = path.join(CASES_DIR, "coach");
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${id}.json`);
fs.writeFileSync(file, JSON.stringify(fixture, null, 2));
console.log(`Snapshot written: ${file}`);
console.log(`Records: ${loaded.entries.length} (grammar: ${loaded.sourceStatus.grammar}, practice: ${loaded.sourceStatus.practice})`);
console.log("This file contains personal learning data and is gitignored. Do not commit or share it.");