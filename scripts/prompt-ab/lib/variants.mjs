import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import configLoader from "../../../lib/shared/config-loader.mjs";
import { SYSTEM as COACH_SYSTEM } from "../../../lib/application/coach-report.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const AB_ROOT = path.join(here, "..");
export const PROJECT_ROOT = path.join(AB_ROOT, "..", "..");
export const VARIANTS_DIR = path.join(AB_ROOT, "variants");
export const CASES_DIR = path.join(AB_ROOT, "cases");
export const RUNS_DIR = path.join(PROJECT_ROOT, "prompt-ab-runs");

export const TARGETS = ["grammar", "ask", "coach"];
const PRIMARY_PART = { grammar: "system", ask: "ask", coach: "system" };
const OPTIONAL_PARTS = { grammar: ["inputScope"], ask: [], coach: [] };

const sha = text => createHash("sha256").update(text).digest("hex").slice(0, 16);

function readGrammarBaselineSystem(config) {
  const inline = config.Prompts?.SystemPrompt;
  if (inline) return inline;
  let p = config.SystemPromptPath || "system_prompt.txt";
  if (!path.isAbsolute(p)) p = path.join(PROJECT_ROOT, p);
  return fs.readFileSync(p, "utf8");
}

export function baselineVariant(target, config = configLoader.load()) {
  let parts;
  if (target === "grammar") parts = { system: readGrammarBaselineSystem(config) };
  else if (target === "ask") {
    const template = config.Prompts?.AskPrompt;
    if (!template) throw new Error("Prompts.AskPrompt missing from config; cannot build the Ask baseline.");
    parts = { ask: template };
  } else if (target === "coach") parts = { system: COACH_SYSTEM };
  else throw new Error(`Unknown target: ${target}`);
  return {
    name: "baseline",
    description: "Current production prompt, loaded live from config/source",
    parts,
    hashes: Object.fromEntries(Object.entries(parts).map(([key, value]) => [key, sha(value)])),
  };
}

export function loadVariant(target, name, config = configLoader.load()) {
  if (!TARGETS.includes(target)) throw new Error(`Unknown target: ${target}`);
  if (name === "baseline") return baselineVariant(target, config);
  const dir = path.join(VARIANTS_DIR, target, name);
  if (!fs.existsSync(dir)) throw new Error(`Variant not found: ${dir}`);
  const metaPath = path.join(dir, "meta.json");
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};
  const parts = {};
  for (const part of [PRIMARY_PART[target], ...OPTIONAL_PARTS[target]]) {
    const file = path.join(dir, `${part}.txt`);
    if (fs.existsSync(file)) parts[part] = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").trim();
  }
  if (!parts[PRIMARY_PART[target]]) {
    throw new Error(`Variant "${name}" for ${target} must provide ${PRIMARY_PART[target]}.txt`);
  }
  return {
    name,
    description: meta.description || "",
    parts,
    hashes: Object.fromEntries(Object.entries(parts).map(([key, value]) => [key, sha(value)])),
  };
}

export function listVariants(target) {
  const dir = path.join(VARIANTS_DIR, target);
  const names = fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name)
    : [];
  return ["baseline", ...names.sort()];
}