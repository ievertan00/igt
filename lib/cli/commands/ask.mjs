// /ask — sticky thread loop. Per design:
//   [user] ❯ <question> → [assist] response
//   After each turn: "Any further question? [Y/n]"
//   On N: "Save to Vault? [Y/n]" → save (compact + DB + vault) or reset.

import { colors, paint, Spinner } from "../ui/index.mjs";
import { api } from "../api-client.mjs";
import { renderAskResponse } from "../../features/ask/render.mjs";
import { cols } from "./render.mjs";

function isYes(line, defaultYes = true) {
  const v = (line || "").trim().toLowerCase();
  if (v === "") return defaultYes;
  return v === "y" || v === "yes";
}

function isNo(line) {
  const v = (line || "").trim().toLowerCase();
  return v === "n" || v === "no";
}

async function runOneTurn(ctx, question) {
  const spinner = new Spinner("Thinking");
  spinner.start();
  let cancelled = false;
  const controller = new AbortController();
  ctx.setSigint(() => {
    cancelled = true;
    controller.abort();
    ctx.setSigint(() => {});
    spinner.stop(true);
    process.stdout.write("\n" + paint(colors.gray, "Cancelled.\n"));
  });

  let resp = null;
  try {
    resp = await api.callAsk(question, controller.signal);
  } catch (err) {
    if (!cancelled) {
      const msg = err.message || "";
      if (err.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/i.test(msg)) {
        process.stdout.write(paint(colors.yellow, "\n  API limit reached. Wait a moment and try again.\n"));
      } else if (err.name !== "AbortError" && err.code !== "ABORT_ERR") {
        process.stdout.write(paint(colors.red, `\n  Error: ${msg}\n`));
      }
    }
  } finally {
    ctx.setSigint(() => {});
    spinner.stop(true);
  }
  if (cancelled || !resp) return null;

  process.stdout.write(`\n${paint(colors.gray, "[assist]")}\n`);
  renderAskResponse(resp.data);
  process.stdout.write("\n");
  if (resp.perf) {
    const { llm_ms, total_ms, tool_ms, answer_ms, call_count, model } = resp.perf;
    const fmt = (ms) => `${(ms / 1000).toFixed(2)}s`;
    const modelNote = model ? ` · ${model}` : "";
    let timing;
    if (tool_ms !== undefined && answer_ms !== undefined) {
      const callsNote = call_count > 2 ? ` (${call_count} calls)` : "";
      timing = `${fmt(tool_ms)} search + ${fmt(answer_ms)} answer · ${fmt(total_ms)} total${callsNote}`;
    } else {
      timing = `${fmt(llm_ms)} llm · ${fmt(total_ms)} total`;
    }
    process.stdout.write(`${paint(colors.gray, `${timing}${modelNote}`)}\n`);
  }
  return resp;
}

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

    const more = await ctx.askLine(ctx.rl, paint(colors.gray, "Any further question? [Y/n] "));
    if (!isNo(more)) continue;

    const save = await ctx.askLine(ctx.rl, paint(colors.gray, "Save to Vault? [Y/n] "));
    if (isYes(save)) {
      const saveSpinner = new Spinner("Saving");
      saveSpinner.start();
      try {
        const result = await api.saveAsk();
        saveSpinner.stop(true);
        if (result.saved) {
          const file = result.vaultFile || "vault";
          process.stdout.write(paint(colors.green, `\n  ✓ Saved ${result.turnCount} turn(s) to ${file} and DB (#${result.consultationId}).\n\n`));
        } else {
          process.stdout.write(paint(colors.yellow, "\n  Nothing to save — thread discarded.\n\n"));
        }
      } catch (err) {
        saveSpinner.stop(true);
        process.stdout.write(paint(colors.red, `\n  Save failed: ${err.message}\n\n`));
      }
    } else {
      try { await api.resetAsk(); } catch {}
      process.stdout.write(paint(colors.gray, "\n  Thread discarded.\n\n"));
    }
    break;
  }

  if (turns === 0) {
    try { await api.resetAsk(); } catch {}
  }
}
