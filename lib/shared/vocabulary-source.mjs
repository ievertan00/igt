import fs from "node:fs";
import path from "node:path";

const projectRoot = path.join(import.meta.dirname, "..", "..");

export function resolveVocabularyPath(config = {}) {
  if (config.VocabularyPath) return path.isAbsolute(config.VocabularyPath) ? config.VocabularyPath : path.join(projectRoot, config.VocabularyPath);
  const base = config.VaultDir
    ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
    : path.join(projectRoot, "docs");
  const file = config.VocabFile || "IGT Vocabulary.md";
  return path.isAbsolute(file) ? file : path.join(base, file);
}

export function findVocabularyBlock(word, config = {}) {
  const file = resolveVocabularyPath(config);
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const target = String(word).trim().toLowerCase();
  const start = lines.findIndex(line => line.match(/^###?\s+(.+)/)?.[1].trim().toLowerCase() === target);
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !/^###?\s+/.test(lines[end])) end++;
  return lines.slice(start, end).join("\n");
}

export function readSavedVocabularyEntry(word, config = {}) {
  const block = findVocabularyBlock(word, config);
  if (!block) return null;
  return parseSavedVocabularyBlock(block);
}

export function parseSavedVocabularyBlock(block) {
  const field = (key) => block.match(new RegExp(`^\\*\\*${key}:\\*\\*[^\\S\\r\\n]*(.*)$`, "m"))?.[1]?.trim() || "";
  const [pos, ...phonetic] = field("PoS").split(" · ");
  return {
    word: block.match(/^###?\s+(.+)/)?.[1].trim(), pos, phonetic: phonetic.join(" · "),
    meaning: field("Meaning"), zh: field("中文"), synonyms: field("Synonyms"), collocations: field("Collocations"),
    example: field("Example 1") || field("Example"), example2: field("Example 2"), example3: field("Example 3"),
    note: field("Note"), memory: field("Memory"),
    added: block.match(/^\*Added:[^\S\r\n]*(\d{4}-\d{2}-\d{2})\*[^\S\r\n]*$/m)?.[1] || null,
  };
}
