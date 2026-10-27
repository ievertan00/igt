import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import configLoader from "../lib/shared/config-loader.mjs";
import { listAskNotes } from "../lib/application/ask-notes.mjs";
import { askMetadata, readAskMetadata } from "../lib/features/ask/metadata.mjs";

// One reviewed migration of the existing library, not an automatic classifier.
// Metadata was authored by the assistant from the original note bodies.
const plan = [
  ["How do I use 'would' to sound more polite.md", "礼貌请求与邀请：would 和 could / Polite requests and offers", "Conversation", ["politeness", "would", "could", "requests", "offers"]],
  ["What's the difference between 'affect' and 'effect.md", "affect 与 effect：影响和结果 / Verb and noun usage", "Vocabulary", ["word-choice", "affect", "effect", "parts-of-speech"]],
  ["在and前面什么情况需要加,，什么情况不需要加？.md", "and 前的逗号：并列句与牛津逗号 / Commas before and", "Writing", ["punctuation", "commas", "oxford-comma", "independent-clauses", "conjunctions"]],
  ["Distinguishing Conjunctions and Prepositions.md", "连词与介词：后接从句还是名词 / Conjunctions vs prepositions", "Grammar", ["conjunctions", "prepositions", "clauses", "fanboys"]],
  ["Restrictive vs. Non-Restrictive Clauses.md", "定语从句：限制性、非限制性与关系代词省略 / Relative clauses", "Grammar", ["relative-clauses", "relative-pronouns", "commas", "that-which", "who-whom"]],
  ["Distinguishing Countable vs. Uncountable Nouns.md", "可数与不可数名词：判断、量词和计量单位 / Countability", "Grammar", ["nouns", "countable-nouns", "uncountable-nouns", "quantifiers", "units"]],
  ["Joining Independent Clauses.md", "连接独立分句：分号、并列连词与逗号拼接 / Joining clauses", "Writing", ["independent-clauses", "punctuation", "semicolons", "conjunctions", "comma-splices", "run-on-sentences"]],
  ["Prepositional Nuances To, For, and Of.md", "to、for、of：功能集成、用途与所属 / Prepositions in technical contexts", "Grammar", ["prepositions", "to-for-of", "technical-writing", "purpose", "possession"]],
  ["Distinguishing Prepositions of Space and Time.md", "in、within、inside、during：位置、范围与时限 / Space and time", "Grammar", ["prepositions", "in-within-inside", "during-within", "space", "time", "boundaries"]],
  ["Comparing Other, Another, Different.md", "other、another、different：其余、再一个与不同 / Word choice", "Vocabulary", ["word-choice", "other-another-different", "determiners", "quantity"]],
  ["Comparing English Conditional Structures.md", "条件句：零、一、二、三类与混合条件句 / English conditionals", "Grammar", ["conditionals", "if-clauses", "mixed-conditionals", "hypotheticals", "tenses"]],
  ["Articles and Parallel Structure in Lists.md", "并列名词的冠词与平行结构 / Articles and parallel structure", "Grammar", ["articles", "parallel-structure", "noun-phrases", "lists", "definite-article"]],
  ["Articles with Noun Phrases.md", "并列名词短语中是否重复 a 或 the / Repeating articles", "Grammar", ["articles", "noun-phrases", "parallel-structure", "indefinite-article"]],
  ["Certainty Modifiers and Adverb Placement.md", "确定性表达与副词位置：likely、probably、definitely、bound to", "Grammar", ["adverbs", "certainty", "adverb-placement", "likely-unlikely", "probably-definitely", "bound-to"]],
  ["Choosing Prepositions Purpose, Topic, and Directio.md", "of、for、on、to、by：所属、用途、主题、方向与期限 / Prepositions", "Grammar", ["prepositions", "of-for-on-to-by", "purpose", "topic", "direction", "deadlines"]],
  ["Differentiating 'Of' vs. 'For' Prepositions.md", "of 与 for：所属和构成，还是用途和受益者 / Belonging vs purpose", "Grammar", ["prepositions", "of-for", "possession", "composition", "purpose", "duration"]],
  ["Past Habits and Adaptation Grammar.md", "used to、would、be used to、get used to：过去习惯与适应", "Grammar", ["past-habits", "used-to", "would", "be-used-to", "get-used-to", "gerunds"]],
  ["Simple Past vs Perfect Tenses.md", "一般过去时、现在完成时与过去完成时 / Past and perfect tenses", "Grammar", ["tenses", "simple-past", "present-perfect", "past-perfect", "time-markers"]],
  ["Gerund vs Infinitive Verb Patterns.md", "动名词与不定式：动词搭配和词义变化 / Gerunds vs infinitives", "Grammar", ["gerunds", "infinitives", "verb-patterns", "stop-remember-try", "meaning-changes"]],
  ["Prepositions Of, For, and To.md", "of、for、to：本质、目的与方向 / Essence, purpose and direction", "Grammar", ["prepositions", "to-for-of", "composition", "purpose", "direction"]],
];

const hash = (value) => createHash("sha256").update(value).digest("hex");
const mode = process.argv[2];
const root = process.argv[3];
if (!["prepare", "apply", "verify"].includes(mode) || !root || !path.isAbsolute(root)) throw new Error("Usage: node scripts/organize-ask-notes.mjs prepare|apply|verify ABSOLUTE_BACKUP_DIRECTORY");
const backupRoot = path.resolve(root);
const artifactRoot = path.join(process.cwd(), "artifacts");
if (!backupRoot.startsWith(artifactRoot + path.sep)) throw new Error("Backups must stay inside workspace artifacts.");
const config = configLoader.load();
const library = listAskNotes(config);
const manifestFile = path.join(backupRoot, "manifest.json");

if (mode === "prepare") {
  if (fs.existsSync(backupRoot)) throw new Error("Choose a new backup directory.");
  if (library.notes.length !== plan.length || plan.some(([id]) => !library.notes.some((note) => note.id === id))) throw new Error("Library changed; review the plan first.");
  fs.mkdirSync(path.join(backupRoot, "originals"), { recursive: true });
  fs.mkdirSync(path.join(backupRoot, "prepared"));
  const entries = plan.map(([id, title, category, tags]) => {
    const original = fs.readFileSync(path.join(library.directory, id));
    const text = original.toString("utf8");
    if (text.startsWith("---")) throw new Error(`Existing frontmatter needs review: ${id}`);
    const metadata = askMetadata({ title, category, tags });
    if (metadata.metadataSource !== "ai" || metadata.title !== title || JSON.stringify(metadata.tags) !== JSON.stringify(tags)) throw new Error(`Invalid metadata: ${id}`);
    const header = `---\ntitle: ${JSON.stringify(title)}\ntags: ${JSON.stringify(tags)}\ncategory: ${JSON.stringify(category)}\nmetadataSource: "ai"\n---\n\n`;
    const prepared = Buffer.concat([Buffer.from(header, "utf8"), original]);
    fs.writeFileSync(path.join(backupRoot, "originals", id), original, { flag: "wx" });
    fs.writeFileSync(path.join(backupRoot, "prepared", id), prepared, { flag: "wx" });
    if (!fs.readFileSync(path.join(backupRoot, "originals", id)).equals(original)) throw new Error("Backup verification failed.");
    return { id, ...metadata, beforeHash: hash(original), afterHash: hash(prepared), headerBytes: Buffer.byteLength(header) };
  });
  fs.writeFileSync(manifestFile, JSON.stringify({ directory: library.directory, createdAt: new Date().toISOString(), entries }, null, 2));
  fs.writeFileSync(path.join(backupRoot, "README.md"), "# Ask notes metadata migration\n\nOriginal filenames and body bytes are preserved. originals/ contains exact backups; prepared/ contains reviewed metadata plus unchanged originals. manifest.json records SHA-256 hashes.\n\nTo roll back, restore each file from originals/ to the same filename in the Ask directory recorded in manifest.json, after checking that the live file still matches its afterHash. Do not overwrite subsequent edits.\n");
  console.log(JSON.stringify({ prepared: entries.length, backupRoot, categories: Object.fromEntries([...new Set(entries.map((e) => e.category))].map((category) => [category, entries.filter((e) => e.category === category).length])) }, null, 2));
} else {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (path.resolve(manifest.directory) !== path.resolve(library.directory)) throw new Error("Configured Ask directory changed.");
  const currentIds = library.notes.map((note) => note.id).sort();
  if (JSON.stringify(currentIds) !== JSON.stringify(manifest.entries.map((e) => e.id).sort())) throw new Error("Library membership changed.");
  // Validate all inputs and backups before the first write.
  for (const entry of manifest.entries) {
    if (entry.id !== path.basename(entry.id)) throw new Error("Invalid filename.");
    const live = fs.readFileSync(path.join(library.directory, entry.id));
    const original = fs.readFileSync(path.join(backupRoot, "originals", entry.id));
    const prepared = fs.readFileSync(path.join(backupRoot, "prepared", entry.id));
    if (hash(original) !== entry.beforeHash || hash(prepared) !== entry.afterHash || !prepared.subarray(entry.headerBytes).equals(original)) throw new Error(`Backup or body mismatch: ${entry.id}`);
    if (hash(live) !== entry.afterHash && (mode !== "apply" || hash(live) !== entry.beforeHash)) throw new Error(`File changed: ${entry.id}`);
  }
  if (mode === "apply") for (const entry of manifest.entries) {
    const target = path.join(library.directory, entry.id);
    const live = fs.readFileSync(target);
    if (hash(live) === entry.afterHash) continue;
    if (hash(live) !== entry.beforeHash) throw new Error(`File changed during migration: ${entry.id}`);
    fs.writeFileSync(target, fs.readFileSync(path.join(backupRoot, "prepared", entry.id)));
    if (hash(fs.readFileSync(target)) !== entry.afterHash) throw new Error(`Write verification failed: ${entry.id}`);
  }
  const verified = listAskNotes(config);
  for (const entry of manifest.entries) {
    const note = verified.notes.find((n) => n.id === entry.id);
    const parsed = readAskMetadata(note.content);
    if (note.title !== entry.title || note.category !== entry.category || JSON.stringify(note.tags) !== JSON.stringify(entry.tags) || parsed.metadataSource !== "ai") throw new Error(`Reader metadata mismatch: ${entry.id}`);
    if (hash(fs.readFileSync(path.join(library.directory, entry.id))) !== entry.afterHash) throw new Error(`Final hash mismatch: ${entry.id}`);
  }
  console.log(JSON.stringify({ mode, verified: verified.notes.length, unchangedBodies: manifest.entries.length, preservedFilenames: true, backupRoot }, null, 2));
}
