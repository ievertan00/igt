import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { deleteReviewLogEntry, formatReviewEntry, parseReviewLog } from "../lib/db/review-log.mjs";

const entry = (entryId, source = "grammar") => formatReviewEntry({ entryId, source, timestamp: "2026-11-02T00:00:00Z", originalText: `Sentence ${entryId}`, data: { correction: `Corrected ${entryId}` } });
const legacy = "### [2020-01-01T00:00:00Z]\n**User Input**: Legacy sentence\n**Output**:\n**Correction**\nA legacy sentence\n**Custom metadata**\nKeep this verbatim\n\n---\n";

function fixture(content, run) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "igt-handbook-delete-"));
  const file = path.join(folder, "review.md");
  try { fs.writeFileSync(file, content); run(file); }
  finally { fs.rmSync(folder, { recursive: true, force: true }); }
}

for (const newline of ["\n", "\r\n"]) {
  for (const target of ["first", "legacy", "last"]) {
    test(`deletion preserves other entries and legacy IDs (${target}, ${JSON.stringify(newline)})`, () => {
      const blocks = [entry("first"), legacy, entry("last")].map(block => block.replaceAll("\n", newline));
      const prefix = `# My Review Log${newline}${newline}`;
      const content = prefix + blocks.join("");
      const before = parseReviewLog(content);
      const index = ["first", "legacy", "last"].indexOf(target);
      const id = before[index].entryId;
      fixture(content, file => {
        assert.deepEqual(deleteReviewLogEntry(file, id), { deleted: true, entryId: id });
        const after = fs.readFileSync(file, "utf8");
        assert.equal(after, prefix + blocks.filter((_, i) => i !== index).join(""));
        assert.deepEqual(parseReviewLog(after).map(row => row.entryId), before.filter((_, i) => i !== index).map(row => row.entryId));
        assert.deepEqual(deleteReviewLogEntry(file, id), { deleted: true, entryId: id });
        assert.equal(fs.readFileSync(file, "utf8"), after);
        assert.deepEqual(fs.readdirSync(path.dirname(file)), ["review.md"]);
      });
    });
  }
}

test("deletion refuses invalid IDs, duplicate IDs, and other-source records without writing", () => {
  const content = entry("duplicate") + entry("duplicate") + entry("text", "text");
  fixture(content, file => {
    for (const id of [null, "", "\n", "x".repeat(201)]) assert.throws(() => deleteReviewLogEntry(file, id), { status: 400 });
    assert.throws(() => deleteReviewLogEntry(file, "duplicate"), { status: 409 });
    assert.throws(() => deleteReviewLogEntry(file, "text"), { status: 400 });
    assert.equal(fs.readFileSync(file, "utf8"), content);
  });
});

test("deleting the only entry leaves the preamble and missing logs fail explicitly", () => {
  fixture("# Log\n\n" + entry("only"), file => {
    deleteReviewLogEntry(file, "only");
    assert.equal(fs.readFileSync(file, "utf8"), "# Log\n\n");
    assert.throws(() => deleteReviewLogEntry(path.join(path.dirname(file), "missing.md"), "only"), { status: 503 });
  });
});
