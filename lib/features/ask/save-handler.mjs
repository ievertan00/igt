// Save handler for /ask: compacts the thread, then atomically writes the result
// to BOTH the `consultations` SQLite table AND the vault markdown file.
//
// Atomicity via db.transaction(fn) — better-sqlite3 rolls back if fn throws.
// The vault append (sync fs) runs inside the txn, so a file error rolls back
// the DB insert; conversely, an INSERT error never reaches the file.
//
// After a successful save, the in-memory history for the session is cleared.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../../db/connection.mjs";
import { compactSession } from "./compact.mjs";
import { formatVaultEntry, appendToVault } from "./vault.mjs";
import * as history from "./history.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..", "..");

function resolveAskPath(config) {
  if (config.AskPath) {
    return path.isAbsolute(config.AskPath)
      ? config.AskPath
      : path.join(projectRoot, config.AskPath);
  }
  const file = config.AskFile || "03_Ask_Log.md";
  if (config.VaultDir) {
    const base = path.isAbsolute(config.VaultDir)
      ? config.VaultDir
      : path.join(projectRoot, config.VaultDir);
    return path.join(base, file);
  }
  return path.join(projectRoot, "docs", file);
}

export async function saveSession({ sessionId, llm, config }) {
  const turns = history.get(sessionId);
  if (turns.length === 0) {
    return { saved: false, response: null, consultationId: null, vaultFile: null, turnCount: 0 };
  }

  const response = await compactSession({ sessionId, llm, config });
  if (!response) {
    return { saved: false, response: null, consultationId: null, vaultFile: null, turnCount: 0 };
  }

  const md = formatVaultEntry(response);
  const askPath = resolveAskPath(config);
  const db = await getDb();
  const turnCount = turns.length;

  let consultationId = null;
  let vaultFile = null;

  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO consultations (session_id, question, response_json, turn_count)
      VALUES (?, ?, ?, ?)
    `).run(
      sessionId,
      response.question || "",
      JSON.stringify(response),
      turnCount,
    );
    consultationId = result.lastInsertRowid;
    vaultFile = appendToVault(askPath, md);
  });

  tx();

  history.reset(sessionId);

  return { saved: true, response, consultationId, vaultFile, turnCount };
}
