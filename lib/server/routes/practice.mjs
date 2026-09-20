import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { getQuizRecords } from "../../features/quiz/context.mjs";
import { getWordQuizCards } from "../../features/quiz/word-context.mjs";
import { getQuizHistory, isNovelQuizQuestion, saveQuizQuestions } from "../../features/quiz/history.mjs";
import { QUIZ_EVALUATION_SCHEMA, QUIZ_EVALUATOR_PROMPT, parseQuizEvaluation } from "../../features/quiz/prompts.mjs";
import { WORD_QUIZ_EVALUATOR_PROMPT } from "../../features/quiz/word-prompts.mjs";
import {
  PRACTICE_QUESTIONS_SCHEMA,
  PRACTICE_WRITER_PROMPT,
  parsePracticeQuestions,
} from "../../features/quiz/practice-prompts.mjs";
import { PRACTICE_CONTEXTS } from "../../features/practice/contexts.mjs";
import { savePracticeAttempt } from "../../features/practice/attempts.mjs";

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
}

function isRateLimitError(error) {
  return error?.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/i.test(error?.message || "");
}

function isValidQuestion(question, mode, records, cards) {
  if (question.kind !== mode && mode !== "mixed") return false;
  if (question.kind === "sentence" && !records.length) return false;
  if (question.kind === "expression" && !cards.some((card) => card.word.toLowerCase() === question.target_word.toLowerCase())) return false;
  return true;
}

export function registerPracticeRoutes({ getLLMManager, persistPracticeAttempt = savePracticeAttempt }) {
  register("POST", "/practice/generate", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const count = Number(body?.count ?? 5);
    const mode = ["sentence", "expression", "mixed"].includes(body?.mode) ? body.mode : "mixed";
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      json(res, 400, { error: "'count' must be an integer between 1 and 10" });
      return;
    }

    let llm;
    try {
      const records = await getQuizRecords(30, Math.min(50, count * 4));
      const cards = await getWordQuizCards({ limit: Math.min(50, count * 4) });
      if (mode === "sentence" && !records.length) throw new Error("No grammar records found for sentence practice");
      if (mode === "expression" && !cards.length) throw new Error("No saved vocabulary found for expression practice");
      if (mode === "mixed" && !records.length && !cards.length) throw new Error("No learning records found for practice");

      const history = await getQuizHistory(500);
      const usedQuestions = [...history];
      const questions = [];
      llm = await getLLMManager();
      for (let index = 0; index < count; index++) {
        const requestedKind = mode === "mixed"
          ? (index % 2 === 0 && records.length ? "sentence" : cards.length ? "expression" : "sentence")
          : mode;
        let question = null;
        for (let attempt = 0; attempt < 4 && !question; attempt++) {
          const input = JSON.stringify({
            requested_count: 1,
            requested_kind: requestedKind,
            grammar_records: records,
            vocabulary: cards,
            excluded_prompts: usedQuestions.slice(-100).map((item) => item.chinese || item.prompt_zh || item.prompt || item),
            previous_questions: questions.map((item) => ({ kind: item.kind, prompt_zh: item.prompt_zh, target_word: item.target_word, focus: item.focus, context: item.context })),
            variation_plan: {
              context_label: PRACTICE_CONTEXTS[index % PRACTICE_CONTEXTS.length],
              setting: ["work update", "email", "meeting", "scheduling", "customer issue", "travel", "home routine", "learning", "social plans"][index % 9],
              purpose: ["request", "explanation", "follow-up", "comparison", "apology", "decision", "prediction", "status update"][index % 8],
            },
          });
          const raw = await llm.generateWithFallback(input, PRACTICE_WRITER_PROMPT, {
            taskType: "practice",
            jsonSchema: PRACTICE_QUESTIONS_SCHEMA,
          });
          const candidate = parsePracticeQuestions(raw)[0];
          if (candidate && isValidQuestion(candidate, requestedKind, records, cards)
            && isNovelQuizQuestion({ chinese: candidate.prompt_zh }, usedQuestions)) {
            question = candidate;
          }
        }
        if (question) {
          questions.push(question);
          usedQuestions.push({ chinese: question.prompt_zh });
        }
      }
      if (!questions.length) throw new Error("The model did not generate sufficiently varied practice questions");
      await saveQuizQuestions(questions.map((question) => ({
        chinese: question.prompt_zh,
        reference_answer: question.reference_answer,
        error_type: question.kind === "expression" ? "Expression" : question.error_type,
      })));
      json(res, 200, { data: { questions, mode }, perf: { total_ms: performance.now() - startTime } });
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      json(res, isRateLimitError(error) ? 429 : 500, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });

  register("POST", "/practice/evaluate", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const answer = String(body?.answer || "").trim();
    const question = body?.question;
    if (!answer || !question?.kind || !question?.prompt_zh || !question?.reference_answer) {
      json(res, 400, { error: "Missing practice answer or question context" });
      return;
    }
    let llm;
    try {
      llm = await getLLMManager();
      const input = JSON.stringify(question.kind === "expression"
        ? { target_word: question.target_word, chinese_scenario: question.prompt_zh, reference_answer: question.reference_answer, learner_answer: answer, usage_focus: question.focus || "" }
        : { chinese_prompt: question.prompt_zh, reference_answer: question.reference_answer, learner_answer: answer, grammar_focus: question.focus || "", error_type: question.error_type || "" });
      const prompt = question.kind === "expression" ? WORD_QUIZ_EVALUATOR_PROMPT : QUIZ_EVALUATOR_PROMPT;
      const raw = await llm.generateWithFallback(input, prompt, { taskType: "practice", jsonSchema: QUIZ_EVALUATION_SCHEMA });
      const evaluation = parseQuizEvaluation(raw, question.reference_answer);
      await persistPracticeAttempt({
        activityType: question.kind === "expression" ? "practice-expression" : "practice-sentence",
        targetErrorType: question.error_type || null,
        targetPattern: question.focus || null,
        contextLabel: question.context || null,
        prompt: question.prompt_zh,
        learnerAnswer: answer,
        referenceAnswer: question.reference_answer,
        score: evaluation.score,
        feedback: evaluation,
      });
      json(res, 200, { data: evaluation, perf: { total_ms: performance.now() - startTime } });
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      json(res, isRateLimitError(error) ? 429 : 500, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });
}
