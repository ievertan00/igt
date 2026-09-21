import { api } from "../api-client.mjs";
import { rememberEnglish } from "./listen.mjs";
import { formatQuizFeedback } from "./quiz.mjs";
import { cols } from "./render.mjs";
import { colors, paint, Spinner } from "../ui/index.mjs";

function parsePracticeArgs(args) {
  const modeArg = args.find((arg) => ["mixed", "sentence", "expression"].includes(arg.toLowerCase()));
  const countArg = args.find((arg) => /^\d+$/.test(arg));
  return {
    mode: modeArg?.toLowerCase() || "mixed",
    count: countArg ? Number(countArg) : 6,
  };
}

async function runProductionPractice(mode, count, ctx) {
  const spinner = new Spinner("正在生成不重复的句子和表达练习");
  spinner.start();
  let questions;
  try {
    const response = await api.generatePractice(mode, count);
    questions = response.data?.questions || [];
  } catch (error) {
    spinner.stop(true);
    process.stdout.write(`${paint(colors.red, `生成练习失败：${error.message}`)}\n\n`);
    return;
  }
  spinner.stop(true);
  if (!questions.length) {
    process.stdout.write(paint(colors.yellow, "这次没有生成可用的产出题，请稍后重试。\n\n"));
    return;
  }

  const width = Math.min(110, Math.max(60, cols() - 4));
  const scores = [];
  process.stdout.write(`\n  ${paint(colors.bold + colors.yellow, "句子与表达产出")}\n`);
  process.stdout.write(paint(colors.gray, "每题先独立写出完整英文；输入 q 可结束本段练习。\n\n"));
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const label = question.kind === "expression" ? "表达场景" : "句子场景";
    process.stdout.write(`${paint(colors.cyan + colors.bold, `题目 ${index + 1}/${questions.length}`)}  ${paint(colors.gray, label)}\n`);
    if (question.target_word) {
      process.stdout.write(`${paint(colors.gray, "目标表达")} ${paint(colors.bold + colors.yellow, question.target_word)}\n`);
    }
    process.stdout.write(`${paint(colors.gray, "场景")}\n  ${question.prompt_zh}\n`);
    if (question.hint) process.stdout.write(`${paint(colors.gray, "提示")}\n  ${question.hint}\n`);

    let answer = "";
    while (!answer) {
      const line = await ctx.askLine(ctx.rl, paint(colors.gray, "你的英文表达 ❯ "));
      answer = line === null ? "q" : line.trim();
      if (answer.toLowerCase() === "q") break;
      if (!answer) process.stdout.write(paint(colors.yellow, "请输入完整英文表达，或输入 q 结束。\n"));
    }
    if (answer.toLowerCase() === "q") break;

    const evaluationSpinner = new Spinner("正在评估你的表达");
    evaluationSpinner.start();
    try {
      const response = await api.evaluatePractice(question, answer);
      const evaluation = response.data;
      scores.push(evaluation.score);
      rememberEnglish(evaluation.corrected_answer);
      process.stdout.write(`${formatQuizFeedback(evaluation, question, width)}\n`);
    } catch (error) {
      process.stdout.write(`${paint(colors.red, `评估失败：${error.message}`)}\n\n`);
    } finally {
      evaluationSpinner.stop(true);
    }
  }
  if (scores.length) {
    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    process.stdout.write(`${paint(colors.bold + colors.yellow, "本段完成")}  ${scores.length} 题 · 平均 ${average}/100\n\n`);
  }
}

export async function runChoicePractice(args, ctx) {
  const countArg = args.find((arg) => /^\d+$/.test(arg));
  const count = countArg ? Number(countArg) : 5;
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    process.stdout.write(paint(colors.yellow, "Usage: /practice choice [1-10]\n\n"));
    return;
  }

  const spinner = new Spinner("正在生成选择题练习");
  spinner.start();
  let questions;
  try {
    const response = await api.generatePractice("choice", count);
    questions = response.data?.questions || [];
  } catch (error) {
    spinner.stop(true);
    process.stdout.write(`${paint(colors.red, `生成练习失败：${error.message}`)}\n\n`);
    return;
  }
  spinner.stop(true);
  if (!questions.length) {
    process.stdout.write(paint(colors.yellow, "这次没有生成可用的选择题，请稍后重试。\n\n"));
    return;
  }

  const width = Math.min(110, Math.max(60, cols() - 4));
  const scores = [];
  process.stdout.write(`\n  ${paint(colors.bold + colors.yellow, "选择题语法练习")}\n`);
  process.stdout.write(paint(colors.gray, "先独立判断，再把规则用于自己的表达；输入 q 可结束。\n\n"));
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    process.stdout.write(`${paint(colors.cyan + colors.bold, `题目 ${index + 1}/${questions.length}`)}  ${paint(colors.gray, question.error_type || "Grammar")}\n`);
    process.stdout.write(`${paint(colors.gray, "题目")}\n  ${question.question}\n`);
    question.options.forEach((option, optionIndex) => {
      process.stdout.write(`  ${paint(colors.cyan, `${String.fromCharCode(65 + optionIndex)}.`)} ${option}\n`);
    });
    process.stdout.write("\n");

    const answer = (await ctx.askLine(ctx.rl, paint(colors.gray, "你的选择 (A/B/C/D) ❯ ")) || "q").trim();
    if (answer.toLowerCase() === "q") break;
    try {
      const response = await api.evaluatePractice(question, answer);
      const evaluation = response.data;
      scores.push(evaluation.score);
      rememberEnglish(evaluation.corrected_answer);
      process.stdout.write(`${formatQuizFeedback(evaluation, { reference_answer: question.answer }, width)}\n`);
    } catch (error) {
      process.stdout.write(`${paint(colors.red, `评估失败：${error.message}`)}\n\n`);
    }
  }
  if (scores.length) {
    const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    process.stdout.write(`${paint(colors.bold + colors.yellow, "本次完成")}  ${scores.length} 题 · 平均 ${average}/100\n\n`);
  }
}

export async function runPractice(args, ctx) {
  const { mode, count } = parsePracticeArgs(args);
  const validModes = new Set(["mixed", "sentence", "expression"]);
  const hasInvalidArg = args.some((arg) => !/^\d+$/.test(arg) && !validModes.has(arg.toLowerCase()));
  if (hasInvalidArg || !Number.isInteger(count) || count < 3 || count > 12) {
    process.stdout.write(paint(colors.yellow, "Usage: /practice [mixed|sentence|expression] [3-12]\n\n"));
    return;
  }

  process.stdout.write(`\n${paint(colors.bold + colors.yellow, "Practice Session")}\n`);
  process.stdout.write(paint(colors.gray, mode === "mixed"
    ? "先回忆，再造句，最后在真实场景里使用表达。输入 q 可提前结束当前模块。\n\n"
    : `当前模式：${mode} · 目标：主动产出，而不是只认答案。\n\n`));

  if (mode === "sentence") {
    await runProductionPractice("sentence", count, ctx);
    return;
  }
  if (mode === "expression") {
    await runProductionPractice("expression", count, ctx);
    return;
  }

  process.stdout.write(paint(colors.cyan, "句子与表达产出\n"));
  await runProductionPractice("mixed", count, ctx);
}
