import { spawn } from "node:child_process";
import { colors, paint, wrapText, box } from "../ui.mjs";
import { api } from "../api-client.mjs";

function speak(text) {
  if (process.platform !== "win32") return;
  // Use PowerShell for basic TTS on Windows
  const psCommand = `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak(${JSON.stringify(text)})`;
  spawn("powershell", ["-Command", psCommand], { stdio: "ignore", detached: true }).unref();
}

function diffHighlight(original, corrected) {
  const ow = original.trim().split(/\s+/);
  const cw = corrected.trim().split(/\s+/);
  const n = ow.length, m = cw.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] = ow[i-1].toLowerCase() === cw[j-1].toLowerCase()
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
  const parts = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ow[i-1].toLowerCase() === cw[j-1].toLowerCase()) {
      parts.unshift({ word: cw[j-1], changed: ow[i-1] !== cw[j-1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      parts.unshift({ word: cw[j-1], changed: true });
      j--;
    } else {
      i--;
    }
  }
  return parts.map(({ word, changed }) =>
    changed ? paint(colors.bold + colors.green, word) : word).join(" ");
}


function renderVocabCard(vocab, mask) {
  const FW = 52;
  const MASK = paint(colors.gray, "___");
  const lbl = (t) => paint(colors.gray, t.padEnd(10));
  const title = mask === "word" ? MASK : paint(colors.bold + colors.yellow, vocab.word);
  let body = "";
  if (vocab.pos) body += `  ${lbl("PoS")}${paint(colors.gray, vocab.pos)}\n`;
  if (vocab.meaning) body += `  ${lbl("Meaning")}${paint(colors.white, wrapText(vocab.meaning, FW, 12))}\n`;
  if (vocab.zh) body += `  ${lbl("中文")}${mask === "zh" ? MASK : paint(colors.green, vocab.zh)}\n`;
  if (vocab.example) {
    let ex = vocab.example;
    if (mask === "word") {
      const esc = vocab.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      ex = ex.replace(new RegExp(`\\b${esc}\\b`, "gi"), "___");
    }
    body += `  ${lbl("Example")}${paint(colors.cyan, wrapText(ex, FW, 12))}\n`;
  }
  if (vocab.note) body += `  ${lbl("Note")}${paint(colors.brightCyan, wrapText(vocab.note, FW, 12))}`;
  return box(title, body.trimEnd(), { width: 70 });
}

export async function runReview(askLine, rl, limit, type = "all") {
  let preview;
  try {
    preview = await api.getDue({ limit: Math.max(1, limit), type });
  } catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
    return;
  }
  const cards = preview.cards || [];
  if (cards.length === 0) {
    const msg = type === "vocab"
      ? "No vocab cards due. Come back tomorrow.\n\n"
      : "No cards due. Come back tomorrow.\n\n";
    process.stdout.write(paint(colors.gray, msg));
    return;
  }
  process.stdout.write(`${paint(colors.yellow, `${cards.length} card(s) due — Ctrl+C to stop.`)}\n\n`);
  let correctCount = 0, wrongCount = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const isVocab = c.source_type === "vocab";
    const vocab = isVocab ? { word: c.word, pos: c.pos, zh: c.zh, meaning: c.meaning, example: c.example, note: c.note } : null;
    const done = i;
    const barW = 10;
    const filled = Math.round((done / cards.length) * barW);
    const bar = paint(colors.green, "▓".repeat(filled)) + paint(colors.gray, "░".repeat(barW - filled));
    const pctStr = paint(colors.gray, `${Math.round((done / cards.length) * 100)}%`);
    const scoreStr = `${paint(colors.green, `✓ ${correctCount}`)}  ${paint(colors.red, `✗ ${wrongCount}`)}`;
    process.stdout.write(`${paint(colors.gray, `${i + 1}/${cards.length}`)}  ${bar}  ${pctStr}  ${paint(colors.gray, "·")}  ${scoreStr}\n\n`);
    let vocabMask = null;
    if (isVocab) {
      vocabMask = Math.random() < 0.5 ? "word" : "zh";
      const dirHint = vocabMask === "word"
        ? paint(colors.gray, "[中文 → word]")
        : paint(colors.gray, "[word → 中文]");
      process.stdout.write(`${dirHint}\n\n`);
      process.stdout.write(renderVocabCard(vocab, vocabMask) + "\n\n");
    } else {
      const hintTypes = c.hint ? c.hint.split(" · ") : [];
      const hintLabel = hintTypes.length > 1
        ? `[${c.hint}] errors:`
        : hintTypes.length === 1 ? `[${c.hint}] error:` : null;
      if (hintLabel) process.stdout.write(`${paint(colors.yellow, hintLabel)}\n\n`);
      process.stdout.write(`${paint(colors.cyan, c.prompt)}\n`);
    }
    const enter = await askLine(rl, paint(colors.gray, "Show Answer [Enter] ❯ "));
    if (enter === null) { process.stdout.write("\n"); break; }
    process.stdout.write("\x1b[1A\x1b[2K\r");

    if (vocab) process.stdout.write(renderVocabCard(vocab, null) + "\n\n");
    else process.stdout.write(`${diffHighlight(c.prompt, c.answer)}\n\n`);

    let choice;
    while (true) {
      choice = await askLine(rl, paint(colors.gray, "[y] correct  [n] again   [v] explain   [d] delete  ❯ "));
      if (choice === null) break;
      const cmd = choice.trim().toLowerCase();
      if (cmd === "a" || cmd === "audio") {
        speak(isVocab ? c.word : c.answer);
        continue;
      }
      if (cmd === "v" || cmd === "view") {
        if (isVocab) {
          process.stdout.write(paint(colors.gray, "(No extra explanation for vocab cards)\n\n"));
        } else if (c.explanation) {
          process.stdout.write(paint(colors.yellow, "Explanation:\n") + paint(colors.gray, wrapText(c.explanation, 60, 0)) + "\n\n");
        } else {
          process.stdout.write(paint(colors.gray, "(No explanation available)\n\n"));
        }
        continue;
      }
      if (cmd === "m") {
        const streak = "★".repeat(c.correct_streak || 0);
        process.stdout.write(paint(colors.gray, `Meta: Ease ${c.ease?.toFixed(1) || "2.5"}, Interval ${c.interval_days || 0}d, Reviews ${c.total_reviews || 0} ${streak}\n\n`));
        continue;
      }
      break;
    }
    if (choice === null) { process.stdout.write("\n"); break; }
    const finalCmd = choice.trim().toLowerCase();
    if (finalCmd === "s") {
      process.stdout.write(paint(colors.gray, "Skipped.\n\n"));
      continue;
    }
    if (finalCmd === "d") {
      try {
        await api.deleteCard(c.id);
        process.stdout.write(`${paint(colors.gray, "Card deleted.")}\n\n`);
      } catch (e) {
        process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
      }
      continue;
    }
    const selfCorrect = !/^n/i.test(finalCmd);
    let result;
    try { result = await api.gradeCard(c.id, selfCorrect); }
    catch (e) {
      process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
      continue;
    }
    if (selfCorrect) {
      correctCount++;
      process.stdout.write(`${paint(colors.green, "✓")}  ${paint(colors.gray, `Next in ${result.next.intervalDays}d`)}\n\n`);
    } else {
      wrongCount++;
      process.stdout.write(`${paint(colors.red, "✗")}  ${paint(colors.gray, "Reset → 1d")}\n\n`);
    }
  }
  const total = correctCount + wrongCount;
  if (total > 0) {
    const pct = Math.round((correctCount / total) * 100);
    const sumBarW = 10;
    const sumFilled = Math.round((pct / 100) * sumBarW);
    const sumBar = paint(colors.green, "▓".repeat(sumFilled)) + paint(colors.gray, "░".repeat(sumBarW - sumFilled));
    process.stdout.write(`${paint(colors.gray, "─".repeat(40))}\n`);
    process.stdout.write(`${paint(colors.gray, "Session")}  ${paint(colors.green, `✓ ${correctCount}`)}  ${paint(colors.red, `✗ ${wrongCount}`)}  ${paint(colors.gray, `${total} cards  ${pct}%`)}  ${sumBar}\n\n`);
  }
}
