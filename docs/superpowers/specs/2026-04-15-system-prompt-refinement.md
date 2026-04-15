# Design Spec: System Prompt Refinement (v2.2)

**Date:** 2026-04-15
**Status:** Draft
**Topic:** Resolving over-correction ("phantom" errors) and restoring backend parser compatibility.

## 1. Overview
The current system prompt in `lib/igt_config.json` often "hallucinates" minor errors (e.g., correcting "bug log" to "bug log") and uses an output format that is incompatible with the `igt-bridge.mjs` parser. This prevents the learning suite (Handbook, Practice) from correctly logging error data to the SQLite database.

## 2. Goals
- **Eliminate Over-Correction**: Ensure that grammatically and orthographically correct text is not modified in the `Correction` section.
- **Restore Data Collection**: Re-align the output format with the `Diagnosis`, `Rule`, and `Tip` tags required by the `igt-bridge.mjs` parser.
- **Concise "Smart" Output**: Reduce verbosity by omitting technical sections (Diagnosis, Rule, Tip) when the input text is correct.
- **Accurate Error Taxonomy**: Use the full 20-type MECE error classification from `lib/error-types.mjs`.

## 3. Technical Changes

### 3.1. System Prompt Update (`lib/igt_config.json`)
The `SystemPrompt` will be updated with:
- **Role**: Expert Linguistic Validator and Professional Editor.
- **Objective vs. Style**: Clear distinction between `Correction` (objective errors only) and `Refine` (stylistic improvements).
- **Negative Constraint**: Explicit instruction to NOT modify correct text in the `Correction` section.
- **Strict Format**: Reversion to `**Diagnosis**`, `**Rule**`, and `**Tip**` headers.
- **Error Taxonomy**: Inclusion of the 20 specific error types for precise classification.
- **Conditional Output**: Instruction to output only `Review`, `Correction`, and `Refine` if the input is correct.
- **Language**: English-only explanations for rules and tips.

### 3.2. Error Taxonomy (20 Types)
- **Grammar**: Article Usage, Verb Tense, Subject-Verb Agreement, Pronoun Usage, Preposition Usage, Conjunction/Connector, Modifier Placement, Sentence Structure.
- **Vocabulary**: Word Choice, Idiomatic Expression, Redundancy.
- **Mechanics**: Spelling, Punctuation, Capitalization.
- **Style**: Phrasing, Conciseness, Tone & Register.
- **Clarity**: Sentence Fragment, Incomplete Thought, Ambiguity.

## 4. Components

### 4.1. `lib/igt_config.json`
- Update the `Prompts.SystemPrompt` field.

## 5. Testing Strategy
1.  **Hallucination Test**: Input "bug log" and verify `Correction` is identical and `Diagnosis` is omitted.
2.  **Parser Compatibility Test**: Input "She go to store" and verify that `Diagnosis`, `Rule`, and `Tip` sections are present and correctly parsed into the database.
3.  **Stylistic Refine Test**: Input a correct but simple sentence like "The code works" and verify that `Refine` provides a more professional version (e.g., "The application is operating as intended").
4.  **English-Only Test**: Verify that all explanations are in English.
