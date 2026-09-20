import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { getQuizRecords } from "../../features/quiz/context.mjs";
import { getQuizHistory, isNovelQuizQuestion, saveQuizQuestions } from "../../features/quiz/history.mjs";
import {
  QUIZ_EVALUATION_SCHEMA,
  QUIZ_EVALUATOR_PROMPT,
  QUIZ_QUESTIONS_SCHEMA,
  QUIZ_WRITER_PROMPT,
  parseQuizEvaluation,
  parseQuizQuestions,
} from "../../features/quiz/prompts.mjs";
import { PRACTICE_CONTEXTS } from "../../features/practice/contexts.mjs";
import { savePracticeAttempt } from "../../features/practice/attempts.mjs";

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
}

function isRateLimitError(error) {
  return error?.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/i.test(error?.message || "");
}

export function registerQuizRoutes({
  getLLMManager,
  loadQuizRecords = getQuizRecords,
  loadQuizHistory = getQuizHistory,
  persistQuizQuestions = saveQuizQuestions,
  persistPracticeAttempt = savePracticeAttempt,
}) {
  register("POST", "/quiz/generate", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const count = Number(body?.count ?? 5);
    const days = Number(body?.days ?? 30);
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      json(res, 400, { error: "'count' must be an integer between 1 and 10" });
      return;
    }
    if (!Number.isInteger(days) || days < 0 || days > 3650) {
      json(res, 400, { error: "'days' must be an integer between 0 and 3650" });
      return;
    }

    let llm;
    try {
      const records = await loadQuizRecords(days, Math.min(50, count * 5));
      if (!records.length) {
        json(res, 422, { error: "No handbook records found for the selected period" });
        return;
      }
      const history = await loadQuizHistory(500);
      llm = await getLLMManager();
      const questions = [];
      const usedQuestions = [...history];
      let lastParseError = null;
      for (let index = 0; index < count; index++) {
        let question = null;
        for (let attempt = 0; attempt < 3 && !question; attempt++) {
          const retryInstruction = attempt === 0
            ? ""
            : "\n\nYour previous response was rejected because it was a duplicate/similar prompt, a prompt was a meta-task, a reference answer was not English, or the JSON was malformed. Generate one genuinely different everyday translation sentence and obey every field constraint exactly.";
          const input = JSON.stringify({
            requested_count: 1,
            question_number: index + 1,
            handbook_records: records,
            excluded_questions: usedQuestions.slice(-80).map((item) => item.chinese || item.prompt || item),
            context_plan: PRACTICE_CONTEXTS[index % PRACTICE_CONTEXTS.length],
          });
          const raw = await llm.generateWithFallback(input, QUIZ_WRITER_PROMPT + retryInstruction, {
            taskType: "practice",
            jsonSchema: QUIZ_QUESTIONS_SCHEMA,
          });
          let candidate;
          try {
            candidate = parseQuizQuestions(raw, 1);
          } catch (error) {
            lastParseError = error;
            continue;
          }
          question = candidate[0] && isNovelQuizQuestion(candidate[0], usedQuestions) ? candidate[0] : null;
        }
        if (question) {
          questions.push(question);
          usedQuestions.push(question);
        }
      }
      if (!questions.length) {
        throw new Error(lastParseError ? "The model returned malformed quiz JSON twice; please try /quiz again" : "The model did not generate any usable quiz questions");
      }
      await persistQuizQuestions(questions);
      json(res, 200, {
        data: { questions, record_count: records.length, days },
        perf: { total_ms: performance.now() - startTime },
      });
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      json(res, isRateLimitError(error) ? 429 : 500, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });

  register("POST", "/quiz/evaluate", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const answer = String(body?.answer || "").trim();
    const question = body?.question;
    if (!answer) {
      json(res, 400, { error: "Missing 'answer' field" });
      return;
    }
    if (!question?.chinese || !question?.reference_answer) {
      json(res, 400, { error: "Missing quiz question context" });
      return;
    }

    let llm;
    try {
      llm = await getLLMManager();
      const input = JSON.stringify({
        chinese_prompt: question.chinese,
        reference_answer: question.reference_answer,
        learner_answer: answer,
        grammar_focus: question.focus || "",
        error_type: question.error_type || "",
      });
      const raw = await llm.generateWithFallback(input, QUIZ_EVALUATOR_PROMPT, {
        taskType: "practice",
        jsonSchema: QUIZ_EVALUATION_SCHEMA,
      });
      const evaluation = parseQuizEvaluation(raw, question.reference_answer);
      await persistPracticeAttempt({
        activityType: "quiz",
        targetErrorType: question.error_type || null,
        targetPattern: question.focus || null,
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
