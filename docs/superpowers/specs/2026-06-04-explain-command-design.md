# Feature Specification: /explain Command

## Overview
A new `/explain` command that allows users to seamlessly transition from a rapid grammar check into an interactive, multi-turn explanation thread. It leverages the existing `/ask` infrastructure to provide deep-dives without slowing down the core grammar loop.

## 1. Context Capture
The main REPL (`igt.mjs`) must maintain state of the most recent grammar check.
- **State to capture:** The user's original text, the corrected text, and the array of diagnoses returned by the LLM.
- **Update timing:** State is updated immediately after a successful `runGrammarCheck` execution.
- **Isolation:** The core `/grammar` HTTP route and its prompt remain entirely unchanged.

## 2. Command Trigger
- **Command:** `/explain [optional specific question]`
- **Validation:** If the REPL state contains no recent grammar check, display a localized warning: *"No recent grammar check to explain. Submit a sentence first."* and return to the prompt.
- **Default Query:** If the user types `/explain` with no arguments, the system defaults the query to: *"Explain the corrections made to my last sentence."*

## 3. The Bridge to /ask
The `/explain` command does not have its own HTTP route or LLM prompt. Instead, it acts as a smart entry point into the `/ask` command.
- **Payload Construction:** The CLI constructs a comprehensive initial prompt combining the context and the user's query.
  - *Format Example:*
    ```
    I recently submitted this sentence for a grammar check:
    Original: "I goes to store."
    Corrected: "I go to the store."

    The following errors were identified:
    - Subject-Verb Agreement: Changed "goes" to "go"
    - Article Usage: Added "the" before "store"

    My question is: [User's question or default query]
    ```
- **Execution:** The CLI invokes the existing `runAskLoop` logic (or a slight refactor thereof) passing in this constructed payload as the first message of the thread.

## 4. User Experience & Persistence
Because it utilizes the `/ask` module:
- The terminal transitions into the interactive `Ask` loop UI.
- The LLM responds to the explanation request and generates 3 related follow-up questions.
- The user can continue chatting.
- The user can type `save` or `s` at any time to compact the thread and write it to the Obsidian vault, utilizing the exact same paths (`IGT_ASK_FILE`) and Markdown formatting as standard consultations.