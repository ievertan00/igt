import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { getQuizRecords } from "../../features/quiz/context.mjs";
import { getWordQuizCards } from "../../features/quiz/word-context.mjs";
import { getQuizHistory, isNovelQuizQuestion, quizFingerprint, saveQuizQuestions } from "../../features/quiz/history.mjs";
import { QUIZ_EVALUATION_SCHEMA, QUIZ_EVALUATOR_PROMPT, parseQuizEvaluation } from "../../features/quiz/prompts.mjs";
import { WORD_QUIZ_EVALUATOR_PROMPT } from "../../features/quiz/word-prompts.mjs";
import {
  CHOICE_QUESTIONS_SCHEMA,
  CHOICE_RETRY_INSTRUCTION,
  CHOICE_WRITER_PROMPT,
  PRACTICE_RETRY_INSTRUCTION,
  PRACTICE_QUESTIONS_SCHEMA,
  PRACTICE_WRITER_PROMPT,
  parseChoiceQuestions,
  parsePracticeQuestions,
} from "../../features/quiz/practice-prompts.mjs";
import { PRACTICE_CONTEXTS } from "../../features/practice/contexts.mjs";
import { savePracticeAttempt } from "../../features/practice/attempts.mjs";
import { errorPayload } from "../../contracts/errors.mjs";

function json(res, status, payload) {
  if (typeof payload?.error === "string") payload = { ...payload, ...errorPayload(status >= 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST", payload.error, status >= 500) };
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
}

function isRateLimitError(error) {
  return error?.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/i.test(error?.message || "");
}

function isValidQuestion(question, mode, records, cards) {
  if (question.kind !== mode && mode !== "mixed") return false;
  if (question.kind === "sentence" && !records.length) return false;
  if (question.kind === "expression" && cards.length
    && !cards.some((card) => card.word.toLowerCase() === question.target_word.toLowerCase())) return false;
  return true;
}

const FALLBACK_CHOICE_QUESTIONS = [
  { question: "She _____ to the office by train every day.", options: ["go", "goes", "going", "gone"], answer: "goes", explanation: "一般现在时中，主语 she 后的动词要加 -s。", error_type: "Subject-verb agreement" },
  { question: "I _____ dinner when the lights went out.", options: ["cooked", "was cooking", "am cooking", "have cooked"], answer: "was cooking", explanation: "一个动作发生时，另一个动作正在进行，用过去进行时。", error_type: "Past continuous" },
  { question: "He has lived here _____ 2020.", options: ["for", "since", "during", "from"], answer: "since", explanation: "具体起始时间前用 since；一段时长前用 for。", error_type: "Since and for" },
  { question: "If it _____ tomorrow, we will move the meeting online.", options: ["rains", "rained", "will rain", "is raining"], answer: "rains", explanation: "真实条件句中，if 从句用一般现在时表示将来。", error_type: "First conditional" },
  { question: "There isn't _____ milk left in the fridge.", options: ["many", "much", "few", "several"], answer: "much", explanation: "milk 是不可数名词，否定句中用 much。", error_type: "Countable and uncountable nouns" },
  { question: "The final report _____ by Friday afternoon.", options: ["must finish", "must be finished", "must be finishing", "must have finish"], answer: "must be finished", explanation: "report 是被完成的对象，因此用情态动词加被动语态。", error_type: "Passive voice" },
  { question: "I'm looking forward to _____ you next week.", options: ["meet", "meeting", "met", "be meet"], answer: "meeting", explanation: "look forward to 中的 to 是介词，后接动名词。", error_type: "Gerund after preposition" },
  { question: "Neither of the answers _____ correct.", options: ["are", "were", "is", "be"], answer: "is", explanation: "neither 作主语时通常按单数处理。", error_type: "Subject-verb agreement" },
  { question: "Maya asked me where I _____.", options: ["live", "am living", "lived", "will live"], answer: "lived", explanation: "主句用过去时转述时，间接引语中的动词通常向过去回移。", error_type: "Reported speech" },
  { question: "This is the colleague _____ helped me with the presentation.", options: ["which", "whose", "who", "where"], answer: "who", explanation: "先行词是人，且关系代词在从句中作主语时用 who。", error_type: "Relative clauses" },
  { question: "We have _____ time, so let's review the last section.", options: ["a few", "a little", "few", "many"], answer: "a little", explanation: "time 在这里是不可数名词，表示有一些时间用 a little。", error_type: "Quantifiers" },
  { question: "You _____ wear a jacket; it is warm outside.", options: ["mustn't", "don't have to", "shouldn't have", "couldn't"], answer: "don't have to", explanation: "don't have to 表示没有必要；mustn't 表示禁止。", error_type: "Modal verbs" },
];

export function registerPracticeRoutes({ getLLMManager, persistPracticeAttempt = savePracticeAttempt, appendPracticeLog = null, config = null }) {
  async function persist(attempt) {
    const id = await persistPracticeAttempt(attempt);
    const persistence = appendPracticeLog ? await appendPracticeLog({ attempt, config: config || {} }) : null;
    return { id, persistence };
  }
  register("POST", "/practice/generate", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const count = Number(body?.count ?? 5);
    const mode = ["word", "sentence", "choice"].includes(body?.mode) ? body.mode : "sentence";
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      json(res, 400, { error: "'count' must be an integer between 1 and 10" });
      return;
    }

    let llm;
    try {
      let records = [];
      let cards = [];
      if (mode !== "word") {
        try {
          records = await getQuizRecords(30, Math.min(50, count * 4));
        } catch (error) {
          if (mode !== "choice") throw error;
        }
      }
      if (mode === "word") cards = await getWordQuizCards({ limit: Math.min(50, count * 4) });
      if (mode === "choice") {
        const history = await getQuizHistory(500);
        const usedQuestions = [...history];
        const questions = [];
        const generationDeadline = performance.now() + 20_000;
        choiceGeneration: for (let index = 0; index < count; index++) {
          let question = null;
          for (let attempt = 0; attempt < 4 && !question; attempt++) {
            const input = JSON.stringify({
              requested_count: 1,
              grammar_records: records,
              excluded_questions: usedQuestions.slice(-100).map((item) => item.chinese || item.question || item.prompt || item),
              context_label: PRACTICE_CONTEXTS[index % PRACTICE_CONTEXTS.length],
              retry_instruction: attempt > 0 ? CHOICE_RETRY_INSTRUCTION : undefined,
            });
            const remainingMs = generationDeadline - performance.now();
            if (remainingMs <= 0) break choiceGeneration;
            let timer;
            let candidate;
            try {
              const raw = await Promise.race([
                (async () => {
                  llm ||= await getLLMManager();
                  return llm.generateWithFallback(input, CHOICE_WRITER_PROMPT, {
                    taskType: "practice",
                    jsonSchema: CHOICE_QUESTIONS_SCHEMA,
                  });
                })(),
                new Promise((_, reject) => {
                  timer = setTimeout(() => reject(new Error("Choice generation time budget reached")), remainingMs);
                }),
              ]);
              candidate = parseChoiceQuestions(raw)[0];
            } catch {
              // A slow or unavailable model must not prevent a choice session.
              break choiceGeneration;
            } finally {
              clearTimeout(timer);
            }
            if (candidate && isNovelQuizQuestion({ chinese: candidate.question }, usedQuestions)) {
              question = candidate;
            }
          }
          if (question) {
            questions.push(question);
            usedQuestions.push({ chinese: question.question });
          }
        }
        const seenFallbacks = new Set(usedQuestions.map((item) => quizFingerprint(item.chinese || item.question || item.prompt || item)));
        for (const fallback of FALLBACK_CHOICE_QUESTIONS) {
          if (questions.length >= count) break;
          const fingerprint = quizFingerprint(fallback.question);
          if (seenFallbacks.has(fingerprint)) continue;
          seenFallbacks.add(fingerprint);
          questions.push({ kind: "choice", ...fallback, context: PRACTICE_CONTEXTS[questions.length % PRACTICE_CONTEXTS.length] });
        }
        if (questions.length < count) {
          const usedThisSession = new Set(questions.map((question) => quizFingerprint(question.question)));
          for (const fallback of FALLBACK_CHOICE_QUESTIONS) {
            if (questions.length >= count) break;
            const fingerprint = quizFingerprint(fallback.question);
            if (usedThisSession.has(fingerprint)) continue;
            usedThisSession.add(fingerprint);
            questions.push({ kind: "choice", ...fallback, context: PRACTICE_CONTEXTS[questions.length % PRACTICE_CONTEXTS.length] });
          }
        }
        if (!questions.length) throw new Error("The model did not generate sufficiently varied choice questions");
        await saveQuizQuestions(questions.map((question) => ({
          chinese: question.question,
          reference_answer: question.answer,
          error_type: question.error_type,
        })));
        json(res, 200, { data: { questions, mode }, perf: { total_ms: performance.now() - startTime } });
        return;
      }
      const practiceKind = mode === "word" ? "expression" : mode;
      if (practiceKind === "sentence" && !records.length) throw new Error("No grammar records found for sentence practice");
      const history = await getQuizHistory(500);
      const usedQuestions = [...history];
      const questions = [];
      llm = await getLLMManager();
      for (let index = 0; index < count; index++) {
        const requestedKind = practiceKind;
        let question = null;
        for (let attempt = 0; attempt < 4 && !question; attempt++) {
          const input = JSON.stringify({
            requested_count: 1,
            requested_kind: requestedKind,
            grammar_records: records,
            vocabulary: cards,
            vocabulary_fallback: requestedKind === "expression" && cards.length === 0
              ? "No saved vocabulary is available. Choose a useful common English word or phrase and create a realistic practice scenario for it."
              : undefined,
            retry_instruction: attempt > 0 ? PRACTICE_RETRY_INSTRUCTION : undefined,
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
    const hasQuestionContext = question?.kind === "choice"
      ? Boolean(question.question && question.answer)
      : Boolean(question?.reference_answer && question?.prompt_zh);
    if (!answer || !question?.kind || !hasQuestionContext) {
      json(res, 400, { error: "Missing practice answer or question context" });
      return;
    }
    let llm;
    try {
      if (question.kind === "choice") {
        const normalized = answer.trim().toLowerCase();
        const optionIndex = ["a", "b", "c", "d"].indexOf(normalized);
        const selected = optionIndex >= 0 ? question.options?.[optionIndex] : answer.trim();
        const correct = selected === question.answer;
        const evaluation = {
          score: correct ? 100 : 0,
          corrected_answer: question.answer,
          feedback_zh: correct ? "选择正确，继续把这个规则用到自己的句子里。" : question.explanation,
          strengths_zh: correct ? ["正确识别了句子中的语法形式。"] : [],
          improvements_zh: correct ? [] : ["先定位句子的时间、主语和动词关系，再选择答案。"],
        };
        const { persistence } = await persist({
          activityType: "practice-choice",
          targetErrorType: question.error_type || null,
          targetPattern: question.explanation || null,
          contextLabel: question.context || null,
          prompt: question.question,
          learnerAnswer: answer,
          referenceAnswer: question.answer,
          score: evaluation.score,
          feedback: evaluation,
        });
        json(res, 200, { data: evaluation, persistence, perf: { total_ms: performance.now() - startTime } });
        return;
      }
      llm = await getLLMManager();
      const input = JSON.stringify(question.kind === "expression"
        ? { target_word: question.target_word, chinese_scenario: question.prompt_zh, reference_answer: question.reference_answer, learner_answer: answer, usage_focus: question.focus || "" }
        : { chinese_prompt: question.prompt_zh, reference_answer: question.reference_answer, learner_answer: answer, grammar_focus: question.focus || "", error_type: question.error_type || "" });
      const prompt = question.kind === "expression" ? WORD_QUIZ_EVALUATOR_PROMPT : QUIZ_EVALUATOR_PROMPT;
      const raw = await llm.generateWithFallback(input, prompt, { taskType: "practice", jsonSchema: QUIZ_EVALUATION_SCHEMA });
      const evaluation = parseQuizEvaluation(raw, question.reference_answer);
      const { persistence } = await persist({
        activityType: question.kind === "expression" ? "practice-word" : "practice-sentence",
        targetErrorType: question.error_type || null,
        targetPattern: question.focus || null,
        contextLabel: question.context || null,
        prompt: question.prompt_zh,
        learnerAnswer: answer,
        referenceAnswer: question.reference_answer,
        score: evaluation.score,
        feedback: evaluation,
      });
      json(res, 200, { data: evaluation, persistence, perf: { total_ms: performance.now() - startTime } });
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      json(res, isRateLimitError(error) ? 429 : 500, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });
}
