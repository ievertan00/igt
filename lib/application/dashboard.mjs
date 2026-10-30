import { getLearningOverview } from "./learning-overview.mjs";

export async function getDashboard({ config = {}, days = 30, limit = 10, offset = 0 } = {}) {
  return getLearningOverview({ days, limit, offset }, { config });
}
