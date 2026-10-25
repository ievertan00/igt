import { colors, paint, wrapText, wrapCJK, renderCompactStats, box } from "../ui/index.mjs";
import { api } from "../api-client.mjs";
import { rememberEnglish } from "./listen.mjs";
import { speak } from "../tts.mjs";
import { randomUUID } from "node:crypto";
export { normalizeVocabAnswer } from "../../domain/vocabulary-review.mjs";

import { maskTerm } from "../../domain/vocabulary-mask.mjs";
export { maskTerm } from "../../domain/vocabulary-mask.mjs";

function renderVocabCard(vocab, mask) {
  const FW = 48;
  const MASK = paint(colors.gray, "___");
  const title = mask === "word" ? MASK : paint(colors.bold + colors.yellow, vocab.word);

  const lbl = (t) => {
    const pad = t === "中文" ? 8 : 10;
    return paint(colors.gray, t.padEnd(pad));
  };

  let lines = [];
  if (vocab.pos) lines.push(`${lbl("PoS")}${paint(colors.gray, vocab.pos)}`);
  if (vocab.meaning)
    lines.push(`${lbl("Meaning")}${paint(colors.white, wrapText(vocab.meaning, FW, 10))}`);
  if (vocab.zh)
    lines.push(
      `${lbl("中文")}${mask === "zh" ? MASK : paint(colors.green, wrapCJK(vocab.zh, FW, 10))}`,
    );
  if (vocab.example) {
    let ex = vocab.example;
    if (mask === "word") {
      ex = maskTerm(ex, vocab.word);
    }
    lines.push(`${lbl("Example")}${paint(colors.cyan, wrapText(ex, FW, 10))}`);
  }
  if (vocab.note)
    lines.push(`${lbl("Note")}${paint(colors.brightCyan, wrapText(vocab.note, FW, 10))}`);

  return box(title, lines.join("\n"), { width: 64, padding: 1, color: colors.gray });
}

function replayVocabAudio(card, config) {
  speak(card.example ? `${card.word}. ${card.example}` : card.word, config, { force: true }).catch(
    () => {},
  );
}

async function runVocabReview(askLine, rl, limit, config) {
  let preview;
  try {
    preview = await api.getDue({ limit: Math.max(1, limit), type: "vocab" });
  } catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
    return;
  }
  const cards = preview.cards || [];
  if (cards.length === 0) {
    process.stdout.write(paint(colors.gray, "No vocab cards due. Come back tomorrow.\n\n"));
    return;
  }

  process.stdout.write(
    `${paint(colors.yellow, `${cards.length} card(s) due — Ctrl+C to stop.`)}\n\n`,
  );
  let correctCount = 0;
  let wrongCount = 0;
  let completed = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const vocab = {
      word: c.word,
      pos: c.pos,
      zh: c.zh,
      meaning: c.meaning,
      example: c.example,
      note: c.note,
    };
    process.stdout.write(
      `${renderCompactStats(completed, cards.length, correctCount, wrongCount)}\n\n`,
    );
    process.stdout.write(`${renderVocabCard(vocab, "word")}\n\n`);

    let answer;
    let audioPlayed = false;
    while (true) {
      answer = await askLine(rl, paint(colors.gray, "Type the English word (or [a] audio) ❯ "));
      if (answer === null) break;
      const normalized = answer.trim().toLowerCase();
      if (normalized === "audio" || normalized === "a") {
        audioPlayed = true;
        replayVocabAudio(c, config);
        continue;
      }
      break;
    }
    if (answer === null) {
      process.stdout.write("\n");
      break;
    }
    const recall = answer.trim();

    process.stdout.write(
      `${paint(colors.gray, recall ? `Your answer: ${recall}` : "Your answer: (blank)")}\n\n`,
    );
    process.stdout.write(`${renderVocabCard(vocab, null)}\n\n`);
    rememberEnglish(c.example ? `${c.word}. ${c.example}` : c.word);

    let result;
    try {
      result = await api.submitVocabularyRecall(c.id, recall, randomUUID(), audioPlayed);
    } catch (e) {
      process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
      continue;
    }
    const correct = result.correct;

    completed++;
    if (correct) {
      correctCount++;
      process.stdout.write(
        `${paint(colors.green, "✓ Correct")}  ${paint(colors.gray, result?.next?.intervalDays ? `Next in ${result.next.intervalDays}d` : "Recorded")}\n\n`,
      );
    } else {
      wrongCount++;
      process.stdout.write(
        `${paint(colors.red, "✗ Incorrect")}  ${paint(colors.gray, "Reset → 1d")}\n\n`,
      );
    }

    process.stdout.write(
      paint(
        colors.gray,
        "audio  [a]  Replay the word and example\n" +
          "delete [d]  Remove this SRS card (the saved word stays in your vocabulary)\n" +
          "Enter       Continue to the next word\n\n",
      ),
    );
    while (true) {
      const command = await askLine(rl, paint(colors.gray, "Action ❯ "));
      if (command === null) {
        process.stdout.write("\n");
        return;
      }
      const normalized = command.trim().toLowerCase();
      if (!normalized) break;
      if (normalized === "audio" || normalized === "a") {
        replayVocabAudio(c, config);
        continue;
      }
      if (normalized === "delete" || normalized === "d") {
        try {
          await api.deleteCard(c.id);
          process.stdout.write(
            `${paint(colors.gray, "SRS card removed. The word stays in your vocabulary and may be imported again.")}\n\n`,
          );
        } catch (e) {
          process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
        }
        break;
      }
      process.stdout.write(
        paint(
          colors.yellow,
          "Use audio/a to replay, delete/d to remove, or press Enter to continue.\n",
        ),
      );
    }
  }

  if (completed > 0) {
    process.stdout.write(`${paint(colors.gray, "─".repeat(40))}\n`);
    process.stdout.write(`${paint(colors.gray, "Session Summary")}\n`);
    process.stdout.write(
      `  ${renderCompactStats(completed, completed, correctCount, wrongCount)}\n\n`,
    );
  }
}

export async function runReview(askLine, rl, limit, config = null) {
  return runVocabReview(askLine, rl, limit, config);
}
