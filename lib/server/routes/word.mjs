import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { insertVocabCard, vocabCardExistsForWord } from "../../db/srs-cards.mjs";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const schema = { type: "object", properties: { word: { type: "string" }, pos: { type: "string" }, meaning: { type: "string" }, zh: { type: "string" }, synonyms: { type: "string" }, collocations: { type: "string" }, example: { type: "string" }, note: { type: "string" } }, required: ["word", "meaning", "zh"] };
const prompt = "You are a concise English vocabulary assistant. Return one JSON object with word, pos, meaning, zh, synonyms, collocations, example, and note. Normalize inflected input to its canonical dictionary form. Keep each field concise.";

function json(res, status, value) { res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); res.end(JSON.stringify(value)); }
function targetPath(config) { const base = config.VaultDir ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir)) : path.join(projectRoot, "docs"); return path.isAbsolute(config.VocabFile) ? config.VocabFile : path.join(base, config.VocabFile || "IGT Vocabulary.md"); }

export function registerWordRoutes({ getLLMManager }) {
  register("GET", (url) => url.startsWith("/word/lookup"), async (req, res) => {
    const query = new URL(req.url, "http://127.0.0.1").searchParams.get("q")?.trim();
    if (!query) return json(res, 400, { error: "Missing 'q' query parameter" });
    const llm = await getLLMManager();
    const raw = await llm.generateWithFallback(query, prompt, { taskType: "grammar", jsonSchema: schema });
    let entry;
    try { entry = JSON.parse(String(raw).replace(/^```json\s*/i, "").replace(/```$/g, "").trim()); } catch { return json(res, 502, { error: "Vocabulary provider returned invalid JSON" }); }
    json(res, 200, { data: { ...entry, requested: query }, persistence: { saved: false } });
  });

  register("POST", "/word/add", async (req, res, { body }) => {
    const entry = body?.entry;
    if (!entry?.word || !entry?.zh) return json(res, 400, { error: "Missing vocabulary entry" });
    const config = configLoader.load(); const filePath = targetPath(config); fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const existing = fs.existsSync(filePath) && new RegExp(`^###?\\s+${String(entry.word).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*$`, "im").test(fs.readFileSync(filePath, "utf8"));
    if (existing) return json(res, 200, { persistence: { saved: false, reason: "already_exists", path: filePath } });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, "# IGT Vocabulary\n", "utf8");
    const block = `\n### ${entry.word}\n**PoS:** ${entry.pos || ""}\n**Meaning:** ${entry.meaning || ""}\n**中文:** ${entry.zh}\n**Synonyms:** ${entry.synonyms || ""}\n**Collocations:** ${entry.collocations || ""}\n**Example 1:** ${entry.example || ""}\n**Note:** ${entry.note || ""}\n*Added: ${new Date().toISOString().slice(0, 10)}*\n`;
    fs.appendFileSync(filePath, block, "utf8");
    if (!(await vocabCardExistsForWord(entry.word))) await insertVocabCard({ word: entry.word, pos: entry.pos || "", zh: entry.zh, meaning: entry.meaning || "", example: entry.example || "", note: entry.note || "" });
    json(res, 200, { persistence: { saved: true, path: filePath, word: entry.word } });
  });
}
