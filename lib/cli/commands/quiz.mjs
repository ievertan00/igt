import { api } from "../api-client.mjs";
import { rememberEnglish } from "./listen.mjs";
import { colors, paint, Spinner, wrapCJK, wrapText } from "../ui/index.mjs";
import { cols } from "./render.mjs";

function parseOptions(args) {
  const countArg = args.find((arg) => /^\d+$/.test(arg));
  const daysArg = args.find((arg) => arg.startsWith("--days="));
  return {
    count: countArg ? Number(countArg) : 5,
    days: daysArg ? Number(daysArg.slice("--days=".length)) : 30,
  };
}

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

function usableQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((question) => question && typeof question === "object"
    && String(question.chinese || "").trim()
    && String(question.reference_answer || "").trim());
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

export async function runQuiz(args, ctx) {
  const { count, days } = parseOptions(args);
  if (!Number.isInteger(count) || count < 1 || count > 10 || !Number.isInteger(days) || days < 0 || days > 3650) {
    process.stdout.write(paint(colors.yellow, "Usage: /quiz [1-10] [--days=0-3650]\n\n"));
    return;
  }

  const spinner = new Spinner("正在根据你的错误手册生成题目");
  spinner.start();
  let questions;
  try {
    const response = await api.generateQuiz(count, days);
    questions = usableQuestions(response.data?.questions);
  } catch (error) {
    spinner.stop(true);
    const message = /No handbook records/i.test(error.message || "")
      ? "所选时间范围内还没有可用的错误记录。请先提交一些英文句子，或使用 /quiz --days=0。"
      : `生成题目失败：${error.message}`;
    process.stdout.write(`${paint(colors.red, message)}\n\n`);
    return;
  }
  spinner.stop(true);
  if (!questions.length) {
    printNoQuestions("这次没有生成可用题目，请稍后重试。");
    return;
  }

  const width = Math.min(110, Math.max(60, cols() - 4));
  process.stdout.write(`\n  ${paint(colors.bold + colors.yellow, "中译英 · 个性化 Quiz")}\n`);
  process.stdout.write(`  ${paint(colors.gray, `根据最近 ${days === 0 ? "全部" : `${days} 天`}的错误记录生成；输入 q 可提前结束。`)}\n\n`);

  const scores = [];
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    process.stdout.write(`${paint(colors.cyan + colors.bold, `题目 ${index + 1}/${questions.length}`)}  ${paint(colors.gray, question.error_type)}\n`);
    process.stdout.write(`${paint(colors.gray, "─".repeat(Math.min(width, 56)))}\n`);
    process.stdout.write(`${paint(colors.gray, "中文")}\n${wrappedBlock(question.chinese, width)}\n`);
    if (question.hint) process.stdout.write(`\n${paint(colors.gray, "提示")}\n${wrappedBlock(question.hint, width, colors.gray)}\n`);
    process.stdout.write("\n");

    let answer = "";
    while (!answer) {
      const line = await ctx.askLine(ctx.rl, paint(colors.gray, "你的英文表达 ❯ "));
      answer = line === null ? "q" : line.trim();
      if (answer.toLowerCase() === "q") break;
      if (!answer) process.stdout.write(paint(colors.yellow, "请输入英文表达，或输入 q 结束。\n"));
    }
    if (answer.toLowerCase() === "q") break;

    const evaluationSpinner = new Spinner("正在评估你的表达");
    evaluationSpinner.start();
    let evaluation;
    try {
      const response = await api.evaluateQuiz(question, answer);
      evaluation = response.data;
    } catch (error) {
      evaluationSpinner.stop(true);
      process.stdout.write(`${paint(colors.red, `评估失败：${error.message}`)}\n\n`);
      continue;
    }
    evaluationSpinner.stop(true);
    scores.push(evaluation.score);
    rememberEnglish(evaluation.corrected_answer);

    process.stdout.write(`${formatQuizFeedback(evaluation, question, width)}\n`);
  }

  if (scores.length) {
    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    process.stdout.write(`${paint(colors.bold + colors.yellow, "本次完成")}  ${scores.length} 题 · 平均 ${average}/100\n\n`);
  } else {
    process.stdout.write(`${paint(colors.gray, "本次未完成题目。")}\n\n`);
  }
}

export async function runWordPractice(args, ctx, options = {}) {
  const countArg = args.find((arg) => /^\d+$/.test(arg));
  const count = countArg ? Number(countArg) : 5;
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    process.stdout.write(paint(colors.yellow, "Usage: /practice word [1-10]\n\n"));
    return;
  }

  const spinner = new Spinner("正在根据你的词汇库生成场景题");
  spinner.start();
  let questions;
  try {
    const response = await api.generatePractice("word", count);
    questions = (response.data?.questions || []).map((question) => ({
      ...question,
      word: question.target_word,
      chinese: question.prompt_zh,
    })).filter((question) => String(question.chinese || "").trim()
      && String(question.reference_answer || "").trim());
  } catch (error) {
    spinner.stop(true);
    const message = /No saved vocabulary/i.test(error.message || "")
      ? "词库里还没有保存的单词。请先使用 /word <word> 添加单词。"
      : `生成题目失败：${error.message}`;
    process.stdout.write(`${paint(colors.red, message)}\n\n`);
    return;
  }
  spinner.stop(true);
  if (!questions.length) {
    printNoQuestions("这次没有生成可用词汇题，请稍后重试。");
    return;
  }

  const width = Math.min(110, Math.max(60, cols() - 4));
  process.stdout.write(`\n  ${paint(colors.bold + colors.yellow, options.title || "用词造句 · Word Quiz")}\n`);
  process.stdout.write(`  ${paint(colors.gray, "在真实场景里把词用对、用自然；每句都用上目标词，输入 q 可提前结束。")}\n\n`);

  const scores = [];
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const posSuffix = question.pos ? ` ${paint(colors.gray, `(${question.pos})`)}` : "";
    process.stdout.write(`${paint(colors.cyan + colors.bold, `题目 ${index + 1}/${questions.length}`)}  ${paint(colors.gray, "目标词")} ${paint(colors.bold + colors.yellow, question.word)}${posSuffix}\n`);
    process.stdout.write(`${paint(colors.gray, "─".repeat(Math.min(width, 56)))}\n`);
    process.stdout.write(`${paint(colors.gray, "场景")}\n${wrappedBlock(question.chinese, width)}\n`);
    if (question.hint) process.stdout.write(`\n${paint(colors.gray, "提示")}\n${wrappedBlock(question.hint, width, colors.gray)}\n`);
    process.stdout.write("\n");

    let answer = "";
    while (!answer) {
      const line = await ctx.askLine(ctx.rl, paint(colors.gray, "你的英文表达 ❯ "));
      answer = line === null ? "q" : line.trim();
      if (answer.toLowerCase() === "q") break;
      if (!answer) process.stdout.write(paint(colors.yellow, "请输入含目标词的英文句子，或输入 q 结束。\n"));
    }
    if (answer.toLowerCase() === "q") break;

    const evaluationSpinner = new Spinner("正在评估你的表达");
    evaluationSpinner.start();
    let evaluation;
    try {
      const response = await api.evaluatePractice(question, answer);
      evaluation = response.data;
    } catch (error) {
      evaluationSpinner.stop(true);
      process.stdout.write(`${paint(colors.red, `评估失败：${error.message}`)}\n\n`);
      continue;
    }
    evaluationSpinner.stop(true);
    scores.push(evaluation.score);
    rememberEnglish(evaluation.corrected_answer);

    process.stdout.write(`${formatQuizFeedback(evaluation, question, width)}\n`);
  }

  if (scores.length) {
    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    process.stdout.write(`${paint(colors.bold + colors.yellow, "本次完成")}  ${scores.length} 题 · 平均 ${average}/100\n\n`);
  } else {
    process.stdout.write(`${paint(colors.gray, "本次未完成题目。")}\n\n`);
  }
}
