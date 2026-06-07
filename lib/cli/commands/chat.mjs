// /chat — ephemeral English conversation partner. Natural back-and-forth on any
// topic; each turn the partner replies AND gently corrects the user's English.
// Nothing is saved: the thread is discarded on exit (Ctrl+C).

import { colors, paint, Spinner } from "../ui/index.mjs";
import { api } from "../api-client.mjs";
import { renderAskResponse } from "../../features/ask/render.mjs";
import { cols } from "./render.mjs";
import { speak, stop as stopVoice, isEnabled as voiceEnabled } from "../tts.mjs";

function emitCorrections(corrections) {
  if (!Array.isArray(corrections) || corrections.length === 0) return;
  process.stdout.write("\n" + paint(colors.gray, "  ✎ corrections") + "\n");
  for (const c of corrections) {
    const wrong = c.original ? paint(colors.red, `✗ ${c.original}`) : paint(colors.red, "✗");
    const right = paint(colors.green, `✓ ${c.correction}`);
    process.stdout.write(`    ${wrong} ${paint(colors.gray, "→")} ${right}\n`);
    if (c.note) process.stdout.write(`      ${paint(colors.gray, c.note)}\n`);
  }
}

async function runOneTurn(ctx, message) {
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
    resp = await api.callChat(message, controller.signal);
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

  process.stdout.write(`\n${paint(colors.gray, "[partner]")}\n`);
  renderAskResponse({ answer: resp.data?.reply || "" });
  emitCorrections(resp.data?.corrections);
  process.stdout.write("\n");
  if (resp.perf) {
    const { llm_ms, total_ms, model } = resp.perf;
    const fmt = (ms) => `${(ms / 1000).toFixed(2)}s`;
    const modelNote = model ? ` · ${model}` : "";
    process.stdout.write(`${paint(colors.gray, `${fmt(llm_ms)} llm · ${fmt(total_ms)} total${modelNote}`)}\n`);
  }
  // Text is already on screen — speak the reply in the background, non-blocking.
  if (voiceEnabled(ctx.config)) speak(resp.data?.reply || "", ctx.config).catch(() => {});
  return resp;
}

export async function runChat(_args, ctx) {
  const sep = "─".repeat(Math.min(66, Math.max(20, cols() - 3)));
  process.stdout.write(`${paint(colors.bold + colors.yellow, "Chat")} ${paint(colors.gray, "— English conversation practice")}\n`);
  process.stdout.write(`${paint(colors.gray, "Just talk — I'll reply naturally and gently correct any mistakes. Ctrl+C to leave.")}\n`);
  const voiceOn = voiceEnabled(ctx.config);
  const voiceLabel = voiceOn ? paint(colors.green, "🔊 Voice on") : paint(colors.gray, "🔇 Voice off");
  process.stdout.write(`${voiceLabel} ${paint(colors.gray, "— /voice to toggle")}\n`);
  process.stdout.write(`${paint(colors.gray, sep)}\n`);

  // Start each chat from a clean slate (ephemeral — no carry-over thread).
  try { await api.resetChat(); } catch {}

  while (true) {
    const raw = await ctx.askLine(ctx.rl, `${paint(colors.cyan, "[you] ❯")} `);
    if (raw === null) break; // Ctrl+C → leave the chat loop
    const message = raw.trim();
    if (!message) continue;

    const resp = await runOneTurn(ctx, message);
    if (!resp) break;
  }

  stopVoice();
  try { await api.resetChat(); } catch {}
  process.stdout.write(paint(colors.gray, "\n  Chat ended.\n\n"));
}
