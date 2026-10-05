import { historicalSeedRows } from "./canonical-bank.mjs";

// Compatibility view for migration 037; preserve authoritative JSON and IDs.
export const SCHEMA_NATIVE_PRACTICE_QUESTIONS = historicalSeedRows("native")
  .map(row => ({ ...row, served_count: 0 }));
