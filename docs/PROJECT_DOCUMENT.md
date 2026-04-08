# IGT Architecture & Project Document

## Project Vision
To create the fastest and most reliable terminal-based grammar tool for professional writers and developers, integrating seamlessly into existing knowledge management workflows (e.g., Obsidian).

## Core Architecture

### 1. Loop Orchestrator (`igt.ps1`)
- **Role**: Manages the user interface, configuration, logging, and performance metrics.
- **Key Logic**:
  - Implements a high-resolution `Stopwatch` for latency monitoring.
  - Handles I/O piping between the user and the bridge.
  - Formats multi-line API responses to ensure CLI readability.
  - Provides a thread-safe logging mechanism with retries for file locks.

### 2. High-Speed Bridge (`igt-bridge.mjs`)
- **Role**: Lightweight Node.js interface for direct Gemini API calls.
- **Why Node.js?**: To bypass the startup overhead of the standard `gemini` CLI tool.
- **Technical Implementation**:
  - Uses the `@google/generative-ai` SDK.
  - Employs ESM (ECMAScript Modules) for modern, non-blocking asynchronous calls.
  - Implements robust path resolution (`import.meta.dirname`) to allow execution from any directory.

### 3. Linguistic Engine (Gemini)
- **Model**: Defaulting to `gemini-2.5-flash-lite` for optimal Time-To-First-Token (TTFT).
- **Instruction Set**: Managed via `system_prompt.txt` to enforce a standardized three-tier output: Review, Correction, and Refine.

## Latency Benchmarks (as of 2026-04-08)

| Method | Wall Clock Time | Improvement |
| :--- | :--- | :--- |
| Gemini CLI | ~9.91s | Baseline |
| **IGT Bridge** | **~1.67s** | **83.1% Reduction** |

## Configuration Matrix
The `igt_config.json` acts as the single source of truth for the environment:
- `ReviewPath`: Full path to the Markdown log file.
- `Model`: Target Gemini model identifier.
- `SystemPromptPath`: Path to the file containing the linguistic instructions.
- `ApiKey`: Local credential storage (kept out of Git).

## Future Roadmap
- [ ] Implement a local cache for repeated phrases.
- [ ] Add support for batch processing of entire Markdown files.
- [ ] Develop a visual UI (Electron or Compose Multiplatform) for more complex document reviews.
- [ ] Introduce "Streaming Mode" for immediate visual feedback as the AI generates text.

## Contributors
- **Gemini CLI Agent**: Architecture, bridge development, and performance optimization.
- **ievertan00**: Project vision and linguistic prompt engineering.
