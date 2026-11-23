import { QUIZ_EVALUATION_SCHEMA, QUIZ_EVALUATOR_PROMPT, parseQuizEvaluation } from "../features/quiz/prompts.mjs";
import { matchesHandbookTarget } from "../features/practice/handbook-targets.mjs";

export async function evaluatePracticeAnswer(
  { id, answer: learnerAnswer, hintsUsed: hintCount, targetErrorType = "" },
  { findQuestion, getLLMManager, persistPracticeAttempt, appendPracticeLog, config },
) {
  const hintsUsed = hintCount ?? 0;
  const answer = typeof learnerAnswer === "string" ? learnerAnswer.trim() : "";
  if (!Number.isInteger(hintsUsed) || hintsUsed < 0 || hintsUsed > 3) {
    return { error: "Hint count must be an integer between 0 and 3." };
  }
  if (typeof id !== "string" || !id || !answer) {
    return { error: "A question ID and English answer are required." };
  }

  const question = await findQuestion(id);
  if (!question) return { error: "This question is unavailable. Please start a new session." };
  if (targetErrorType && (question.active === 0 || !matchesHandbookTarget(question, targetErrorType))) {
    return { error: "This question does not match the requested learning target. Please start a new session." };
  }
  const llm = await getLLMManager();
  const raw = await llm.generateWithFallback(JSON.stringify({
    chinese_prompt: question.prompt_zh, reference_answer: question.reference_answer,
    learner_answer: answer, grammar_focus: question.focus,
    difficulty: question.difficulty, style: question.style, context: question.context,
    language_categories: question.metadata,
    practice_fields: question.practice_fields,
    ...(targetErrorType ? { requested_learning_target: targetErrorType } : {}),
  }), QUIZ_EVALUATOR_PROMPT + "\nConsider the requested style and context, while accepting equivalent translations. Do not demand an exact match to the reference. The learning focus is a guided route, not a mandatory wording constraint: do not mark equivalent English wrong for using another construction. You may explain whether it practises the focus separately from correctness.", { taskType: "practice", jsonSchema: QUIZ_EVALUATION_SCHEMA });
  const evaluation = { ...parseQuizEvaluation(raw, question.reference_answer), reference_answer: question.reference_answer };
  const attempt = {
    activityType: "practice-sentence", targetErrorType: targetErrorType || question.error_type,
    targetPattern: question.focus, contextLabel: question.context,
    prompt: question.prompt_zh, learnerAnswer: answer, referenceAnswer: question.reference_answer,
    score: evaluation.score,
    feedback: { ...evaluation, question_id: question.id, difficulty: question.difficulty, style: question.style, context: question.context,
      language_categories: question.metadata,
      practice_fields: question.practice_fields, hints_used: hintsUsed,
      ...(targetErrorType ? { source: "handbook", target_error_type: targetErrorType, target_assessment: "not-assessed" } : {}) },
  };
  await persistPracticeAttempt(attempt);
  let persistence = null;
  if (appendPracticeLog) {
    try {
      persistence = await appendPracticeLog({ attempt, config: config || {} });
    } catch {
      persistence = {
        saved: false,
        warning: "Your answer was reviewed, but this attempt could not be saved to the Practice Log.",
      };
    }
  }

  return { data: evaluation, persistence };
}
