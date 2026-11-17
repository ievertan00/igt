import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findLocalLearningResources } from "../lib/features/learning-diagnosis/local-resources.mjs";

test("finds relevant markdown notes without exposing unrelated files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-vault-resources-"));
  try {
    fs.mkdirSync(path.join(root, "Grammar"));
    fs.writeFileSync(path.join(root, "Grammar", "Past Tense.md"), "# Past tense\nUse the simple past with finished time expressions such as yesterday.", "utf8");
    fs.writeFileSync(path.join(root, "Random.md"), "A note about cooking recipes.", "utf8");
    const resources = findLocalLearningResources({
      vaultDir: root,
      errorType: "Grammar / Verb Tense",
      targetPattern: "past tense",
    });

    assert.equal(resources.length, 1);
    assert.equal(resources[0].kind, "local-note");
    assert.equal(resources[0].title, "Grammar/Past Tense.md");
    assert.match(resources[0].why, /past|Verb Tense/i);
    assert.equal(resources[0].url, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ignores hidden directories and unreadable or oversized candidates", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-vault-resources-"));
  try {
    fs.mkdirSync(path.join(root, ".obsidian"));
    fs.writeFileSync(path.join(root, ".obsidian", "app.md"), "Verb Tense", "utf8");
    assert.deepEqual(findLocalLearningResources({ vaultDir: root, errorType: "Verb Tense" }), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
