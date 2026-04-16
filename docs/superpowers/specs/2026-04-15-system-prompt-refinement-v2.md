# Design Spec: Pattern-Aware Linguistic Refinement (v2)

**Goal**: Transform the IGT Handbook and Practice Mode from general educational tools into a personalized "Linguistic Analyst" that detects habits and targets specific recurring weaknesses based on the user's error history.

**Context**: The user has requested to utilize `review_logs` (database history) to improve English performance, focusing on pattern detection in the Handbook and contextual "trap" exercises in Practice Mode.

---

## 1. Handbook Grammar Rule Prompt Refinement

### Objective
Shift the Handbook from "teaching a rule" to "diagnosing a habit." It should identify exactly *where* the user's breakdown occurs and provide a comprehensive explanation.

### Key Changes
- **Role**: Expert Linguistic Analyst & Pedagogical Researcher.
- **New Section: "Detected Habit"**: A punchy summary of the specific recurring mistake identified from the examples (e.g., "The 'The' Omission Habit").
- **New Section: "Root Cause"**: A linguistic hypothesis of why this happens (e.g., "Potential interference from native language structure regarding specific locations").
- **Instruction**: "Focus on the patterns in the data to detect specific 'sub-rules' being broken, but provide a comprehensive explanation of the broader rule to ensure the user understands the full scope."

### Updated `HandbookGrammarRulePrompt` Structure
- **Overview**: Brief summary of the rule.
- **Pattern Analysis**: Identification of the specific "trap" the user falls into based on `{{examplesText}}`.
- **The Rule**: Comprehensive explanation of the grammar rule.
- **Corrective Patterns**: ✅/❌ examples derived from the user's actual data.
- **Key Takeaway**: A memorable, actionable tip.

---

## 2. Practice Exercise Prompt Refinement

### Objective
Generate exercises that are "Pattern-Aware"—targeting known weaknesses while maintaining broad coverage of the error category.

### Key Changes
- **New Variable: `{{linguisticSummary}}`**: A summary of the user's history for the targeted error types.
- **Strategy**: Use the "Linguistic Snapshot" (Top 3 Recurring Traps + 2 Recent Failures) as a high-priority reference.
- **Instruction**: "Use the provided `linguisticSummary` as a high-priority reference for the specific traps this user struggles with. However, **do not totally rely on them**. Balance the exercise set by including both specific 'trap sentences' based on their history and general proficiency questions for the overall category."
- **Output**: JSON-only format for automated grading.

---

## 3. Technical Update: `tools/igt-practice.mjs`

### Objective
Fetch and inject the `{{linguisticSummary}}` into the Practice Exercise Prompt.

### Implementation Details
- **New Function: `getLinguisticContext(errorTypes)`**:
    - Queries the `diagnoses` and `advice` tables for each requested error type.
    - **Recurring Traps**: Aggregate the most frequent `explanation` or `rule` strings (via grouping/counting).
    - **Recent Failures**: Fetch the 2 most recent `original_text` and `correction` pairs.
- **Injection**: Replace `{{linguisticSummary}}` in the prompt template with a formatted string before sending it to the LLM.

---

## 4. Success Criteria
1. **Handbook**: Provides a personalized "Detected Habit" section that accurately reflects the user's provided examples.
2. **Practice**: Generates at least some exercises that target the specific linguistic patterns found in the user's history.
3. **Accuracy**: No regressions in JSON formatting for practice exercises.
4. **Language**: All output remains strictly in English.

---

## 5. Risk Assessment
- **Privacy**: Only linguistic patterns and anonymous snippets are passed to the LLM. No full personal context is required.
- **Token Usage**: Including the linguistic summary adds a small amount of context but significantly improves performance.
- **Hallucination**: The "do not totally rely on them" instruction prevents the LLM from getting stuck on only a few examples.
