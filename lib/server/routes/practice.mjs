import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { evaluatePracticeAnswer } from "../../application/practice-evaluation.mjs";
import { getPracticeQuestions, getPracticeQuestion, validatePracticeFilters, publicPracticeQuestion } from "../../features/practice/question-bank.mjs";
import { savePracticeAttempt } from "../../features/practice/attempts.mjs";
import { errorPayload } from "../../contracts/errors.mjs";

function json(res, status, payload) {
  if (typeof payload?.error === "string") payload = { ...payload, ...errorPayload(status >= 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST", payload.error, status >= 500) };
  res.writeHead(status, { "Content-Type": "application/json" });
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
      const questions = selected.map((question) => ({ ...publicPracticeQuestion(question), ...(filters.targetErrorType ? { target_error_type: filters.targetErrorType } : {}) }));
      json(res, 200, { data: { questions, mode: "sentence", ...filters, requested_count: filters.count }, perf: { total_ms: performance.now() - startTime } });
    } catch {
      json(res, 500, { error: "Could not load practice questions. Please try again." });
    }
  });

  register("POST", "/practice/evaluate", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    try {
      const result = await evaluatePracticeAnswer({
        id: body?.question?.id,
        answer: body?.answer,
        hintsUsed: body?.hints_used,
        targetErrorType: body?.question?.target_error_type || "",
      }, { findQuestion, getLLMManager, persistPracticeAttempt, appendPracticeLog, config });
      if (result.error) return json(res, 400, result);
      json(res, 200, { ...result, perf: { total_ms: performance.now() - startTime } });
    } catch (error) {
      const rateLimited = error?.status === 429 || /429|quota|rate.?limit|resource.*exhaust/i.test(error?.message || "");
      json(res, rateLimited ? 429 : 500, { error: rateLimited ? "Answer review is busy. Please try again shortly." : "Could not review your answer. Please try again." });
    }
  });
}
