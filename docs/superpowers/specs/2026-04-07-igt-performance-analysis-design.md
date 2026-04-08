# Design Spec: IGT Workflow Performance Analysis

**Date:** 2026-04-07
**Status:** Approved
**Topic:** Identifying the highest processing time component in the `igt.ps1` workflow.

## 1. Overview
This analysis aims to decompose the `igt.ps1` execution cycle into measurable phases to pinpoint the "Wall Clock" bottleneck. We will use surgical instrumentation with high-resolution timers across three standardized input types.

## 2. Test Inputs
- **Short**: `"Hello, how are you?"`
- **Long**: A 200-word paragraph of technical documentation describing a software system.

## 3. Measurable Components
1.  **Startup**: Loading `igt_config.json`, environment variable setup, and regex compilation.
2.  **Gemini Call**: The external execution of `& gemini -p - -m $model ...`.
3.  **Processing**: Output filtering (regex matching) and string joining.
4.  **Logging**: Writing the UTF-8 encoded entry to the `StreamWriter`.

## 4. Implementation Strategy
We will create `igt_perf_test.ps1` (or overwrite `igt.ps1` as directed) to:
- Use `[System.Diagnostics.Stopwatch]` for each phase.
- Automate the two test cases in sequence.
- Output a results table to the console.

## 5. Success Criteria
- Successful identification of the component consuming >50% of the wall clock time.
- Accurate measurement of "Processing" overhead (regex) vs. "IO" overhead (Gemini/Logging).
- No silent failures during the measurement process.

## 6. Testing Plan
1.  Run the instrumented script.
2.  Capture the Markdown-formatted results table.
3.  Analyze the variance between Short and Long inputs.
