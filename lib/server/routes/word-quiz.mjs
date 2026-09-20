import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { getWordQuizCards } from "../../features/quiz/word-context.mjs";
import { QUIZ_EVALUATION_SCHEMA, parseQuizEvaluation } from "../../features/quiz/prompts.mjs";
import {
  WORD_QUIZ_EVALUATOR_PROMPT,
  WORD_QUIZ_QUESTIONS_SCHEMA,
  WORD_QUIZ_WRITER_PROMPT,
  parseWordQuizQuestions,
} from "../../features/quiz/word-prompts.mjs";
import { savePracticeAttempt } from "../../features/practice/attempts.mjs";

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
}

function isRateLimitError(error) {
  return error?.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/i.test(error?.message || "");
}

export function registerWordQuizRoutes({
  getLLMManager,
  loadWordQuizCards = getWordQuizCards,
  persistPracticeAttempt = savePracticeAttempt,
}) {
  register("POST", "/word-quiz/generate", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const count = Number(body?.count ?? 5);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      json(res, 400, { error: "'count' must be an integer between 1 and 10" });
      return;
    }

    let llm;
    try {
      const cards = await loadWordQuizCards({ limit: count });
      if (!cards.length) {
        json(res, 422, { error: "No saved vocabulary found. Use /add <word> to save words first." });
        return;
      }
      llm = await getLLMManager();
      const input = JSON.stringify({
        requested_count: cards.length,
        vocabulary: cards,
      });
      const raw = await llm.generateWithFallback(input, WORD_QUIZ_WRITER_PROMPT, {
        taskType: "practice",
        jsonSchema: WORD_QUIZ_QUESTIONS_SCHEMA,
      });
      const cardByWord = new Map(cards.map((card) => [String(card.word).toLowerCase(), card]));
      const questions = parseWordQuizQuestions(raw, count).map((question) => ({
        ...question,
        pos: cardByWord.get(question.word.toLowerCase())?.pos || "",
      }));
      if (!questions.length) {
        throw new Error("The model returned malformed word quiz JSON; please try /word quiz again");
      }
      json(res, 200, {
        data: { questions, vocab_count: cards.length },
        perf: { total_ms: performance.now() - startTime },
      });
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      json(res, isRateLimitError(error) ? 429 : 500, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });

  register("POST", "/word-quiz/evaluate", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const answer = String(body?.answer || "").trim();
    const question = body?.question;
    if (!answer) {
      json(res, 400, { error: "Missing 'answer' field" });
      return;
    }
    if (!question?.word || !question?.chinese || !question?.reference_answer) {
      json(res, 400, { error: "Missing word quiz question context" });
      return;
    }

    let llm;
    try {
      llm = await getLLMManager();
      const input = JSON.stringify({
        target_word: question.word,
        chinese_scenario: question.chinese,
        reference_answer: question.reference_answer,
        learner_answer: answer,
        usage_focus: question.focus || "",
      });
      const raw = await llm.generateWithFallback(input, WORD_QUIZ_EVALUATOR_PROMPT, {
        taskType: "practice",
        jsonSchema: QUIZ_EVALUATION_SCHEMA,
      });
      const evaluation = parseQuizEvaluation(raw, question.reference_answer);
      await persistPracticeAttempt({
        activityType: "word-quiz",
        targetErrorType: "Vocabulary / Usage",
        targetPattern: question.word,
        contextLabel: question.context || null,
        prompt: question.chinese,
        learnerAnswer: answer,
        referenceAnswer: question.reference_answer,
        score: evaluation.score,
        feedback: evaluation,
      });
      json(res, 200, {
        data: evaluation,
        perf: { total_ms: performance.now() - startTime },
      });
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      json(res, isRateLimitError(error) ? 429 : 500, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });
}
