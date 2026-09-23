import fs from "node:fs";
import path from "node:path";
import { getLearningProfileData } from "../features/handbook/queries.mjs";
import { buildLearningDiagnosis } from "../features/learning-diagnosis/index.mjs";

const cache = new Map();
const inFlight = new Map();
const forcedAt = new Map();
const FORCE_THROTTLE_MS = 1000;

function safeDays(value) {
  return Number.isInteger(value) && value >= 0 ? Math.min(value, 3650) : 30;
}

function reviewPath(config = {}) {
  const value = config.ReviewPath || "00_Review_logs.md";
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function fingerprint(filePath, entryCount, days) {
  let stat = null;
  try {
    stat = fs.statSync(filePath);
  } catch {
    // A missing Review log is a valid empty-asset state.
  }
  return [filePath, stat?.mtimeMs || 0, stat?.size || 0, entryCount, days].join("|");
}

function cachedResult(result, hit, throttled = false) {
  return { ...result, cache: { hit, throttled } };
}

export async function analyzeCoach({
  windowDays = 30,
  config = {},
  force = false,
  now = Date.now(),
  loadData = getLearningProfileData,
  build = buildLearningDiagnosis,
} = {}) {
  const days = safeDays(windowDays);
  const data = await loadData(days);
  const entryCount = Array.isArray(data?.entries) ? data.entries.length : Number(data?.totalInputs || 0);
  const key = fingerprint(reviewPath(config), entryCount, days);
  const existing = cache.get(key);
  const lastForced = forcedAt.get(key) || 0;

  if (force && existing && now - lastForced < FORCE_THROTTLE_MS) {
    return cachedResult(existing, true, true);
  }
  if (!force && existing) return cachedResult(existing, true);

  const running = inFlight.get(key);
  if (running) return cachedResult(await running, false);

  const task = Promise.resolve(build({
    days,
    goal: "general English",
    resourceMode: "local",
    vaultDir: config.VaultDir || null,
    now,
    loadData: async () => data,
  })).then((result) => {
    cache.set(key, result);
    if (force) forcedAt.set(key, now);
    if (cache.size > 8) cache.delete(cache.keys().next().value);
    return result;
  }).finally(() => inFlight.delete(key));

  inFlight.set(key, task);
  return cachedResult(await task, false);
}

export function clearCoachCache() {
  cache.clear();
  inFlight.clear();
  forcedAt.clear();
}
