import assert from "node:assert/strict";
import { closeAll, getDb } from "../lib/db/connection.mjs";
import { CANONICAL_PRACTICE_QUESTIONS, PRACTICE_CONTENT_COLUMNS, practiceContent } from "../lib/features/practice/canonical-bank.mjs";
import { ENRICHMENT_PILOT_041 } from "../lib/features/practice/enrichment-pilot-041.mjs";
import { ENRICHMENT_PILOT_045_APPROVED } from "../lib/features/practice/enrichment-pilot-045.mjs";
import { ENRICHMENT_PILOT_048_APPROVED } from "../lib/features/practice/enrichment-pilot-048.mjs";
import { decodePracticeQuestion, PRACTICE_CATEGORIES, publicPracticeQuestion } from "../lib/features/practice/question-bank.mjs";

const problems = [];
const note = (message) => problems.push(message);
const candidatesToReview = [...ENRICHMENT_PILOT_041, ...ENRICHMENT_PILOT_045_APPROVED, ...ENRICHMENT_PILOT_048_APPROVED];
const normalize = (value) => value.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "");
const bigrams = (value) => {
  const chars = [...normalize(value)];
  return new Set(chars.slice(0, -1).map((char, index) => char + chars[index + 1]));
};
const jaccard = (left, right) => {
  let intersection = 0;
  for (const gram of left) if (right.has(gram)) intersection++;
  const union = left.size + right.size - intersection;
  return union ? intersection / union : 0;
};

const db = await getDb({ readonly: true });
try {
  const liveRows = db.prepare("SELECT * FROM practice_questions ORDER BY id").all();
  const liveById = new Map(liveRows.map(row => [row.id, row]));
  const canonicalById = new Map(CANONICAL_PRACTICE_QUESTIONS.map(row => [row.id, row]));
  const batchIds = new Set();
  const batchPrompts = new Set();
  const candidateResults = [];

  for (const candidate of candidatesToReview) {
    const label = candidate.id;
    try {
      assert.equal(batchIds.has(candidate.id), false, "duplicate candidate ID");
      batchIds.add(candidate.id);
      assert.equal(PRACTICE_CATEGORIES.difficulty.includes(candidate.difficulty), true, "unsupported difficulty");
      assert.equal(PRACTICE_CATEGORIES.context.includes(candidate.context), true, "unsupported context");
      assert.ok([0, 1].includes(candidate.active), "candidate activation must be explicit");

      const normalizedPrompt = normalize(candidate.prompt_zh);
      assert.ok(normalizedPrompt, "empty normalized prompt");
      assert.equal(batchPrompts.has(normalizedPrompt), false, "normalized duplicate inside batch");
      batchPrompts.add(normalizedPrompt);
      assert.match(candidate.prompt_zh, /\p{Script=Han}/u, "prompt has no Chinese characters");
      assert.doesNotMatch(candidate.reference_answer, /\p{Script=Han}/u, "reference contains Han characters");
      assert.ok(candidate.reference_answer.trim(), "empty reference answer");
      assert.equal(typeof candidate.practice_fields_json, "string");
      assert.equal(typeof candidate.hint_json, "string");

      const fields = JSON.parse(candidate.practice_fields_json);
      for (const [key, values] of Object.entries(fields)) {
        assert.ok(Array.isArray(values) && values.length > 0, `${key} must be a non-empty array`);
        assert.ok(values.every(value => typeof value === "string" && value.trim()), `${key} has an invalid value`);
      }
      for (const key of ["primary_target", "learning_goal", "learning_rationale", "register"]) {
        assert.equal(fields[key]?.length, 1, `${key} must contain one value`);
      }
      assert.ok(["neutral", "informal", "formal"].includes(fields.register[0]), "unsupported register");

      const hints = JSON.parse(candidate.hint_json);
      assert.deepEqual(Object.keys(hints), ["simple", "intermediate", "complete"], "hint keys/order differ from contract");
      assert.ok(Object.values(hints).every(hint => typeof hint === "string" && hint.trim()), "empty hint");
      assert.equal(new Set(Object.values(hints)).size, 3, "progressive hints are duplicated");
      assert.ok(Object.values(hints).every(hint => !hint.includes(candidate.reference_answer)), "hint contains the full reference");
      assert.ok(Object.values(hints).every(hint => !hint.includes(fields.primary_target[0])), "hint exposes the internal target ID");

      const sidecar = candidate.sidecar;
      for (const key of ["essential", "alternatives", "counterexamples", "target_evidence", "template_family", "source", "provisional_difficulty", "difficulty_rationale", "review_status", "human_review_status", "actual_reviewers", "rights_status", "revision_history"]) {
        assert.ok(sidecar?.[key] !== undefined, `missing author-sidecar field: ${key}`);
      }
      assert.equal(sidecar.provisional_difficulty, candidate.difficulty, "sidecar difficulty differs from row");
      if (candidate.active === 1) {
        assert.equal(sidecar.human_review_status, "approved", "published candidate lacks human approval");
        assert.ok(sidecar.actual_reviewers.some(reviewer => reviewer.role === "human"), "published candidate lacks a human reviewer");
        assert.match(sidecar.rights_status, /^verified\b/i, "published candidate lacks rights verification");
        assert.match(sidecar.review_status, /human-approved/, "published candidate is not marked human-approved");
      } else {
        assert.equal(sidecar.human_review_status, "pending", "inactive draft has inconsistent review state");
        assert.match(sidecar.review_status, /human review pending/, "inactive draft is not marked pending");
      }
      assert.ok(sidecar.actual_reviewers.some(reviewer => reviewer.role === "machine" || reviewer.role === "human"), "reviewer record is empty or untyped");

      const live = liveById.get(candidate.id);
      assert.ok(live, "staged candidate is absent from live database");
      assert.equal(live.active, candidate.active, "live activation differs from approved candidate state");
      assert.equal(live.served_count, 0, "live candidate has usage");
      assert.deepEqual(practiceContent(live), practiceContent(candidate), "live row differs from reviewed candidate");
      assert.deepEqual(practiceContent(canonicalById.get(candidate.id)), practiceContent(live), "canonical export differs from live candidate");

      const normalizedCollision = liveRows.find(row => row.id !== candidate.id && normalize(row.prompt_zh) === normalizedPrompt);
      assert.equal(normalizedCollision, undefined, `normalized prompt collision with ${normalizedCollision?.id}`);

      const publicRow = publicPracticeQuestion(decodePracticeQuestion({
        ...candidate, kind: "sentence", served_count: 0,
      }));
      assert.equal(Object.hasOwn(publicRow, "reference_answer"), false, "public response exposes reference");
      assert.equal(Object.hasOwn(publicRow, "sidecar"), false, "public response exposes private sidecar");

      const candidateGrams = bigrams(candidate.prompt_zh);
      const nearest = liveRows
        .filter(row => row.id !== candidate.id)
        .map(row => ({ id: row.id, prompt: row.prompt_zh, score: jaccard(candidateGrams, bigrams(row.prompt_zh)) }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
        .map(row => ({ ...row, score: Number(row.score.toFixed(3)) }));

      candidateResults.push({ id: label, contract: "pass", nearestPromptCandidates: nearest });
    } catch (error) {
      note(`${label}: ${error.message}`);
      candidateResults.push({ id: label, contract: "fail", reason: error.message });
    }
  }

  const pendingHumanReview = candidatesToReview.filter(row => row.sidecar.human_review_status !== "approved"
    || !row.sidecar.actual_reviewers.some(reviewer => reviewer.role === "human")).length;
  const pendingRightsReview = candidatesToReview.filter(row => !/^verified\b/i.test(row.sidecar.rights_status)).length;
  const report = {
    mode: "read-only-release-dry-run",
    candidates: candidatesToReview.length,
    contractFailures: problems.length,
    pendingHumanReview,
    pendingRightsReview,
    activeCandidates: candidatesToReview.filter(row => row.active === 1).length,
    liveQuestionCount: liveRows.length,
    canonicalQuestionCount: CANONICAL_PRACTICE_QUESTIONS.length,
    liveMatchesCanonicalExport: liveRows.every(row => {
      const canonical = canonicalById.get(row.id);
      return canonical && JSON.stringify(practiceContent(row)) === JSON.stringify(practiceContent(canonical));
    }) && liveRows.length === CANONICAL_PRACTICE_QUESTIONS.length,
    publishReady: problems.length === 0 && pendingHumanReview === 0 && pendingRightsReview === 0,
    writesPerformed: 0,
    candidates_detail: candidateResults,
    problems,
  };
  console.log(JSON.stringify(report, null, 2));
  if (problems.length) process.exitCode = 1;
} finally {
  closeAll();
}
