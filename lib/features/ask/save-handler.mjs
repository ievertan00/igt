// Save handler for /ask: compacts the thread, then writes the result to the
// configured Markdown asset. SQLite is not an Ask-history store.
//
// After a successful save, the in-memory history for the session is cleared.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { compactSession } from "./compact.mjs";
import { saveToVault } from "./vault.mjs";
import * as history from "./history.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..", "..");

function resolveAskTargetDir(config) {
  if (config.AskDir) {
    return path.isAbsolute(config.AskDir)
      ? config.AskDir
      : path.join(projectRoot, config.AskDir);
  }
  
  if (config.AskFile) {
    // If AskFile is an absolute path or has no extension, treat it as the target directory itself
    if (path.isAbsolute(config.AskFile)) {
      return config.AskFile.endsWith(".md") ? path.dirname(config.AskFile) : config.AskFile;
    }
    if (!config.AskFile.endsWith(".md")) {
      return path.isAbsolute(config.AskFile) ? config.AskFile : path.join(projectRoot, config.AskFile);
    }
  }

  const file = config.AskFile || "03_Ask_Log.md";
  const baseDir = config.VaultDir
    ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
    : path.join(projectRoot, "docs");
    
  return baseDir;
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

  const targetDir = resolveAskTargetDir(config);
  const turnCount = turns.length;
  const vaultFile = saveToVault(targetDir, response);

  history.reset(sessionId);

  return { saved: true, response, consultationId: null, vaultFile, turnCount };
}
