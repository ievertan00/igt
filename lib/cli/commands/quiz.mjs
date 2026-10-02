import { colors, paint, wrapCJK, wrapText } from "../ui/index.mjs";

function displayWidth(text) {
  let width = 0;
  for (const char of String(text)) {
    width += /[\p{Script=Han}\u2600-\u27bf\uff01-\uff60]/u.test(char) || char.codePointAt(0) > 0xffff ? 2 : 1;
  }
  return width;
}

function wrapMixed(text, maxWidth) {
  const tokens = String(text).match(/[A-Za-z0-9]+(?:['’._/-][A-Za-z0-9]+)*|\s+|./gu) || [];
  const lines = [];
  let line = "";
  let lineWidth = 0;
  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (line && !line.endsWith(" ")) {
        line += " ";
        lineWidth += 1;
      }
      continue;
    }
    const tokenWidth = displayWidth(token);
    if (line.trim() && lineWidth + tokenWidth > maxWidth) {
      lines.push(line.trimEnd());
      line = token;
      lineWidth = tokenWidth;
    } else {
      line += token;
      lineWidth += tokenWidth;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines.join("\n");
}

function wrapContent(text, width) {
  const value = String(text || "");
  const hasHan = /\p{Script=Han}/u.test(value);
  const hasLatin = /[A-Za-z]/.test(value);
  if (hasHan && hasLatin) return wrapMixed(value, width);
  return hasHan ? wrapCJK(value, width) : wrapText(value, width);
}

function wrappedBlock(text, width, color = "") {
  const contentWidth = Math.max(20, width - 4);
  const wrapped = wrapContent(text, contentWidth);
  return wrapped
    .split("\n")
    .map((line) => color ? paint(color, `  ${line}`) : `  ${line}`)
    .join("\n");
}

function bulletBlock(items, width) {
  return items.map((item) => {
    const contentWidth = Math.max(18, width - 6);
    const wrapped = wrapContent(item, contentWidth);
    return wrapped.split("\n").map((line, index) => `${index === 0 ? "  • " : "    "}${line}`).join("\n");
  }).join("\n");
}

function sameAnswer(left, right) {
  const normalize = (value) => String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  return normalize(left) === normalize(right);
}

function printNoQuestions(message) {
  process.stdout.write(`${paint(colors.yellow, message)}\n\n`);
}

export function formatQuizFeedback(evaluation, question, width) {
  const scoreColor = evaluation.score >= 90 ? colors.green : evaluation.score >= 75 ? colors.cyan : colors.yellow;
  const verdict = evaluation.score >= 90 ? "非常自然" : evaluation.score >= 75 ? "基本准确" : evaluation.score >= 60 ? "需要调整" : "建议重写";
  const sections = [
    `${paint(scoreColor + colors.bold, `结果 ${evaluation.score}/100`)}  ${paint(colors.gray, verdict)}`,
    "",
    paint(colors.cyan, "点评"),
    wrappedBlock(evaluation.feedback_zh, width),
  ];

  if (evaluation.strengths_zh?.length) {
    sections.push("", paint(colors.green, "做得好的地方"), bulletBlock(evaluation.strengths_zh, width));
  }
  if (evaluation.improvements_zh?.length) {
    sections.push("", paint(colors.yellow, "下一步"), bulletBlock(evaluation.improvements_zh, width));
  }

  sections.push("", paint(colors.green + colors.bold, "推荐表达"));
  sections.push(wrappedBlock(evaluation.corrected_answer, width, colors.green + colors.bold));

  if (question.reference_answer && !sameAnswer(evaluation.corrected_answer, question.reference_answer)) {
    sections.push("", paint(colors.gray, "另一种参考答案"));
    sections.push(wrappedBlock(question.reference_answer, width, colors.gray));
  }
  return sections.join("\n") + "\n";
}
