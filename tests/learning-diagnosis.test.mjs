import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildLearningDiagnosis } from "../lib/features/learning-diagnosis/index.mjs";
import { assessResourceVerification, verifyResourceUrl } from "../lib/features/learning-diagnosis/resources.mjs";

const data = {
  totalInputs: 20,
  diagnoses: [
    { error_type: "Grammar / Verb Tense", severity: "Major", timestamp: "2026-09-17 10:00:00", session_id: 1, original_text: "I have finished it yesterday.", correction: "I finished it yesterday." },
    { error_type: "Grammar / Verb Tense", severity: "Moderate", timestamp: "2026-09-15 10:00:00", session_id: 2, original_text: "I have sent it last week.", correction: "I sent it last week." },
    { error_type: "Grammar / Verb Tense", severity: "Moderate", timestamp: "2026-09-01 10:00:00", session_id: 3, original_text: "I have joined in 2020.", correction: "I joined in 2020." },
  ],
  attempts: [
    { target_error_type: "Grammar / Verb Tense", target_pattern: "Past vs present perfect", score: 62, created_at: "2026-09-10 10:00:00" },
  ],
};

test("buildLearningDiagnosis returns a goal-aware training prescription", async () => {
  const diagnosis = await buildLearningDiagnosis({
    days: 90,
    goal: "workplace English",
    resourceMode: "local-and-web",
    now: Date.parse("2026-09-18T00:00:00Z"),
    loadData: async () => data,
  });

  assert.equal(diagnosis.goal, "workplace English");
  assert.equal(diagnosis.priorities[0].errorType, "Grammar / Verb Tense");
  assert.match(diagnosis.priorities[0].mechanism.kind, /hypothesis/);
  assert.equal(diagnosis.priorities[0].prescription.length, 4);
  assert.ok(diagnosis.priorities[0].prescription.some((phase) => /工作|work/i.test(phase.task)));
  assert.ok(diagnosis.priorities[0].resources.some((resource) => resource.kind === "local"));
  const webResource = diagnosis.priorities[0].resources.find((resource) => resource.kind === "web");
  assert.ok(webResource);
  assert.equal(webResource.verified, true);
  assert.equal(webResource.title, "Purdue OWL Grammar Exercises");
  assert.ok(webResource.url);
  assert.equal(webResource.verifiedAt, "2026-09-18");
});

test("does not invent resources when web resources are disabled", async () => {
  const diagnosis = await buildLearningDiagnosis({
    days: 30,
    resourceMode: "local",
    now: Date.parse("2026-09-18T00:00:00Z"),
    loadData: async () => data,
  });

  assert.ok(diagnosis.priorities[0].resources.every((resource) => resource.kind === "local"));
  assert.ok(diagnosis.limitations.some((item) => /迁移|语境/.test(item)));
});

test("reports context limits when production contexts are not yet recorded", async () => {
  const diagnosis = await buildLearningDiagnosis({
    days: 30,
    resourceMode: "local",
    now: Date.parse("2026-09-18T00:00:00Z"),
    loadData: async () => ({
      totalInputs: 4,
      diagnoses: [{ error_type: "Grammar / Article Usage", severity: "Minor", timestamp: "2026-09-17 10:00:00" }],
      attempts: [{ target_error_type: "Grammar / Article Usage", context_label: "drill:B1", score: 80, created_at: "2026-09-17 11:00:00" }],
    }),
  });

  assert.equal(diagnosis.priorities.length, 0);
  assert.ok(diagnosis.limitations.some((item) => /语境/.test(item)));
});

test("builds a coach prescription for a vocabulary weakness", async () => {
  const diagnosis = await buildLearningDiagnosis({
    days: 30,
    goal: "workplace English",
    resourceMode: "local",
    now: Date.parse("2026-09-18T00:00:00Z"),
    loadData: async () => ({
      totalInputs: 0,
      diagnoses: [],
      attempts: [
        { target_error_type: "Vocabulary / Usage", target_pattern: "address", score: 60, created_at: "2026-09-17 10:00:00" },
        { target_error_type: "Vocabulary / Usage", target_pattern: "address", score: 65, created_at: "2026-09-15 10:00:00" },
        { target_error_type: "Vocabulary / Usage", target_pattern: "address", score: 70, created_at: "2026-09-12 10:00:00" },
      ],
    }),
  });

  assert.equal(diagnosis.priorities[0].errorType, "Vocabulary / Usage");
  assert.match(diagnosis.priorities[0].mechanism.statement, /词|搭配/);
  assert.equal(diagnosis.priorities[0].resources[0].kind, "local");
});

test("prefers matching Obsidian notes when a vault is configured", async () => {
  const vaultDir = fs.mkdtempSync(path.join(os.tmpdir(), "igt-diagnosis-vault-"));
  try {
    fs.writeFileSync(path.join(vaultDir, "Verb Tense.md"), "# Verb tense\nUse the simple past with yesterday.", "utf8");
    const diagnosis = await buildLearningDiagnosis({
      days: 30,
      resourceMode: "local",
      vaultDir,
      now: Date.parse("2026-09-18T00:00:00Z"),
      loadData: async () => data,
    });
    assert.equal(diagnosis.priorities[0].resources[0].kind, "local-note");
    assert.equal(diagnosis.priorities[0].resources[0].title, "Verb Tense.md");
  } finally {
    fs.rmSync(vaultDir, { recursive: true, force: true });
  }
});

test("marks an old web resource as needing re-verification", () => {
  const result = assessResourceVerification({ verified: true, verifiedAt: "2025-01-01" }, {
    now: Date.parse("2026-09-18T00:00:00Z"),
  });
  assert.equal(result.verified, false);
  assert.equal(result.status, "stale");
});

test("verifies resource URLs with HEAD and falls back to GET when required", async () => {
  const methods = [];
  const result = await verifyResourceUrl("https://example.test/resource", {
    fetchImpl: async (_url, options) => {
      methods.push(options.method);
      if (options.method === "HEAD") return { ok: false, status: 405, url: "https://example.test/resource" };
      return { ok: true, status: 200, url: "https://example.test/resource" };
    },
  });
  assert.deepEqual(methods, ["HEAD", "GET"]);
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
});

test("does not verify non-HTTPS resource URLs", async () => {
  const result = await verifyResourceUrl("javascript:alert(1)");
  assert.equal(result.ok, false);
  assert.match(result.reason, /HTTPS/);
});

test("does not expose a stale web URL as a recommendation", async () => {
  const diagnosis = await buildLearningDiagnosis({
    days: 90,
    resourceMode: "web",
    now: Date.parse("2027-09-18T00:00:00Z"),
    loadData: async () => data,
  });
  const webResource = diagnosis.priorities[0].resources.find((resource) => resource.kind === "web");
  assert.equal(webResource.verified, false);
  assert.equal(webResource.url, null);
  assert.equal(webResource.verificationStatus, "stale");
});

test("uses a recent runtime resource check instead of a static catalog claim", async () => {
  const diagnosis = await buildLearningDiagnosis({
    days: 90,
    resourceMode: "web",
    now: Date.parse("2026-09-18T12:00:00Z"),
    loadData: async () => ({ ...data, resourceChecks: [{
      url: "https://owl.purdue.edu/owl_exercises/grammar_exercises/index.html",
      ok: 0,
      status: 403,
      reason: "blocked",
      checked_at: "2026-09-18 08:00:00",
    }] }),
  });
  const webResource = diagnosis.priorities[0].resources.find((resource) => resource.kind === "web");
  assert.equal(webResource.verified, false);
  assert.equal(webResource.url, null);
  assert.equal(webResource.verificationStatus, "runtime-failed");
});
