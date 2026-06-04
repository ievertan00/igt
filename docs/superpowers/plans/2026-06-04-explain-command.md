# /explain Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `/explain` command to transition from a grammar check into an interactive `/ask` session, seamlessly passing the grammar check context.

**Architecture:** We will capture the result of the last grammar check in the main REPL state. The `/explain` command will construct a hidden payload containing this context and the user's question. We will modify the `/ask` loop to accept an initial payload (sent to the LLM) and an initial display query (shown to the user), so the first turn runs automatically using the context without disrupting the normal user experience.

**Tech Stack:** Node.js, IGT CLI structure.

---

### Task 1: Capture Context in Main REPL

**Files:**
- Modify: `igt.mjs`

- [ ] **Step 1: Declare state variable for the grammar result**
Add `let lastGrammarResult = null;` alongside other state variables near line 160 (around `let lastSubmittedText = "";`).

```javascript
let lastSubmittedText = "";
let lastSubmittedProvider = "";
let lastTargetPath = "";
let lastGrammarResult = null; // New state variable
```

- [ ] **Step 2: Expose the result in `sessionState`**
In the `handleCommand` call around line 301, add a getter for `lastGrammarResult`.

```javascript
        sessionState: {
          get lastSubmittedText() {
            return lastSubmittedText;
          },
          get lastGrammarResult() {
            return lastGrammarResult;
          },
          get lastTargetPath() {
            return lastTargetPath;
          },
          get sessionSentenceCount() {
            return sessionSentenceCount;
          },
        },
```

- [ ] **Step 3: Capture the grammar check result**
Around line 348, capture the return value of `runGrammarCheck`.

```javascript
    const rejection = validateInput(text, { lastSubmittedText, lastSubmittedProvider });
    if (rejection) {
      process.stdout.write(`${paint(colors.yellow, rejection)}\n\n`);
      continue;
    }
    lastSubmittedText = text;
    lastSubmittedProvider = process.env.IGT_LLM_PROVIDER || "gemini";
    lastTargetPath = targetPath;
    lastGrammarResult = await runGrammarCheck(text, targetPath, grammarCtx);
```

- [ ] **Step 4: Commit**
```bash
git add igt.mjs
git commit -m "feat(repl): capture last grammar result in session state"
```

---

### Task 2: Modify `/ask` Loop to Accept Initial Payload

**Files:**
- Modify: `lib/cli/commands/ask.mjs`

- [ ] **Step 1: Update `runAsk` signature and first-turn logic**
Change `export async function runAsk(_args, ctx)` to accept `options`. Add logic to handle `initialPayload` and `initialDisplayQuery`.

```javascript
export async function runAsk(_args, ctx, options = {}) {
  const sep = "─".repeat(Math.min(44, Math.max(20, cols() - 3)));
  process.stdout.write(`${paint(colors.bold + colors.yellow, "Ask")} ${paint(colors.gray, "— grammar consultation thread")}\n`);
  process.stdout.write(`${paint(colors.gray, "Type a question. After each answer you'll be asked to continue or save.")}\n`);
  process.stdout.write(`${paint(colors.gray, sep)}\n`);

  let turns = 0;
  let isFirstTurn = true;

  while (true) {
    let q = "";
    let payload = "";

    if (isFirstTurn && options.initialPayload) {
      // Use the provided initial payload and display query
      q = options.initialDisplayQuery || "Explain";
      payload = options.initialPayload;
      process.stdout.write(`${paint(colors.cyan, "[user] ❯")} ${q}\n`);
    } else {
      q = (await ctx.askLine(ctx.rl, `${paint(colors.cyan, "[user] ❯")} `) || "").trim();
      payload = q;
    }

    isFirstTurn = false;

    if (!q) continue;

    const resp = await runOneTurn(ctx, payload);
    if (!resp) break;
    turns++;
```

- [ ] **Step 2: Commit**
```bash
git add lib/cli/commands/ask.mjs
git commit -m "feat(ask): allow runAsk to accept an initial payload and display query"
```

---

### Task 3: Implement `/explain` Command Handler

**Files:**
- Modify: `lib/cli/commands/dispatch.mjs`

- [ ] **Step 1: Register the `/explain` command**
Add the new registration block below the `ask` command registration.

```javascript
register(["explain", "e"], async (args, ctx) => {
  const result = ctx.sessionState.lastGrammarResult;
  if (!result || !ctx.sessionState.lastSubmittedText) {
    process.stdout.write(paint(colors.yellow, "  No recent grammar check to explain. Submit a sentence first.\n\n"));
    return;
  }

  const original = ctx.sessionState.lastSubmittedText;
  const corrected = result.correction || "No correction provided.";
  
  let diagnosesText = "No specific errors identified.";
  if (Array.isArray(result.diagnoses) && result.diagnoses.length > 0) {
    diagnosesText = result.diagnoses
      .map(d => `- ${d.error_type || d.type}: ${d.explanation}`)
      .join("\n");
  }

  const userQuestion = args.length > 0 
    ? args.join(" ") 
    : "Explain the corrections made to my last sentence.";

  const payload = `I recently submitted this sentence for a grammar check:
Original: "${original}"
Corrected: "${corrected}"

The following errors were identified:
${diagnosesText}

My question is: ${userQuestion}`;

  // Reset the ask session on the server before starting a new context-heavy thread
  try { await api.resetAsk(); } catch {}

  await runAsk([], ctx, {
    initialPayload: payload,
    initialDisplayQuery: userQuestion
  });
});
```

- [ ] **Step 2: Commit**
```bash
git add lib/cli/commands/dispatch.mjs
git commit -m "feat(explain): implement /explain command bridging to /ask"
```
