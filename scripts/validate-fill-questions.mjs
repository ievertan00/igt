// Validates and merges agent-generated practice questions

import { readFileSync, writeFileSync } from "fs";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const artifactsDir = path.resolve(__dirname, "..", "artifacts");
const dbPath = path.resolve(__dirname, "..", "igt_data.db");

const FILES = [
  "fill-questions-1.json",
  "fill-053-batch.json",
  "depth-questions.json",
];

const REQUIRED_FIELDS = [
  "prompt_zh", "reference_answer", "difficulty", "context", "register",
  "grammar_point", "hint_json", "primary_target", "learning_goal", "learning_rationale",
];

const VALID_CONTEXTS = new Set([
  "work", "home", "travel", "shopping",
  "dining", "health", "social", "transit",
  "entertainment", "services",
]);

const VALID_REGISTERS = new Set(["informal", "neutral", "formal"]);
const VALID_DIFFICULTIES = new Set(["easy", "standard", "challenge"]);

const db = new Database(dbPath);

function validateQuestion(id, q) {
  const errors = [];
  
  // Required fields
  for (const f of REQUIRED_FIELDS) {
    if (q[f] === undefined || q[f] === null) errors.push(`missing ${f}`);
  }
  if (errors.length > 0) return errors;
  
  // Type checks
  if (typeof q.prompt_zh !== "string" || q.prompt_zh.length < 3) errors.push("prompt_zh too short");
  if (typeof q.reference_answer !== "string" || q.reference_answer.length < 3) errors.push("reference_answer too short");
  if (!VALID_DIFFICULTIES.has(q.difficulty)) errors.push(`invalid difficulty: ${q.difficulty}`);
  if (!VALID_CONTEXTS.has(q.context)) errors.push(`invalid context: ${q.context}`);
  if (!VALID_REGISTERS.has(q.register)) errors.push(`invalid register: ${q.register}`);
  if (!Array.isArray(q.grammar_point) || q.grammar_point.length === 0) errors.push("grammar_point must be non-empty array");
  if (!q.hint_json || !q.hint_json.simple || !q.hint_json.intermediate || !q.hint_json.complete)
    errors.push("hint_json must have simple/intermediate/complete");
  
  // Hint must not contain the full answer
  if (q.hint_json?.complete && q.reference_answer) {
    const complete = q.hint_json.complete;
    if (complete === q.reference_answer) errors.push("complete hint equals reference_answer");
    if (complete.length > 30 && q.reference_answer.includes(complete)) errors.push("complete hint is substring of reference_answer");
  }
  
  // Hint must not contain grammar terms
  const grammarTerms = /\b(present perfect|past simple|modal passive|subjunctive|conditional|gerund|infinitive|participle|auxiliary|clause)\b/i;
  if (grammarTerms.test(q.hint_json?.simple || "")) errors.push("simple hint contains grammar term");
  
  // Chinese prompt should contain Chinese
  if (!/[\u4e00-\u9fff]/.test(q.prompt_zh)) errors.push("prompt_zh has no Chinese characters");
  
  // English answer should not contain Chinese
  if (/[\u4e00-\u9fff]/.test(q.reference_answer)) errors.push("reference_answer contains Chinese");
  
  return errors;
}

function main() {
  const allQuestions = {};
  const issues = {};
  
  for (const file of FILES) {
    try {
      const data = JSON.parse(readFileSync(path.resolve(artifactsDir, file), "utf-8"));
      for (const [id, q] of Object.entries(data)) {
        const errs = validateQuestion(id, q);
        if (errs.length > 0) {
          issues[id] = { file, errors: errs };
        } else {
          allQuestions[id] = q;
        }
      }
      console.log(`${file}: ${Object.keys(data).length} questions, ${Object.keys(data).filter(k => issues[k]).length} with issues`);
    } catch (e) {
      console.error(`Failed to parse ${file}: ${e.message}`);
    }
  }
  
  // Check for duplicate prompts against existing database
  const existingPrompts = new Set(
    db.prepare("SELECT prompt_zh FROM practice_questions").all().map(r => r.prompt_zh)
  );
  
  const duplicates = [];
  for (const [id, q] of Object.entries(allQuestions)) {
    if (existingPrompts.has(q.prompt_zh)) {
      duplicates.push(id);
    }
  }
  console.log(`\nDuplicate prompts with existing DB: ${duplicates.length}`);
  if (duplicates.length > 0) console.log("  IDs:", duplicates.join(", "));
  
  // Check for internal duplicates
  const prompts = new Map();
  for (const [id, q] of Object.entries(allQuestions)) {
    const exist = prompts.get(q.prompt_zh);
    if (exist) console.log(`Internal duplicate: ${id} and ${exist} share "${q.prompt_zh.slice(0, 30)}..."`);
    prompts.set(q.prompt_zh, id);
  }
  
  // Remove duplicates
  for (const id of duplicates) delete allQuestions[id];
  
  // Count empty filter cells covered
  const cells = {};
  for (const [id, q] of Object.entries(allQuestions)) {
    const key = `${q.difficulty}|${q.register}|${q.context}`;
    cells[key] = (cells[key] || 0) + 1;
  }
  
  // Check against known empty cells
  const emptyCells = [
    "challenge|formal|services", "challenge|formal|entertainment",
    "challenge|formal|transit", "challenge|formal|home",
    "challenge|formal|dining", "challenge|formal|health",
    "challenge|informal|shopping", "challenge|informal|health",
    "challenge|neutral|dining", "challenge|neutral|health",
    "easy|formal|entertainment", "easy|formal|transit",
    "easy|formal|social", "easy|formal|dining",
    "easy|formal|shopping", "easy|formal|health",
    "easy|informal|services", "easy|informal|entertainment",
    "standard|formal|dining", "standard|formal|health",
    "standard|informal|services", "standard|informal|transit",
    "standard|informal|shopping", "standard|informal|health",
  ];
  
  console.log("\nEmpty cell coverage:");
  let uncovered = 0;
  for (const cell of emptyCells) {
    const count = cells[cell] || 0;
    console.log(`  ${cell}: ${count} question(s)${count === 0 ? " ❌" : " ✅"}`);
    if (count === 0) uncovered++;
  }
  
  console.log(`\nTotal valid questions: ${Object.keys(allQuestions).length}`);
  console.log(`Issues found: ${Object.keys(issues).length}`);
  console.log(`Empty cells still uncovered: ${uncovered}`);
  
  // Write merged output
  writeFileSync(
    path.resolve(artifactsDir, "fill-merged.json"),
    JSON.stringify(allQuestions, null, 2)
  );
  
  if (Object.keys(issues).length > 0) {
    writeFileSync(
      path.resolve(artifactsDir, "fill-issues.json"),
      JSON.stringify(issues, null, 2)
    );
  }
  
  db.close();
}

main();