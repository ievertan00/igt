import { getErrorFrequency, getExamples, getTotalStats } from "../features/handbook/queries.mjs";

export async function getHandbook({ days = 90, errorType = "" } = {}) {
  const safeDays = Math.min(3650, Math.max(0, Number(days) || 0));
  const [frequencies, stats] = await Promise.all([getErrorFrequency(safeDays), getTotalStats(safeDays)]);
  const selected = errorType || frequencies[0]?.error_type || null;
  const examples = selected ? await getExamples(selected, 5) : [];
  return { days: safeDays, stats, frequencies, selected, examples };
}
