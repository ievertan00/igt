import { restoreCanonicalQuestions } from "../lib/features/practice/canonical-bank.mjs";

// Seed the authoritative question bank from its versioned export. Existing live
// content and usage counters win; conflicting edits abort instead of overwriting.
export function up(db) {
  return restoreCanonicalQuestions(db);
}