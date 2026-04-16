# Pattern-Aware Linguistic Refinement (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the IGT Handbook and Practice Mode from general educational tools into a personalized "Linguistic Analyst" that detects habits and targets specific recurring weaknesses based on the user's error history.

**Architecture:** 
1. Update `lib/igt_config.json` with refined prompts for Handbook and Practice.
2. Modify `tools/igt-practice.mjs` to fetch recurring error patterns and recent failures from the database and inject them into the Practice prompt as `{{linguisticSummary}}`.

**Tech Stack:** Node.js (JavaScript), SQLite (better-sqlite3), LLM Prompt Engineering.

---

### Task 1: Update Prompts in `lib/igt_config.json`

**Files:**
- Modify: `lib/igt_config.json`

- [ ] **Step 1: Update `HandbookGrammarRulePrompt`**

Update `Prompts.HandbookGrammarRulePrompt` with the following content (JSON-escaped):

```json
"You are an expert English grammar tutor and Linguistic Analyst. Based on the user's error patterns and examples, create a detailed, personalized grammar rule explanation.\n\n**Error Type**: {{errorType}}\n\n**User's Examples**:\n{{examplesText}}\n\n**Instructions**:\n1. Analyze the examples to detect the user's specific \"linguistic fingerprint\" or recurring habit.\n2. Provide a comprehensive explanation of the grammar rule, covering both the specific breakdown and the broader context.\n3. Reference the user's specific errors and show what they did wrong.\n4. Give 2-3 additional common examples that the user might encounter.\n5. All explanations MUST be in English ONLY. Do NOT use Chinese.\n\n**Format** (use markdown):\n- **Overview**: A brief overview of the rule.\n- **Detected Habit**: Identify the specific recurring trap or sub-rule the user falls into (e.g., \"The 'The' Omission Habit\").\n- **Root Cause**: A linguistic hypothesis of why this error occurs (e.g., native language interference).\n- **Corrective Patterns**: List specific patterns with ✅/❌ examples from the user's data.\n- **The Rule**: A clear, detailed explanation to avoid these mistakes.\n- **Key Takeaway**: A concise, memorable tip in a box.\n\nKeep the tone encouraging and analytical. Focus on the patterns the user actually struggles with while ensuring full rule coverage."
```

- [ ] **Step 2: Update `PracticeExercisePrompt`**

Update `Prompts.PracticeExercisePrompt` with the following content (JSON-escaped), including the new `{{linguisticSummary}}` variable:

```json
"Generate {{count}} grammar practice exercises focusing on these error types:\n{{errorList}}\n\nCEFR Proficiency Level: {{level}}\n\n**User's Linguistic Snapshot (Recent & Recurring Patterns)**:\n{{linguisticSummary}}\n\nIMPORTANT RULES:\n1. Create ENTIRELY NEW sentences. DO NOT use or reference any previous user input examples.\n2. Each exercise must be either multiple-choice (4 options) or fill-in-the-blank.\n3. Use common, everyday topics (e.g., work, school, travel, daily life).\n4. Adjust vocabulary and sentence complexity to match the CEFR {{level}} level.\n5. **Instruction**: Use the provided `linguisticSummary` as a high-priority reference for the specific traps this user struggles with. However, **do not totally rely on them**. Balance the exercise set by including both specific \"trap sentences\" based on their history and general proficiency questions for the overall category.\n6. CRITICAL: All string values MUST use proper JSON escaping. Use backslash-quote (\\\") for quotes within strings.\n\nOutput Format (STRICT JSON, no other text):\n\n[\n  {\n    \"type\": \"multiple-choice\",\n    \"question\": \"She ___ to the store yesterday.\",\n    \"options\": [\"go\", \"goes\", \"went\", \"going\"],\n    \"answer\": \"went\",\n    \"explanation\": \"Past tense is required because of yesterday.\"\n  },\n  {\n    \"type\": \"fill-in-the-blank\",\n    \"question\": \"He is ___ honest man.\",\n    \"answer\": \"an\",\n    \"explanation\": \"Use an before vowel sounds.\"\n  }\n]\n\nRules for multiple-choice:\n- Provide exactly 4 options in the options array\n- The answer field should be the exact text of the correct option\n\nRules for fill-in-the-blank:\n- Use ___ (three underscores) to indicate the blank\n- The answer field should be the exact word(s) to fill in\n\nCRITICAL: Return ONLY the JSON array. NO markdown, NO code blocks, NO explanation text."
```

- [ ] **Step 3: Commit the changes**

```bash
git add lib/igt_config.json
git commit -m "feat: refine handbook and practice prompts for pattern detection"
```

---

### Task 2: Update `tools/igt-practice.mjs` to inject Linguistic Context

**Files:**
- Modify: `tools/igt-practice.mjs`

- [ ] **Step 1: Implement `getLinguisticContext` function**

Add this function to fetch recurring traps and recent failures from the database.

```javascript
// Fetch linguistic context (recurring traps and recent failures) for the requested error types
function getLinguisticContext(errorTypes) {
  let contextText = "";
  
  for (const type of errorTypes) {
    const errorTypeName = type.error_type;
    contextText += `\n### Error Type: ${errorTypeName}\n`;
    
    // 1. Get Top 3 Recurring "Traps" (most frequent rules/explanations)
    const recurringTraps = db.prepare(`
      SELECT a.rule, COUNT(*) as count
      FROM advice a
      JOIN diagnoses d ON a.input_id = d.input_id
      WHERE d.error_type = ? AND a.rule IS NOT NULL AND a.rule != ''
      GROUP BY a.rule
      ORDER BY count DESC
      LIMIT 3
    `).all(errorTypeName);
    
    if (recurringTraps.length > 0) {
      contextText += "Recurring Traps:\n";
      recurringTraps.forEach((trap, i) => {
        contextText += `- ${trap.rule} (appeared ${trap.count} times)\n`;
      });
    }
    
    // 2. Get 2 Most Recent Failures
    const recentFailures = db.prepare(`
      SELECT i.original_text, i.correction
      FROM inputs i
      JOIN diagnoses d ON d.input_id = i.id
      WHERE d.error_type = ?
      ORDER BY i.timestamp DESC
      LIMIT 2
    `).all(errorTypeName);
    
    if (recentFailures.length > 0) {
      contextText += "Recent Failures:\n";
      recentFailures.forEach((fail, i) => {
        contextText += `- Original: "${fail.original_text}" -> Corrected: "${fail.correction}"\n`;
      });
    }
  }
  
  return contextText || "No previous history found for these error types.";
}
```

- [ ] **Step 2: Update `generateExercises` to inject the context**

Modify the `generateExercises` function to call `getLinguisticContext` and replace the placeholder in the prompt.

```javascript
async function generateExercises(errorTypes, count, level) {
  const errorList = errorTypes.map(e => `- ${e.error_type}`).join("\n");
  const linguisticSummary = getLinguisticContext(errorTypes); // New line

  // Load prompt from config or use default
  let prompt;
  if (config.Prompts && config.Prompts.PracticeExercisePrompt) {
    prompt = config.Prompts.PracticeExercisePrompt
      .replace(/\{\{count\}\}/g, count)
      .replace(/\{\{errorList\}\}/g, errorList)
      .replace(/\{\{level\}\}/g, level || "B1")
      .replace(/\{\{linguisticSummary\}\}/g, linguisticSummary); // New replacement
  } else {
    // ... existing fallback ...
  }
  // ... rest of the function ...
}
```

- [ ] **Step 3: Verify the changes by running a dry run**

Add a temporary log to see the generated prompt (optional but recommended for debugging).

- [ ] **Step 4: Commit the changes**

```bash
git add tools/igt-practice.mjs
git commit -m "feat: implement linguistic context injection in practice mode"
```

---

### Task 3: Verification

- [ ] **Step 1: Test Handbook Generation**

Run: `node tools/igt-handbook.mjs --days=30`
Verify: The generated Markdown contains the new sections: **Detected Habit** and **Root Cause**.

- [ ] **Step 2: Test Practice Exercise Generation**

Run: `node tools/igt-practice.mjs --count=5`
Verify: The exercises are generated and the grading works as expected. Check if some exercises seem targeted to your recent/common errors.

- [ ] **Step 3: Final Review**

Ensure all output is in English and the JSON parsing is robust.
