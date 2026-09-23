import fs from "node:fs";
import path from "node:path";
import { getStats, getTodayEffort, getReviewLearningData } from "../db/stats.mjs";
import { dashboardResponse } from "../contracts/dashboard.mjs";

function exists(value, projectRoot) {
  if (!value) return false;
  return fs.existsSync(path.isAbsolute(value) ? value : path.join(projectRoot, value));
}

export async function getDashboard({ config, projectRoot }) {
  const [stats, today] = await Promise.all([getStats(), getTodayEffort()]);
  const learning = getReviewLearningData(30);
  const recentActivity = learning.entries.slice(-10).reverse().map((entry) => ({
    entryId: entry.entryId,
    timestamp: entry.timestamp,
    userInput: entry.userInput,
    correction: entry.correction,
    diagnoses: entry.diagnoses,
  }));
  return dashboardResponse({
    today,
    stats,
    recentActivity,
    assets: {
      reviewLog: exists(config.ReviewPath || "00_Review_logs.md", projectRoot),
      vocabulary: exists(config.VocabularyPath || config.VocabFile, projectRoot),
      ask: exists(config.AskPath || config.AskFile || config.AskDir, projectRoot),
      practice: exists(config.PracticePath || config.PracticeFile, projectRoot),
    },
    coach: { focus: stats.priorities?.[0] || null },
  });
}
