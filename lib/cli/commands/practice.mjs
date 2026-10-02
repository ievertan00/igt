import { validatePracticeFilters } from "../../features/practice/question-bank.mjs";
import { api } from "../api-client.mjs";
import { rememberEnglish } from "./listen.mjs";
import { formatQuizFeedback } from "./quiz.mjs";
import { cols } from "./render.mjs";
import { colors, paint, Spinner } from "../ui/index.mjs";

async function runProductionPractice(count, filters, ctx) {
  const spinner = new Spinner("正在读取句子练习");
  spinner.start();
  let questions;
  try {
    const response = await api.generatePractice("sentence", count, filters);
    questions = response.data?.questions || [];
  } catch (error) {
    spinner.stop(true);
    process.stdout.write(`${paint(colors.red, `读取练习失败：${error.message}`)}\n\n`);
    return;
  }
  spinner.stop(true);
  if (!questions.length) {
    process.stdout.write(paint(colors.yellow, "没有符合分类的题目，请选择其他分类。\n\n"));
    return;
  }
  if (questions.length < count) process.stdout.write(paint(colors.yellow, `当前分类有 ${questions.length} 道题，将练习全部可用题目。\n`));

  const width = Math.min(110, Math.max(60, cols() - 4));
  const scores = [];
  process.stdout.write(`\n  ${paint(colors.bold + colors.yellow, "中译英句子练习")}\n`);
  process.stdout.write(paint(colors.gray, "每题先独立写出完整英文；输入 h 逐步查看提示，输入 q 可结束本段练习。\n\n"));
  for (let index = 0; index < questions.length; index++) {
    const question = questions[index];
    const label = [question.difficulty, question.style, question.context].join(" · ");
    process.stdout.write(`${paint(colors.cyan + colors.bold, `题目 ${index + 1}/${questions.length}`)}  ${paint(colors.gray, label)}\n`);
    process.stdout.write(`${paint(colors.gray, "中文句子")}\n  ${question.prompt_zh}\n`);
    if (question.focus_id) process.stdout.write(paint(colors.gray, `学习重点：${question.focus_id} · ${question.focus}\n`));
    const hints = [question.hints?.simple, question.hints?.intermediate, question.hints?.complete].filter(Boolean);
    const hintLabels = ["简单提示", "中级提示", "完整模式"];
    let hintsUsed = 0;

    let answer = "";
    while (!answer) {
      const line = await ctx.askLine(ctx.rl, paint(colors.gray, "你的英文表达 ❯ "));
      answer = line === null ? "q" : line.trim();
      if (answer.toLowerCase() === "h") {
        if (hintsUsed < hints.length) {
          process.stdout.write(`${paint(colors.cyan, hintLabels[hintsUsed])}：${hints[hintsUsed]}\n`);
          hintsUsed++;
        } else process.stdout.write(paint(colors.gray, "没有更多提示，请根据已有模式组织自己的英文。\n"));
        answer = "";
        continue;
      }
      if (answer.toLowerCase() === "q") break;
      if (!answer) process.stdout.write(paint(colors.yellow, "请输入完整英文表达，或输入 q 结束。\n"));
    }
    if (answer.toLowerCase() === "q") break;

    const evaluationSpinner = new Spinner("正在评估你的表达");
    evaluationSpinner.start();
    try {
      const response = await api.evaluatePractice(question, answer, hintsUsed);
      const evaluation = response.data;
      scores.push(evaluation.score);
      rememberEnglish(evaluation.corrected_answer);
      process.stdout.write(`${formatQuizFeedback(evaluation, { ...question, reference_answer: evaluation.reference_answer }, width)}\n`);
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

export async function runPractice(args, ctx) {
  const filters = { difficulty: "standard", style: "all", context: "all" };
  let count = 3;
  let hasCount = false;
  try {
    for (let index = 0; index < args.length; index++) {
      const arg = args[index];
      if (arg === "sentence") continue;
      if (/^\d+$/.test(arg) && !hasCount) { count = Number(arg); hasCount = true; continue; }
      const key = arg.startsWith("--") ? arg.slice(2) : "";
      if (!Object.hasOwn(filters, key) || !args[index + 1]) throw new Error("Invalid option");
      filters[key] = args[++index];
    }
    validatePracticeFilters({ count, ...filters });
  } catch {
    process.stdout.write(paint(colors.yellow, "Usage: /practice [sentence] [1-10] [--difficulty easy|standard|challenge] [--style all|casual|neutral|formal] [--context all|everyday|work|travel]\n\n"));
    return;
  }
  await runProductionPractice(count, filters, ctx);
}
