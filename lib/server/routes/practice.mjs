import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { QUIZ_EVALUATION_SCHEMA, QUIZ_EVALUATOR_PROMPT, parseQuizEvaluation } from "../../features/quiz/prompts.mjs";
import { getPracticeQuestions, getPracticeQuestion, validatePracticeFilters, publicPracticeQuestion } from "../../features/practice/question-bank.mjs";
import { savePracticeAttempt } from "../../features/practice/attempts.mjs";
import { errorPayload } from "../../contracts/errors.mjs";

function json(res, status, payload) {
  if (typeof payload?.error === "string") payload = { ...payload, ...errorPayload(status >= 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST", payload.error, status >= 500) };
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
}

export function registerPracticeRoutes({ getLLMManager, persistPracticeAttempt = savePracticeAttempt,
  appendPracticeLog = null, config = null, selectQuestions = getPracticeQuestions, findQuestion = getPracticeQuestion }) {
  register("POST", "/practice/generate", async (_req, res, { body }) => {
    const startTime = performance.now();
    let filters;
    try {
      if (body?.mode && body.mode !== "sentence") throw new Error("Practice supports sentence translation only.");
      filters = validatePracticeFilters(body || {});
    } catch (error) {
      return json(res, 400, { error: error.message });
    }
    try {
      const selected = await selectQuestions(filters);
      const questions = selected.map(publicPracticeQuestion);
      json(res, 200, { data: { questions, mode: "sentence", ...filters, requested_count: filters.count }, perf: { total_ms: performance.now() - startTime } });
    } catch {
      json(res, 500, { error: "Could not load practice questions. Please try again." });
    }
  });

  register("POST", "/practice/evaluate", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const id = body?.question?.id;
    const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
    const hintsUsed = body?.hints_used ?? 0;
    if (!Number.isInteger(hintsUsed) || hintsUsed < 0 || hintsUsed > 3) return json(res, 400, { error: "Hint count must be an integer between 0 and 3." });
    if (typeof id !== "string" || !id || !answer) return json(res, 400, { error: "A question ID and English answer are required." });
    try {
      const question = await findQuestion(id);
      if (!question) return json(res, 400, { error: "This question is unavailable. Please start a new session." });
      const llm = await getLLMManager();
      const raw = await llm.generateWithFallback(JSON.stringify({
        chinese_prompt: question.prompt_zh, reference_answer: question.reference_answer,
        learner_answer: answer, grammar_focus: question.focus,
        difficulty: question.difficulty, style: question.style, context: question.context,
        language_categories: question.metadata,
        alternative_guidance: question.alternative_note,
      }), QUIZ_EVALUATOR_PROMPT + "\nConsider the requested style and context, while accepting equivalent translations. Do not demand an exact match to the reference. The learning focus is a guided route, not a mandatory wording constraint: do not mark equivalent English wrong for using another construction. You may explain whether it practises the focus separately from correctness.", { taskType: "practice", jsonSchema: QUIZ_EVALUATION_SCHEMA });
      const evaluation = { ...parseQuizEvaluation(raw, question.reference_answer), reference_answer: question.reference_answer };
      const attempt = {
        activityType: "practice-sentence", targetErrorType: question.error_type,
        targetPattern: question.focus, contextLabel: question.context,
        prompt: question.prompt_zh, learnerAnswer: answer, referenceAnswer: question.reference_answer,
        score: evaluation.score,
        feedback: { ...evaluation, question_id: question.id, difficulty: question.difficulty, style: question.style, context: question.context,
          focus_id: question.focus_id, variant: question.variant, language_categories: question.metadata, hints_used: hintsUsed },
      };
      await persistPracticeAttempt(attempt);
      let persistence = null;
      if (appendPracticeLog) {
        try { persistence = await appendPracticeLog({ attempt, config: config || {} }); }
        catch { persistence = { saved: false, warning: "Your answer was reviewed, but this attempt could not be saved to the Practice Log." }; }
      }
      json(res, 200, { data: evaluation, persistence, perf: { total_ms: performance.now() - startTime } });
    } catch (error) {
      const rateLimited = error?.status === 429 || /429|quota|rate.?limit|resource.*exhaust/i.test(error?.message || "");
      json(res, rateLimited ? 429 : 500, { error: rateLimited ? "Answer review is busy. Please try again shortly." : "Could not review your answer. Please try again." });
    }
  });
}
