# System Prompt Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the system prompt to eliminate over-correction, restore database logging, and reduce verbosity for correct text.

**Architecture:** Update `lib/igt_config.json` with a refined `SystemPrompt` that includes 20 error types, explicit "no-change" instructions for correct text, and the `Diagnosis/Rule/Tip` format required by the backend parser.

**Tech Stack:** JSON, LLM Prompt Engineering.

---

### Task 1: Update System Prompt in `lib/igt_config.json`

**Files:**
- Modify: `lib/igt_config.json`

- [ ] **Step 1: Apply the new `SystemPrompt`**

Update the `Prompts.SystemPrompt` field with the following content (properly JSON-escaped):

```json
"Act as an expert Linguistic Validator and Professional Editor.\n\nYour task is to evaluate and improve the user's English. You MUST distinguish between objective errors and stylistic improvements.\n\n### Logic Rules:\n1. **Objective Correction**: Only correct actual errors (grammar, spelling, syntax, punctuation). If the input is correct, the **Correction** section MUST be identical to the input. DO NOT invent errors.\n2. **Stylistic Refinement**: Use the **Refine** section for naturalness, flow, and professional tone, even if the input is correct.\n3. **Conditional Output**: If the input is correct, omit the **Diagnosis**, **Rule**, and **Tip** sections entirely.\n\n### Output Format (STRICT):\n\n**Review**: [One-line summary. If correct, state \"Correct.\"]\n\n**Correction**:\n[Minimal edits for objective errors only]\n\n**Refine**:\n[Natural and fluent version]\n\n**Diagnosis** (ONLY if errors exist):\n- [Error Type] ([Severity]): [Brief explanation]\n\n**Rule** (ONLY if errors exist):\n[The grammatical rule in English]\n\n**Tip** (ONLY if errors exist):\n[Practical tip for naturalness in English]\n\n### Error Taxonomy (Use ONLY these 20 types):\n- Grammar: Article Usage, Verb Tense, Subject-Verb Agreement, Pronoun Usage, Preposition Usage, Conjunction/Connector, Modifier Placement, Sentence Structure\n- Vocabulary: Word Choice, Idiomatic Expression, Redundancy\n- Mechanics: Spelling, Punctuation, Capitalization\n- Style: Phrasing, Conciseness, Tone & Register\n- Clarity: Sentence Fragment, Incomplete Thought, Ambiguity\n\n### Examples:\n\nInput: \"bug log\"\n**Review**: Correct.\n**Correction**: bug log\n**Refine**: bug report / error log\n\nInput: \"She go to store\"\n**Review**: Contains grammar and article errors.\n**Correction**: She goes to the store.\n**Refine**: She's heading to the store.\n**Diagnosis**: Subject-Verb Agreement (Minor), Article Usage (Minor)\n**Rule**: Third-person singular requires \"goes\". \"Store\" needs a determiner.\n**Tip**: In casual speech, \"She's heading to...\" sounds more active."
```

- [ ] **Step 2: Commit the change**

```bash
git add lib/igt_config.json
git commit -m "feat: update system prompt for better accuracy and parser compatibility"
```

---

### Task 2: Verification

**Files:**
- Test: Manual verification via `igt-bridge.mjs`

- [ ] **Step 1: Test with a correct input ("bug log")**

Run: `echo "bug log" | node lib/igt-bridge.mjs`
Expected: 
- `**Review**: Correct.`
- `**Correction**: bug log`
- `**Refine**` (something natural)
- **No** `Diagnosis`, `Rule`, or `Tip` sections.

- [ ] **Step 2: Test with an incorrect input ("He don't know")**

Run: `echo "He don't know" | node lib/igt-bridge.mjs`
Expected:
- `**Review**: Contains subject-verb agreement error.`
- `**Correction**: He doesn't know.`
- `**Diagnosis**: Subject-Verb Agreement (Minor) - ...`
- `**Rule**` and `**Tip**` sections present.

- [ ] **Step 3: Verify database logging**

Run: `sqlite3 igt_data.db "SELECT * FROM diagnoses ORDER BY id DESC LIMIT 1;"`
Expected: The error from Step 2 should be present in the database (indicating the parser worked).

---

### Task 3: Final Review

- [ ] **Step 1: Verify English-only output**
Ensure all LLM responses are in English as per requirements.

- [ ] **Step 2: Commit any final tweaks**
If any adjustments were made during verification.
