// Save handler for /ask: compacts the thread, then writes the result to the
// configured Markdown asset. SQLite is not an Ask-history store.
//
// After a successful save, the in-memory history for the session is cleared.

import { validateAskLanguage } from "./language.mjs";
import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { compactTurns } from "./compact.mjs";
import { saveToVault } from "./vault.mjs";
import * as history from "./history.mjs";
import { askMetadata, readAskMetadata, ensureChineseAskTitle } from "./metadata.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..", "..");
const pending = new Map();

export function resolveAskTargetDir(config) {
  if (config.AskPath) {
    const value = path.isAbsolute(config.AskPath) ? config.AskPath : path.join(projectRoot, config.AskPath);
    return /\.md$/i.test(value) ? path.dirname(value) : value;
  }
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

  const baseDir = config.VaultDir
    ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
    : path.join(projectRoot, "docs");
    
  return baseDir;
}

export async function saveSession({ sessionId, llm, getLLMManager, config, language }) {
  const turns = history.get(sessionId);
  const result = await saveAskTurns({ turns, llm, getLLMManager, config, language });
  if (result.saved) history.reset(sessionId);
  return result;
}

// Both clients save a single answer unchanged or summarize a multi-turn thread.
// Content identity survives a lost HTTP response and prevents another LLM call.
export async function saveAskTurns({ turns = [], llm, getLLMManager, config, language }) {
  validateAskLanguage(language);
  if (!turns.length) return { saved: false, response: null, vaultFile: null, turnCount: 0 };
  if (turns.some((turn) => !turn || typeof turn.question !== "string" || typeof turn.answer !== "string" || !turn.answer.trim())) {
    throw Object.assign(new Error("Only answered questions can be saved."), { status: 400, code: "INVALID_REQUEST" });
  }
  const targetDir = resolveAskTargetDir(config);
  const saveId = createHash("sha256").update(JSON.stringify(turns.map(({ question, answer }) => ({ question, answer }))) + (turns.length > 1 && language ? `\0${language}` : "")).digest("hex");
  const marker = `<!-- igt-ask-save:${saveId} -->`;
  const existing = fs.existsSync(targetDir) && fs.readdirSync(targetDir, { withFileTypes: true }).find((entry) => {
    if (!entry.isFile() || !/\.md$/i.test(entry.name)) return false;
    const file = path.join(targetDir, entry.name);
    return fs.lstatSync(file).size <= 1024 * 1024 && fs.readFileSync(file, "utf8").includes(marker);
  });
  if (existing) {
    const { body, ...metadata } = readAskMetadata(fs.readFileSync(path.join(targetDir, existing.name), "utf8"));
    return { saved: true, response: null, metadata, vaultFile: existing.name, turnCount: turns.length };
  }
  const key = `${targetDir}\0${saveId}`;
  if (pending.has(key)) return pending.get(key);
  const work = (async () => {
    const manager = turns.length > 1 ? llm || await getLLMManager?.() : null;
    const normalized = turns.map((turn) => ({ ...turn, response: turn.response || {
      question: turn.question, title: turn.title || "", answer: turn.answer, related: turn.related || [], tags: turn.tags, category: turn.category,
    } }));
    const response = await compactTurns({ turns: normalized, llm: manager, config, language });
    if (!response?.answer?.trim()) throw new Error("There is no answer to save.");
    const title = await ensureChineseAskTitle({ response, llm: manager || llm, getLLMManager });
    const metadata = askMetadata({ ...response, title });
    const enriched = { ...response, ...metadata };
    const vaultFile = saveToVault(targetDir, enriched, { preserveExisting: true, saveId });
    return { saved: true, response: enriched, metadata, vaultFile, turnCount: turns.length };
  })();
  pending.set(key, work);
  try { return await work; } finally { pending.delete(key); }
}
