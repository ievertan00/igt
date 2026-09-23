import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { analyzeCoach, clearCoachCache } from "../lib/application/coach.mjs";

const tempDir = fs.mkdtempSync(path.join(process.cwd(), "tmp-coach-cache-"));
const reviewPath = path.join(tempDir, "Review.md");
let entryCount = 1;
let builds = 0;
fs.writeFileSync(reviewPath, "entry-1\n");

try {
  clearCoachCache();
  const options = {
    windowDays: 30,
    config: { ReviewPath: reviewPath },
    loadData: async () => ({ entries: Array.from({ length: entryCount }, (_, index) => ({ entryId: index + 1 })), diagnoses: [], attempts: [] }),
    build: async ({ days, loadData }) => {
      builds += 1;
      const data = await loadData();
      return { days, entryCount: data.entries.length, builds };
    },
  };

  const first = await analyzeCoach(options);
  assert.equal(first.cache.hit, false);
  assert.equal(builds, 1);
  const second = await analyzeCoach(options);
  assert.equal(second.cache.hit, true);
  assert.equal(builds, 1);

  const forced = await analyzeCoach({ ...options, force: true });
  assert.equal(forced.cache.hit, false);
  assert.equal(builds, 2);
  const throttled = await analyzeCoach({ ...options, force: true });
  assert.equal(throttled.cache.throttled, true);
  assert.equal(builds, 2);

  entryCount = 2;
  fs.appendFileSync(reviewPath, "entry-2\n");
  const invalidated = await analyzeCoach(options);
  assert.equal(invalidated.cache.hit, false);
  assert.equal(invalidated.entryCount, 2);
  assert.equal(builds, 3);
  console.log("coach cache smoke ok");
} finally {
  clearCoachCache();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
