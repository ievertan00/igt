import Database from "better-sqlite3";
import { readFileSync } from "fs";

const db = new Database("C:/Users/Evertan/.igt/igt_data.db");
const d = JSON.parse(readFileSync("C:/Users/Evertan/.igt/artifacts/fill-questions-1.json", "utf-8"));
const first = Object.values(d)[0];

const existing = db.prepare("SELECT COUNT(*) as cnt FROM practice_questions WHERE prompt_zh = ?").get(first.prompt_zh);
console.log("Prompt:", first.prompt_zh.slice(0, 60));
console.log("Matches in DB:", existing.cnt);

const all = db.prepare("SELECT prompt_zh FROM practice_questions").all();
const set = new Set(all.map(r => r.prompt_zh));
console.log("Set has it:", set.has(first.prompt_zh));
console.log("Total DB prompts:", all.length, "Set size:", set.size);

db.close();