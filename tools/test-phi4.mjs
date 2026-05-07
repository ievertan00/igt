/**
 * Phi-4 14B local performance test.
 * Requires Ollama running with phi4 pulled: `ollama pull phi4`
 * Run: node tools/test-phi4.mjs
 *
 * Validates after normalization (same pipeline as production via classifyErrorType),
 * so model aliases like "Verb Form" that map to canonical types are not false failures.
 */

import { classifyErrorType, ERROR_TYPES } from "../lib/error-types.mjs";

const OLLAMA_URL = "http://localhost:11434/v1/chat/completions";
const MODEL = "phi4";

const VALID_TYPES = new Set(Object.values(ERROR_TYPES));

const SYSTEM_PROMPT = `Act as a Linguistic Validator. Your task: Convert input to standard English with minimal edits.

### INTEGRITY RULES:
1. **Zero Silent Fixes**: Every word or character changed in 'correction' MUST have a corresponding entry in the 'diagnoses' array.
2. **Minimalism**: Fix only objective errors (Grammar, Mechanics, Lexis).
3. **Formatting**: Return raw JSON only. NO markdown blocks.

### Output JSON Structure:
{
  "review": "Summary of error density.",
  "correction": "Minimal fix version.",
  "refine": "Fluent/natural version.",
  "diagnoses": [
    { "type": "(Error Type from Taxonomy)", "severity": "Minor/Moderate/Major", "explanation": "Justification for the edit." }
  ],
  "rule": ["Grammar principle"],
  "tip": ["Natural phrasing advice"]
}

### Taxonomy:
- **Grammar**: Article Usage, Verb Tense, Subject-Verb Agreement, Pronoun Usage, Preposition Usage, Conjunction/Connector, Modifier Placement, Sentence Structure, Parallel Structure, Word Form, Comparison, Negation.
- **Vocabulary**: Word Choice, Collocation, Idiomatic Expression, Redundancy.
- **Mechanics**: Spelling, Punctuation, Capitalization, Spacing & Formatting.
- **Style**: Phrasing, Conciseness, Tone & Register, Repetition, Voice (Active/Passive).
- **Clarity**: Ambiguity, Unclear Reference, Logical Inconsistency.

CRITICAL: Use the exact Taxonomy strings for 'type'. If Correction != Input, Diagnoses cannot be empty.`;

const TEST_CASES = [
  { input: "She don't know what to do when the problem arise.", label: "SVA + Verb Tense" },
  { input: "I am very boring in this meeting.", label: "Word Form" },
  { input: "He suggested to go to the cinema.", label: "Verb Pattern" },
  { input: "The informations you provided is very helpful.", label: "Countability + SVA" },
  { input: "Despite of the rain, we decided to go out.", label: "Preposition" },
  { input: "This is a correct sentence with no errors.", label: "Clean (expect no changes)" },
];

async function check(input) {
  const start = Date.now();
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input },
      ],
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const elapsed = Date.now() - start;
  const raw = data.choices[0].message.content.trim();
  return { raw, elapsed };
}

function parseAndValidate(raw, input) {
  const issues = [];
  let parsed;

  const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

  try {
    parsed = JSON.parse(clean);
  } catch {
    issues.push("INVALID JSON");
    return { parsed: null, issues };
  }

  const required = ["review", "correction", "refine", "diagnoses", "rule", "tip"];
  for (const field of required) {
    if (!(field in parsed)) issues.push(`missing field: ${field}`);
  }

  if (parsed.correction && parsed.correction !== input) {
    if (!Array.isArray(parsed.diagnoses) || parsed.diagnoses.length === 0) {
      issues.push("INTEGRITY VIOLATION: correction differs but diagnoses is empty");
    }
  }

  if (Array.isArray(parsed.diagnoses)) {
    for (const d of parsed.diagnoses) {
      const normalized = classifyErrorType(d.type);
      if (!VALID_TYPES.has(normalized)) {
        issues.push(`unknown taxonomy type: "${d.type}" (normalized: "${normalized}")`);
      } else if (normalized !== d.type) {
        d._normalized = normalized;
      }
    }
  }

  return { parsed, issues };
}

console.log(`Testing Phi-4 14B via Ollama — ${TEST_CASES.length} cases\n${"─".repeat(60)}`);

let passed = 0;
let failed = 0;

for (const { input, label } of TEST_CASES) {
  process.stdout.write(`[${label}]\n  Input: ${input}\n  `);

  try {
    const { raw, elapsed } = await check(input);
    const { parsed, issues } = parseAndValidate(raw, input);

    if (issues.length === 0) {
      passed++;
      console.log(`OK ${elapsed}ms`);
      console.log(`  Correction : ${parsed.correction}`);
      console.log(`  Diagnoses  : ${parsed.diagnoses.map(d => d._normalized ? `${d.type}->${d._normalized} (${d.severity})` : `${d.type} (${d.severity})`).join(", ") || "none"}`);
      console.log(`  Rule       : ${parsed.rule?.[0] ?? "-"}`);
    } else {
      failed++;
      console.log(`FAIL ${elapsed}ms -- ${issues.join("; ")}`);
      if (parsed) {
        console.log(`  Correction : ${parsed.correction}`);
      } else {
        console.log(`  Raw output : ${raw.slice(0, 300)}`);
      }
    }
  } catch (err) {
    failed++;
    console.log(`ERROR -- ${err.message}`);
  }

  console.log();
}

console.log("─".repeat(60));
console.log(`Result: ${passed}/${TEST_CASES.length} passed  |  ${failed} failed`);
