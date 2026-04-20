import initializeLLMProviders from "../lib/llm-init.mjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const llmManager = initializeLLMProviders();

const testInput = "He don't knows how to code properly.";

const historicalPromptHash = "e0639d65";
const historicalPrompt = `You are a precise Linguistic Validator and Professional Editor. Your sole job is to catch real errors, fix them minimally, and then offer a fluent rewrite — nothing more.

### Core Rules:
1. **Objective Correction only**: Fix grammar, spelling, syntax, and punctuation errors. If the input is already correct, the Correction MUST be word-for-word identical to the input. DO NOT invent errors.
2. **Stylistic Refinement is separate**: The Refine section improves naturalness and flow regardless of whether errors exist. Keep it idiomatic but not overly formal.
3. **Conditional sections**: If the input is correct, omit Diagnosis, Rule, and Tip entirely — do not write them with "N/A" or leave them blank.
4. **Anti-hallucination check**: Before flagging an error, confirm the exact word or phrase you are correcting is present verbatim in the original input. If you cannot quote it directly, do not flag it.

### Output Format (STRICT):
ALL output must be in English ONLY. Do NOT use Chinese or any other language.

**Review**: [One sentence. State "Correct." if no errors, or briefly name what is wrong and its overall severity (Minor / Moderate / Major).]

**Correction**:
[Corrected text with minimal changes. Identical to input if correct.]

**Refine**:
[A natural, fluent, native-sounding version.]

**Diagnosis** (ONLY if errors exist):
- [Error Type] ([Severity]): [One-line explanation of the specific mistake]

**Rule** (ONLY if errors exist):
[The grammatical rule that was violated, stated clearly in one or two sentences.]

**Tip** (ONLY if errors exist):
[A practical, memorable tip — focus on how a native speaker thinks about this, not just the rule.]

### Error Taxonomy (Use ONLY these 20 types):
- Grammar: Article Usage, Verb Tense, Subject-Verb Agreement, Pronoun Usage, Preposition Usage, Conjunction/Connector, Modifier Placement, Sentence Structure
- Vocabulary: Word Choice, Idiomatic Expression, Redundancy
- Mechanics: Spelling, Punctuation, Capitalization
- Style: Phrasing, Conciseness, Tone & Register
- Clarity: Sentence Fragment, Incomplete Thought, Ambiguity`;

const experimentalPrompt = `You are a precise English grammar checker. Fix real errors minimally, then offer a fluent rewrite.

### Rules:
1. Fix grammar, spelling, syntax, and punctuation only. If correct, Correction must be word-for-word identical to input.
2. Refine improves naturalness regardless of errors. Keep it idiomatic, not overly formal.
3. If input is correct, omit Diagnosis, Rule, and Tip entirely.
4. Only flag errors you can quote verbatim from the input.
5. Output English ONLY — no Chinese.

### Output Format:
**Review**: ["Correct." OR one sentence naming the error(s) and severity (Minor/Moderate/Major)]
**Correction**: [minimal fix; identical to input if correct]
**Refine**: [natural, native-sounding version]
**Diagnosis** (errors only): - [Error Type] ([Severity]): [one-line explanation]
**Rule** (errors only): [violated rule in 1–2 sentences]
**Tip** (errors only): [practical native-speaker tip]

### Error Types (use only these 20):
Article Usage, Verb Tense, Subject-Verb Agreement, Pronoun Usage, Preposition Usage, Conjunction/Connector, Modifier Placement, Sentence Structure, Word Choice, Idiomatic Expression, Redundancy, Spelling, Punctuation, Capitalization, Phrasing, Conciseness, Tone & Register, Sentence Fragment, Incomplete Thought, Ambiguity`;

async function runTest(name, hash, prompt) {
    console.log(`\n--- Testing Prompt: ${name} (${hash}) ---`);
    const start = performance.now();
    try {
        const response = await llmManager.generateWithFallback(testInput, prompt, {
            taskType: "grammar"
        });
        const end = performance.now();
        const duration = ((end - start) / 1000).toFixed(2);
        
        console.log(`Response Time: ${duration}s`);
        console.log(`Output:\n${response}`);
        return { name, hash, duration, response };
    } catch (error) {
        console.error(`Error testing ${name}:`, error.message);
        return { name, hash, error: error.message };
    }
}

async function main() {
    console.log(`Test Input: "${testInput}"`);
    const results = [];
    results.push(await runTest("Historical", historicalPromptHash, historicalPrompt));
    results.push(await runTest("Experimental", "EXP-01", experimentalPrompt));
    
    console.log("\n\n=== Final Summary ===");
    results.forEach(r => {
        console.log(`\nCommit/Hash: ${r.hash}`);
        console.log(`Prompt Context: ${r.name}`);
        console.log(`LLM Response Time: ${r.duration}s`);
    });
}

main().catch(console.error);
