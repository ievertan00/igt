import { colors, paint, wrapText, wrapCJK, renderCompactStats, box } from "../ui/index.mjs";
import { api } from "../api-client.mjs";
import { rememberEnglish } from "./listen.mjs";
import { speak } from "../tts.mjs";
import { savePracticeAttempt } from "../../features/practice/attempts.mjs";

const IRREGULAR_VERBS = {
  pay: ["paid"],
  take: ["took", "taken"],
  make: ["made"],
  go: ["went", "gone"],
  do: ["did", "done"],
  get: ["got", "gotten"],
  give: ["gave", "given"],
  find: ["found"],
  keep: ["kept"],
  bring: ["brought"],
  catch: ["caught"],
  hold: ["held"],
  fall: ["fell", "fallen"],
  run: ["ran"],
  throw: ["threw", "thrown"],
  leave: ["left"],
  write: ["wrote", "written"],
  speak: ["spoke", "spoken"],
  tell: ["told"],
  buy: ["bought"],
  think: ["thought"],
  seek: ["sought"],
  lead: ["led"],
  lose: ["lost"],
  send: ["sent"],
  spend: ["spent"],
  build: ["built"],
  understand: ["understood"],
  hear: ["heard"],
  mean: ["meant"],
  meet: ["met"],
  grow: ["grew", "grown"],
  show: ["showed", "shown"],
  draw: ["drew", "drawn"],
  fly: ["flew", "flown"],
  choose: ["chose", "chosen"],
  know: ["knew", "known"],
  begin: ["began", "begun"],
  sing: ["sang", "sung"],
  swim: ["swam", "swum"],
  drink: ["drank", "drunk"],
  break: ["broke", "broken"],
  steal: ["stole", "stolen"],
  wear: ["wore", "worn"],
  tear: ["tore", "torn"],
  swear: ["swore", "sworn"],
  forget: ["forgot", "forgotten"],
  shake: ["shook", "shaken"],
  ride: ["rode", "ridden"],
  rise: ["rose", "risen"],
  drive: ["drove", "driven"],
  eat: ["ate", "eaten"],
  forgive: ["forgave", "forgiven"],
  bite: ["bit", "bitten"],
  hide: ["hid", "hidden"],
  freeze: ["froze", "frozen"],
  slide: ["slid"],
  strike: ["struck"],
  light: ["lit", "lighted"],
  shoot: ["shot"],
  sell: ["sold"],
  bind: ["bound"],
  grind: ["ground"],
  wind: ["wound"],
  dig: ["dug"],
  spin: ["spun"],
  cling: ["clung"],
  fling: ["flung"],
  sling: ["slung"],
  sting: ["stung"],
  string: ["strung"],
  swing: ["swung"],
  wring: ["wrung"],
  bleed: ["bled"],
  feed: ["fed"],
  flee: ["fled"],
  speed: ["sped"],
  deal: ["dealt"],
  feel: ["felt"],
  sleep: ["slept"],
  sweep: ["swept"],
  weep: ["wept"],
  bend: ["bent"],
  lend: ["lent"],
  burn: ["burnt", "burned"],
  dream: ["dreamt", "dreamed"],
  learn: ["learnt", "learned"],
  smell: ["smelt", "smelled"],
  spill: ["spilt", "spilled"],
  spoil: ["spoilt", "spilled"],
};

export function maskTerm(example, term) {
  if (!example || !term) return example;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = escaped.split(/\s+/);
  if (parts.length === 1) {
    const base = parts[0].toLowerCase();
    const alternates = [base];
    if (IRREGULAR_VERBS[base]) {
      alternates.push(...IRREGULAR_VERBS[base]);
    }
    const regex = new RegExp(`\\b(?:${alternates.join("|")})(s|es|ed|ing|ly)?\\b`, "gi");
    return example.replace(regex, "___");
  } else {
    const baseFirst = parts[0].toLowerCase();
    const alternates = [baseFirst];
    if (IRREGULAR_VERBS[baseFirst]) {
      alternates.push(...IRREGULAR_VERBS[baseFirst]);
    }
    const first = `(?:${alternates.join("|")})`;
    const last = parts[parts.length - 1];
    const middle = parts.slice(1, -1);
    const middlePattern = middle.length > 0 ? middle.join("\\s+") + "\\s+" : "";
    const pattern = `\\b${first}(s|es|ed|ing|d)?\\s+${middlePattern}${last}(s|es)?\\b`;
    let masked = example.replace(new RegExp(pattern, "gi"), "___");
    if (masked === example) {
      masked = example.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "___");
    }
    return masked;
  }
}

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

    const answer = await askLine(rl, paint(colors.gray, "Type the English word ❯ "));
    if (answer === null) {
      process.stdout.write("\n");
      break;
    }
    const recall = answer.trim();
    const correct =
      recall.length > 0 &&
      recall.replace(/\s+/g, " ").toLowerCase() ===
        String(c.word || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

    process.stdout.write(
      `${paint(colors.gray, recall ? `Your answer: ${recall}` : "Your answer: (blank)")}\n\n`,
    );
    process.stdout.write(`${renderVocabCard(vocab, null)}\n\n`);
    rememberEnglish(c.example ? `${c.word}. ${c.example}` : c.word);

    let result;
    try {
      result = await api.gradeCard(c.id, correct);
    } catch (e) {
      process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
      continue;
    }
    try {
      await savePracticeAttempt({
        activityType: "review-vocabulary",
        targetErrorType: "Vocabulary",
        targetPattern: c.word,
        contextLabel: "review:vocabulary",
        prompt: c.word,
        learnerAnswer: recall || "(blank)",
        referenceAnswer: c.word,
        score: correct ? 100 : 0,
        feedback: { correct, cardId: c.id },
      });
    } catch (e) {
      process.stdout.write(
        paint(colors.yellow, `Could not record learning result: ${e.message}\n`),
      );
    }

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
          "delete [d]  Mark mastered and remove from future reviews\n" +
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
        speak(c.example ? `${c.word}. ${c.example}` : c.word, config, { force: true }).catch(
          () => {},
        );
        continue;
      }
      if (normalized === "delete" || normalized === "d") {
        try {
          await api.deleteCard(c.id);
          process.stdout.write(
            `${paint(colors.gray, "Mastered — this word will not be shown again.")}\n\n`,
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
