import { getDb, closeAll } from "../lib/db/connection.mjs";
import { historicalSeedRows, restoreCanonicalQuestions } from "../lib/features/practice/canonical-bank.mjs";

// Historical command retained as a guarded import of the authoritative export.
const rows = historicalSeedRows("extra-1");
try {
  const inserted = restoreCanonicalQuestions(await getDb(), rows);
  console.log(`Inserted ${inserted} absent questions from ${rows.length} authoritative rows; existing content and usage were preserved.`);
} finally { closeAll(); }
