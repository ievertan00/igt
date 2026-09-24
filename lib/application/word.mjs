import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { insertVocabCard, vocabCardExistsForWord } from "../db/srs-cards.mjs";
import { beijingDate } from "../shared/timezone.mjs";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const WORD_LOOKUP_SCHEMA = { type: "object", properties: { word: { type: "string" }, pos: { type: "string" }, phonetic: { type: "string" }, meaning: { type: "string" }, zh: { type: "string" }, synonyms: { type: "string" }, collocations: { type: "string" }, example: { type: "string" }, example2: { type: "string" }, example3: { type: "string" }, note: { type: "string" } }, required: ["word", "pos", "phonetic", "meaning", "zh", "synonyms", "collocations", "example", "example2", "example3", "note"] };
export const WORD_LOOKUP_PROMPT = "You are an English vocabulary dictionary. Return one JSON object with word (canonical dictionary form), pos, phonetic (IPA), meaning (clear English definition), zh (natural Chinese meaning), synonyms (five useful synonyms or near-synonyms, comma-separated), collocations (three natural collocations, separated by semicolons), example (one natural example sentence), example2 (a distinct example sentence), example3 (a distinct example sentence), and note (one concise usage note). Populate every field. Keep definitions and examples accurate and concise.";

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
  const block = `\n### ${entry.word}\n**PoS:** ${entry.pos || ""} · ${entry.phonetic || ""}\n**Meaning:** ${entry.meaning || ""}\n**中文:** ${entry.zh}\n**Synonyms:** ${entry.synonyms || ""}\n**Collocations:** ${entry.collocations || ""}\n**Example 1:** ${entry.example || ""}\n**Example 2:** ${entry.example2 || ""}\n**Example 3:** ${entry.example3 || ""}\n**Note:** ${entry.note || ""}\n*Added: ${beijingDate()}*\n`;
  fs.appendFileSync(filePath, block, "utf8");
  if (!(await vocabCardExistsForWord(entry.word))) await insertVocabCard({ word: entry.word, pos: entry.pos || "", zh: entry.zh, meaning: entry.meaning || "", example: entry.example || "", note: entry.note || "", vocabDetails: { phonetic: entry.phonetic || "", synonyms: entry.synonyms || "", collocations: entry.collocations || "", examples: [entry.example, entry.example2, entry.example3].filter(Boolean), note: entry.note || "" } });
  return { persistence: { saved: true, path: filePath, word: entry.word } };
}
