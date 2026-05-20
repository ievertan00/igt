import { colors, paint } from "../ui.mjs";
import { cols } from "./render.mjs";

export function showHelp() {
  const sep = "─".repeat(Math.min(54, Math.max(30, cols() - 3)));
  const row = (c, d) => process.stdout.write(`${paint(colors.cyan, c)}${paint(colors.gray, d)}\n`);
  process.stdout.write(`\n  ${paint(colors.yellow, "Commands")}\n  ${paint(colors.gray, sep)}\n`);
  row("/handbook  (/h)   ", "Generate your personal error handbook");
  row("/practice  (/p)   ", "Targeted grammar exercises (CEFR-aware)");
  row('/practice --type "T"', 'Practice a specific error type (e.g. "Verb Tense")');
  row("/practice B2 10   ", "Shorthand for --level=B2 --count=10");
  row("/assess    (/as)  ", "Estimate your CEFR proficiency level");
  row("/add <w,…> (/a)   ", "Add one or more words (comma-separated) to your vocabulary note");
  row("/word      (/w)   ", "SRS Word: Master your saved vocabulary");
  row("/review    (/r)   ", "SRS Review: Drill your grammar mistakes");
  row("/stats     (/st)  ", "Analytics dashboard: errors by hour, length, mastery");
  row("/today            ", "Adaptive daily plan: SRS + practice focus area");
  row("/retry            ", "Re-run the last input with the same model");
  row("/undo [N]  (/u)   ", "Delete the last N inputs and their diagnoses/cards (default 1)");
  row("/gemini           ", "Switch to Gemini model");
  row("/qwen             ", "Switch to Qwen model");
  row("/deepseek         ", "Switch to Deepseek model");
  row("/ollama           ", "Switch to default Ollama model");
  row("/phi              ", "Switch to local Phi-4 (Ollama)");
  row("/gemma            ", "Switch to local Gemma 4 (Ollama)");
  row("/theme            ", "Switch UI color themes (Auto, Dark, Light, etc.)");
  row("/exit      (/q)   ", "Quit IGT");
  process.stdout.write("\n");
}
