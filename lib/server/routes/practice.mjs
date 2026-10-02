import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { getQuizRecords } from "../../features/quiz/context.mjs";
import { getWordQuizCards } from "../../features/quiz/word-context.mjs";
import { getQuizHistory, isNovelQuizQuestion, quizFingerprint, saveQuizQuestions } from "../../features/quiz/history.mjs";
import { QUIZ_EVALUATION_SCHEMA, QUIZ_EVALUATOR_PROMPT, parseQuizEvaluation } from "../../features/quiz/prompts.mjs";
import { WORD_QUIZ_EVALUATOR_PROMPT } from "../../features/quiz/word-prompts.mjs";
import {
  CHOICE_EVALUATION_SCHEMA,
  CHOICE_EVALUATOR_PROMPT,
  CHOICE_QUESTIONS_SCHEMA,
  CHOICE_RETRY_INSTRUCTION,
  CHOICE_WRITER_PROMPT,
  PRACTICE_RETRY_INSTRUCTION,
  PRACTICE_QUESTIONS_SCHEMA,
  PRACTICE_WRITER_PROMPT,
  parseChoiceEvaluation,
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
  { question: "She _____ to the office by train every day.", options: ["go", "goes", "going", "gone"], answer: "goes", explanation: "every day 表明这里描述的是习惯，用一般现在时。主语 she 是第三人称单数，所以动词 go 要变成 goes。go 缺少词尾变化；going 和 gone 都不能单独作这里的谓语。", error_type: "Subject-verb agreement" },
  { question: "I _____ dinner when the lights went out.", options: ["cooked", "was cooking", "am cooking", "have cooked"], answer: "was cooking", explanation: "when the lights went out 是过去发生的短暂事件；做饭是当时正在进行的背景动作，所以用过去进行时 was cooking。cooked 会把做饭写成已完成的动作；am cooking 是现在时，have cooked 也不表示过去某一刻正在进行。", error_type: "Past continuous" },
  { question: "He has lived here _____ 2020.", options: ["for", "since", "during", "from"], answer: "since", explanation: "2020 是居住开始的具体时间点，has lived 表示从那时持续到现在，所以用 since。for 后面应接一段时长，例如 for six years；during 表示在某段期间内，from 通常还需要明确终点，不能替代这里的 since。", error_type: "Since and for" },
  { question: "If it _____ tomorrow, we will move the meeting online.", options: ["rains", "rained", "will rain", "is raining"], answer: "rains", explanation: "这是可能发生的将来条件：主句用 will move，if 从句用一般现在时 rains。tomorrow 指将来，但不意味着 if 从句也用 will；rained 通常用于假设性条件句，is raining 描述正在下雨的状态。", error_type: "First conditional" },
  { question: "There isn't _____ milk left in the fridge.", options: ["many", "much", "few", "several"], answer: "much", explanation: "milk 是不可数名词，这里是否定句，much milk 表示‘剩下多少牛奶’。many、few 和 several 都修饰可数名词复数，不能直接修饰 milk。", error_type: "Countable and uncountable nouns" },
  { question: "The final report _____ by Friday afternoon.", options: ["must finish", "must be finished", "must be finishing", "must have finish"], answer: "must be finished", explanation: "报告是被人完成的对象，所以需要被动语态：must be + 过去分词 finished。must finish 会让 report 成为执行动作的主体；must be finishing 是主动进行式；must have finish 的形式也不正确。", error_type: "Passive voice" },
  { question: "I'm looking forward to _____ you next week.", options: ["meet", "meeting", "met", "be meet"], answer: "meeting", explanation: "look forward to 是固定搭配，其中 to 是介词，不是不定式标记。介词后接动名词，所以用 meeting you；meet 是原形，met 是过去式或过去分词，be meet 不符合英语结构。", error_type: "Gerund after preposition" },
  { question: "Neither of the answers _____ correct.", options: ["are", "were", "is", "be"], answer: "is", explanation: "neither 指两者都不，在这道题采用单数一致，因此谓语用 is。of the answers 虽含复数名词，但不是决定谓语数的核心主语；were 是过去时，be 不能单独作这里的谓语。", error_type: "Subject-verb agreement" },
  { question: "Maya asked me where I _____ when I was a child.", options: ["live", "am living", "lived", "will live"], answer: "lived", explanation: "when I was a child 明确指出童年时期，空格处需要过去时 lived。asked 也把提问放在过去；live 和 am living 描述现在，will live 描述将来，都与童年这个时间线不符。", error_type: "Reported speech" },
  { question: "This is the colleague _____ helped me with the presentation.", options: ["which", "whose", "who", "where"], answer: "who", explanation: "先行词 colleague 是人，空格处的关系代词在从句里作 helped 的主语，所以用 who。which 通常指物，whose 表示所属关系，where 指地点，都不能承担这里的主语功能。", error_type: "Relative clauses" },
  { question: "We have _____ time, so let's review the last section.", options: ["a few", "a little", "few", "many"], answer: "a little", explanation: "time 在这里表示时间量，是不可数名词；后半句提议继续复习，说明还有一点时间，所以用 a little。a few、few、many 修饰可数名词复数；little 不带 a 还会强调‘几乎没有’，语气也不同。", error_type: "Quantifiers" },
  { question: "You _____ wear a jacket; it is warm outside.", options: ["mustn't", "don't have to", "shouldn't have", "couldn't"], answer: "don't have to", explanation: "天气暖和说明穿外套没有必要，因此用 don't have to。mustn't 表示禁止，语气和含义都过强；shouldn't have 通常谈过去已经做过的事，couldn't 表示不能或不可能。", error_type: "Modal verbs" },
];

/**
 * Ask the provider to explain a choice answer. Returns null on any failure so the
 * caller can fall back to the question's own static explanation — a learner who
 * already committed to an answer must never be left without feedback.
 */
async function explainChoice({ question, selected, correct, getLLMManager, setLLM }) {
  try {
    const llm = await getLLMManager();
    setLLM(llm);
    const raw = await llm.generateWithFallback(JSON.stringify({
      question: question.question,
      options: question.options,
      correct_answer: question.answer,
      selected_option: selected,
      selected_option_is_correct: correct,
      error_type: question.error_type || "",
    }), CHOICE_EVALUATOR_PROMPT, { taskType: "practice", jsonSchema: CHOICE_EVALUATION_SCHEMA });
    return parseChoiceEvaluation(raw, { options: question.options, selected, answer: question.answer });
  } catch {
    return null;
  }
}

export function registerPracticeRoutes({ getLLMManager, persistPracticeAttempt = savePracticeAttempt, appendPracticeLog = null, config = null }) {
  async function persist(attempt) {
    const id = await persistPracticeAttempt(attempt);
    let persistence = null;
    if (appendPracticeLog) {
      try {
        persistence = await appendPracticeLog({ attempt, config: config || {} });
      } catch {
        persistence = { saved: false, warning: "Your answer was reviewed, but this attempt could not be saved to the Practice Log." };
      }
    }
    return { id, persistence };
  }
  register("POST", "/practice/generate", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const count = Number(body?.count ?? 5);
    const mode = ["word", "sentence", "choice"].includes(body?.mode) ? body.mode : "sentence";
    const difficulty = body?.difficulty ?? "standard";
    if (!Number.isInteger(count) || count < 1 || count > 10) {
      json(res, 400, { error: "'count' must be an integer between 1 and 10" });
      return;
    }
    if (!["easy", "standard", "challenge"].includes(difficulty)) {
      json(res, 400, { error: "'difficulty' must be easy, standard, or challenge" });
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
        const history = await getQuizHistory(null);
        const usedQuestions = [...history];
        const questions = [];
        const generationDeadline = performance.now() + 105_000;
        let generationError = null;
        for (let attempt = 0; attempt < 3 && questions.length < count; attempt++) {
            const input = JSON.stringify({
              requested_count: count - questions.length,
              difficulty,
              grammar_records: records,
              excluded_questions: usedQuestions.slice(-20).map((item) => item.chinese || item.question || item.prompt || item),
              context_label: PRACTICE_CONTEXTS[questions.length % PRACTICE_CONTEXTS.length],
              retry_instruction: attempt > 0 ? CHOICE_RETRY_INSTRUCTION : undefined,
            });
            const remainingMs = generationDeadline - performance.now();
            if (remainingMs <= 0) break;
            let timer;
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
              for (const candidate of parseChoiceQuestions(raw)) {
                if (questions.length >= count) break;
                if (!isNovelQuizQuestion({ chinese: candidate.question }, usedQuestions)) continue;
                questions.push(candidate);
                usedQuestions.push({ chinese: candidate.question });
              }
            } catch (error) {
              generationError = error;
              if (/time budget reached|not reachable|Ollama error/i.test(error.message || "")) break;
            } finally {
              clearTimeout(timer);
            }
        }
        const seenFallbacks = new Set(usedQuestions.map((item) => quizFingerprint(item.chinese || item.question || item.prompt || item)));
        for (const fallback of difficulty === "standard" ? FALLBACK_CHOICE_QUESTIONS : []) {
          if (questions.length >= count) break;
          const fingerprint = quizFingerprint(fallback.question);
          if (seenFallbacks.has(fingerprint) || !isNovelQuizQuestion({ chinese: fallback.question }, usedQuestions)) continue;
          seenFallbacks.add(fingerprint);
          questions.push({ kind: "choice", ...fallback, context: PRACTICE_CONTEXTS[questions.length % PRACTICE_CONTEXTS.length] });
          usedQuestions.push({ chinese: fallback.question });
        }
        if (!questions.length) {
          throw new Error(generationError
            ? `Could not create new choice questions: ${generationError.message}`
            : "Could not create new choice questions. Try again or choose a different difficulty.");
        }
        await saveQuizQuestions(questions.map((question) => ({
          chinese: question.question,
          reference_answer: question.answer,
          error_type: question.error_type,
        })), { requireAll: true });
        json(res, 200, { data: { questions, mode, difficulty, requested_count: count }, perf: { total_ms: performance.now() - startTime } });
        return;
      }
      const practiceKind = mode === "word" ? "expression" : mode;
      if (practiceKind === "sentence" && !records.length) throw new Error("No grammar records found for sentence practice");
      const history = await getQuizHistory(null);
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
            difficulty,
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
            if (candidate.kind === "expression") {
              const target = cards.find((card) => card.word.toLowerCase() === candidate.target_word.toLowerCase());
              const meaning = target?.zh || target?.meaning;
              candidate.focus = meaning
                ? `Target word: ${candidate.target_word} · ${meaning}`
                : `Target word: ${candidate.target_word}`;
            }
            question = candidate;
          }
        }
        if (question) {
          questions.push(question);
          usedQuestions.push({ chinese: question.prompt_zh });
        }
      }
      if (questions.length < count) throw new Error("Could not prepare the requested number of new practice questions. Try a smaller set or another difficulty.");
      await saveQuizQuestions(questions.map((question) => ({
        chinese: question.prompt_zh,
        reference_answer: question.reference_answer,
        error_type: question.kind === "expression" ? "Expression" : question.error_type,
      })), { requireAll: true });
      json(res, 200, { data: { questions, mode, difficulty }, perf: { total_ms: performance.now() - startTime } });
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
        const explanation = String(question.explanation || "比较选项与句子的时间、主语和语义关系，确认只有一个答案符合完整句意。").trim();

        // Correctness is decided here, not by the model: the answer string either
        // matches an option or it does not. The model only writes the teaching.
        const teaching = await explainChoice({
          question,
          selected,
          correct,
          getLLMManager,
          setLLM: (manager) => { llm = manager; },
        });

        const evaluation = {
          score: correct ? 100 : 0,
          verdict: correct ? "excellent" : "incorrect",
          corrected_answer: question.answer,
          selected_answer: selected,
          feedback_zh: teaching?.feedback_zh || `${correct ? "选择正确。" : `正确答案是 ${question.answer}。`}${explanation}`,
          clue_zh: teaching?.clue_zh || "",
          option_notes: teaching?.option_notes || [],
          rule_zh: teaching?.rule_zh || "",
          strengths_zh: teaching ? teaching.strengths_zh : (correct ? ["选出了符合句意和语法的形式。"] : []),
          improvements_zh: teaching ? teaching.improvements_zh : (correct ? [] : ["先找出句中的关键线索，再逐一排除不符合线索的选项。"]),
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
