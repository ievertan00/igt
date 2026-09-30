import { parseJson } from "./prompts.mjs";
import { PRACTICE_CONTEXTS, normalizePracticeContext } from "../practice/contexts.mjs";

export const PRACTICE_QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["sentence", "expression"] },
          prompt_zh: { type: "string" },
          target_word: { type: "string" },
          reference_answer: { type: "string" },
          focus: { type: "string" },
          error_type: { type: "string" },
          hint: { type: "string" },
          context: { type: "string", enum: PRACTICE_CONTEXTS },
        },
        required: ["kind", "prompt_zh", "target_word", "reference_answer", "focus"],
      },
    },
  },
  required: ["questions"],
};

export const PRACTICE_WRITER_PROMPT = `You create production practice for a Chinese-speaking English learner.
The input JSON contains a requested mode, real learner error records, saved vocabulary, already-used prompts, and a variation plan.
If retry_instruction is present, follow it before generating the question.

Create exactly one fresh question. The learner must produce English, not choose an option.

Question kinds:
- sentence: a natural Chinese situation that makes the learner produce one complete English sentence. Use one recurring grammar weakness from the records, but do not copy the old sentence.
- expression: a natural Chinese situation that makes the learner use a useful English word or phrase in a realistic sentence. When vocabulary is supplied, use one exact target_word from it and test a useful collocation, preposition, register, or discourse function. When vocabulary is empty, choose a common useful target_word yourself.
- Always include the target_word field. For sentence questions, set target_word to an empty string. For expression questions, target_word must be present and must exactly match the vocabulary item or chosen word.

Variation rules are mandatory:
- Do not reuse the same Chinese sentence pattern, subject, verb, tense, or setting as the previous questions.
- Rotate settings such as work update, email, meeting, scheduling, customer issue, travel, home routine, health, learning, and social plans.
- Rotate communicative purposes such as request, explanation, refusal, comparison, follow-up, apology, decision, prediction, and status update.
- Prefer different grammar structures across questions: tense, modal, condition, passive, relative clause, reported speech, comparison, or phrasal verb when appropriate.
- Never mention the learner's records, errors, prompts, rules, or the act of translation.
- The Chinese prompt must be one short real-life scenario, not a meta instruction.
- reference_answer must be English only and match the Chinese meaning.
- For expression questions, target_word must be exactly one supplied vocabulary word or phrase.
- "context" must be one of: ${PRACTICE_CONTEXTS.join(", ")}. Use the context_label from the variation plan.
- Return only JSON matching the schema.`;

export const PRACTICE_RETRY_INSTRUCTION = `Your previous response was rejected because it was invalid or too similar to a recent question. Generate a different valid question. Do not reuse any excluded prompt, sentence, or answer pattern. For expression questions, include a non-empty target_word field.`;

export const CHOICE_RETRY_INSTRUCTION = `Your previous response was rejected because it repeated a recent question. Generate a clearly different sentence and grammar point. Do not reuse any excluded question.`;

export const CHOICE_QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["choice"] },
          question: { type: "string" },
          options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
          answer: { type: "string" },
          explanation: { type: "string" },
          error_type: { type: "string" },
          context: { type: "string", enum: PRACTICE_CONTEXTS },
        },
        required: ["kind", "question", "options", "answer", "explanation"],
      },
    },
  },
  required: ["questions"],
};

export const CHOICE_WRITER_PROMPT = `You create one fresh multiple-choice grammar question for a Chinese-speaking English learner.
If retry_instruction is present, follow it before generating the question.
When grammar error records are supplied, use them to target a recurring problem while writing a new everyday sentence. If there are no records, create a useful general question about a common English grammar point.
Return exactly four options, one correct answer, and a short explanation. The answer must exactly match one option.
Do not mention the learner's records or the generation process. Return only JSON matching the schema.`;

export function parsePracticeQuestions(raw) {
  const parsed = parseJson(raw);
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return questions
    .filter((item) => item && String(item.prompt_zh || "").trim() && String(item.reference_answer || "").trim())
    .map((item) => ({
      kind: item.kind === "expression" ? "expression" : "sentence",
      prompt_zh: String(item.prompt_zh).trim(),
      target_word: String(item.target_word || "").trim(),
      reference_answer: String(item.reference_answer).trim(),
      focus: String(item.focus || "Natural English expression").trim(),
      error_type: String(item.error_type || "General").trim(),
      hint: String(item.hint || "").trim(),
      context: normalizePracticeContext(item.context),
    }))
    .filter((item) => item.prompt_zh.length <= 160
      && !/[\r\n]/.test(item.prompt_zh)
      && /[A-Za-z]{2}/.test(item.reference_answer)
      && !/\p{Script=Han}/u.test(item.reference_answer)
      && (item.kind !== "expression" || item.target_word));
}

export function parseChoiceQuestions(raw) {
  const parsed = parseJson(raw);
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return questions
    .filter((item) => item && String(item.question || "").trim()
      && Array.isArray(item.options) && item.options.length === 4
      && String(item.answer || "").trim() && String(item.explanation || "").trim())
    .map((item) => ({
      kind: "choice",
      question: String(item.question).trim(),
      options: item.options.map((option) => String(option).trim()),
      answer: String(item.answer).trim(),
      explanation: String(item.explanation).trim(),
      error_type: String(item.error_type || "General").trim(),
      context: normalizePracticeContext(item.context),
    }))
    .filter((item) => item.options.every(Boolean)
      && item.options.includes(item.answer)
      && item.question.length <= 240);
}
