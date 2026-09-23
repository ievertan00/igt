import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { insertVocabCard, vocabCardExistsForWord } from "../db/srs-cards.mjs";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WORD_LOOKUP_SCHEMA = { type: "object", properties: { word: { type: "string" }, pos: { type: "string" }, meaning: { type: "string" }, zh: { type: "string" }, synonyms: { type: "string" }, collocations: { type: "string" }, example: { type: "string" }, note: { type: "string" } }, required: ["word", "meaning", "zh"] };
export const WORD_LOOKUP_PROMPT = "You are a concise English vocabulary assistant. Return one JSON object with word, pos, meaning, zh, synonyms, collocations, example, and note. Normalize inflected input to its canonical dictionary form. Keep each field concise.";

function parseEntry(raw) {
  return JSON.parse(String(raw).replace(/^```json\s*/i, "").replace(/```$/g, "").trim());
}

export async function lookupWord({ query, getLLMManager }) {
  const normalized = String(query || "").trim();
  if (!normalized) throw new Error("Missing 'q' query parameter");
  const llm = await getLLMManager();
  return { entry: parseEntry(await llm.generateWithFallback(normalized, WORD_LOOKUP_PROMPT, { taskType: "grammar", jsonSchema: WORD_LOOKUP_SCHEMA })), requested: normalized };
}

function targetPath(config = {}) {
  if (config.VocabularyPath) return path.isAbsolute(config.VocabularyPath) ? config.VocabularyPath : path.join(projectRoot, config.VocabularyPath);
  const base = config.VaultDir ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir)) : path.join(projectRoot, "docs");
  return path.isAbsolute(config.VocabFile) ? config.VocabFile : path.join(base, config.VocabFile || "IGT Vocabulary.md");
}

export async function addWord({ entry, config = {} }) {
  if (!entry?.word || !entry?.zh) throw new Error("Missing vocabulary entry");
  const filePath = targetPath(config);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const escaped = String(entry.word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = fs.existsSync(filePath) && new RegExp(`^###?\\s+${escaped}\\s*$`, "im").test(fs.readFileSync(filePath, "utf8"));
  if (existing) return { persistence: { saved: false, reason: "already_exists", path: filePath } };
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "# IGT Vocabulary\n", "utf8");
  const block = `\n### ${entry.word}\n**PoS:** ${entry.pos || ""}\n**Meaning:** ${entry.meaning || ""}\n**中文:** ${entry.zh}\n**Synonyms:** ${entry.synonyms || ""}\n**Collocations:** ${entry.collocations || ""}\n**Example 1:** ${entry.example || ""}\n**Note:** ${entry.note || ""}\n*Added: ${new Date().toISOString().slice(0, 10)}*\n`;
  fs.appendFileSync(filePath, block, "utf8");
  if (!(await vocabCardExistsForWord(entry.word))) await insertVocabCard({ word: entry.word, pos: entry.pos || "", zh: entry.zh, meaning: entry.meaning || "", example: entry.example || "", note: entry.note || "" });
  return { persistence: { saved: true, path: filePath, word: entry.word } };
}
