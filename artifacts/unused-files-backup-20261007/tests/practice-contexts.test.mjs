import test from "node:test";
import assert from "node:assert/strict";
import { parseQuizQuestions } from "../lib/features/quiz/prompts.mjs";
import { parsePracticeQuestions } from "../lib/features/quiz/practice-prompts.mjs";

test("quiz and practice parsers preserve only known production contexts", () => {
  const quiz = parseQuizQuestions(JSON.stringify({ questions: [{
    chinese: "我会在会议后发邮件。",
    reference_answer: "I will send an email after the meeting.",
    focus: "Future tense",
    error_type: "Verb Tense",
    context: "meeting",
  }] }), 1);
  const practice = parsePracticeQuestions(JSON.stringify({ questions: [{
    kind: "sentence",
    prompt_zh: "请在会议后发一封邮件。",
    reference_answer: "Please send an email after the meeting.",
    focus: "Imperative",
    context: "invented-context",
  }] }));

  assert.equal(quiz[0].context, "meeting");
  assert.equal(practice[0].context, "");
});
