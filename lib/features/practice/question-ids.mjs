import idSnapshot from "./practice-question-id-map.json" with { type: "json" };

// Question IDs are opaque, batch-scoped identifiers. Historical source IDs map through the snapshot below.
export const PRACTICE_QUESTION_ID_PATTERN = /^practice-\d{6}-\d{4}$/;

export const COVERAGE_QUESTION_ID_ALIASES = new Map([
  ["coverage-057-cinema-001", "practice-202610-0001"],
  ["coverage-057-cinema-002", "practice-202610-0002"],
  ["coverage-057-friends-001", "practice-202610-0003"],
  ["coverage-057-friends-002", "practice-202610-0004"],
  ["coverage-057-health-001", "practice-202610-0005"],
  ["coverage-057-health-002", "practice-202610-0006"],
  ["coverage-057-restaurants-001", "practice-202610-0007"],
  ["coverage-057-restaurants-002", "practice-202610-0008"],
  ["coverage-057-services-001", "practice-202610-0009"],
  ["coverage-057-services-002", "practice-202610-0010"],
  ["coverage-057-shopping-001", "practice-202610-0011"],
  ["coverage-057-shopping-002", "practice-202610-0012"],
  ["coverage-057-transit-001", "practice-202610-0013"],
  ["coverage-057-transit-002", "practice-202610-0014"],
  ["coverage-058-cinema-001", "practice-202610-0015"],
  ["coverage-058-cinema-002", "practice-202610-0016"],
  ["coverage-058-friends-001", "practice-202610-0017"],
  ["coverage-058-friends-002", "practice-202610-0018"],
  ["coverage-058-health-001", "practice-202610-0019"],
  ["coverage-058-health-002", "practice-202610-0020"],
  ["coverage-058-restaurants-001", "practice-202610-0021"],
  ["coverage-058-restaurants-002", "practice-202610-0022"],
  ["coverage-058-services-001", "practice-202610-0023"],
  ["coverage-058-services-002", "practice-202610-0024"],
  ["coverage-058-shopping-001", "practice-202610-0025"],
  ["coverage-058-shopping-002", "practice-202610-0026"],
  ["coverage-058-transit-001", "practice-202610-0027"],
  ["coverage-058-transit-002", "practice-202610-0028"],
  ["coverage-059-cinema-001", "practice-202610-0029"],
  ["coverage-059-cinema-002", "practice-202610-0030"],
  ["coverage-059-friends-001", "practice-202610-0031"],
  ["coverage-059-friends-002", "practice-202610-0032"],
  ["coverage-059-health-001", "practice-202610-0033"],
  ["coverage-059-health-002", "practice-202610-0034"],
  ["coverage-059-restaurants-001", "practice-202610-0035"],
  ["coverage-059-restaurants-002", "practice-202610-0036"],
  ["coverage-059-services-001", "practice-202610-0037"],
  ["coverage-059-services-002", "practice-202610-0038"],
  ["coverage-059-shopping-001", "practice-202610-0039"],
  ["coverage-059-shopping-002", "practice-202610-0040"],
  ["coverage-059-transit-001", "practice-202610-0041"],
  ["coverage-059-transit-002", "practice-202610-0042"],
]);

export function practiceQuestionId(id) {
  const normalized = COVERAGE_QUESTION_ID_ALIASES.get(id) ?? idSnapshot.mapping[id] ?? id;
  if (normalized.startsWith("practice-") && !PRACTICE_QUESTION_ID_PATTERN.test(normalized)) throw new Error(`Invalid standardized Practice question ID: ${normalized}`);
  return normalized;
}

export function isStandardPracticeQuestionId(id) {
  return PRACTICE_QUESTION_ID_PATTERN.test(id);
}

export function createPracticeQuestionId(batch, sequence) {
  if (!/^\d{6}$/.test(String(batch))) throw new Error("Practice question ID batch must be YYYYMM.");
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
    throw new Error("Practice question ID sequence must be an integer from 1 to 9999.");
  }
  return `practice-${batch}-${String(sequence).padStart(4, "0")}`;
}

export function rekeyPracticeQuestionIds(db, { requireAll = false } = {}) {
  const get = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
  const update = db.prepare("UPDATE practice_questions SET id = ? WHERE id = ?");
  let changed = 0;
  for (const [oldId, newId] of Object.entries(idSnapshot.mapping)) {
    if (oldId === newId) continue;
    const oldRow = get.get(oldId);
    const newRow = get.get(newId);
    if (!oldRow) {
      if (newRow || !requireAll) continue;
      throw new Error(`Question ID mapping target missing: ${newId} (from ${oldId})`);
    }
    if (newRow) throw new Error(`Question ID mapping collision: ${oldId} -> ${newId}`);
    if (update.run(newId, oldId).changes !== 1) throw new Error(`Question ID mapping failed: ${oldId}`);
    changed++;
  }
  return changed;
}

export function legacyPracticeQuestionId(id) {
  return Object.entries(idSnapshot.mapping).find(([, newId]) => newId === id)?.[0] ?? id;
}
