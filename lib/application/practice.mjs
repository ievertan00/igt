import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beijingISO } from "../shared/timezone.mjs";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function resolvePracticePath(config = {}) {
  if (config.PracticePath) {
    return path.isAbsolute(config.PracticePath)
      ? config.PracticePath
      : path.join(projectRoot, config.PracticePath);
  }
  const file = config.PracticeFile || "IGT Practice.md";
  if (path.isAbsolute(file)) return file;
  const baseDir = config.VaultDir
    ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
    : path.join(projectRoot, "docs");
  return path.join(baseDir, file);
}

function formatFeedback(feedback) {
  if (typeof feedback === "string") return feedback;
  if (!feedback || typeof feedback !== "object") return "";
  return feedback.feedback_zh || feedback.feedback || feedback.explanation || JSON.stringify(feedback);
}

export function appendPracticeLog({ attempt, config = {} }) {
  if (!attempt || typeof attempt !== "object") throw new Error("Practice attempt is required");
  const targetPath = resolvePracticePath(config);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const now = beijingISO();
  const block = [
    `\n## Practice · ${now}`,
    `- Mode: ${attempt.activityType || "practice"}`,
    `- Context: ${attempt.contextLabel || "independent production"}`,
    ...(attempt.feedback?.question_id ? [
      `- Question: ${attempt.feedback.question_id}`,
      `- Difficulty: ${attempt.feedback.difficulty}`,
      `- Style: ${attempt.feedback.style}`,
      ...(attempt.feedback.focus_id ? [`- Language focus: ${attempt.feedback.focus_id} · ${attempt.targetPattern}`] : []),
      `- Hints used: ${attempt.feedback.hints_used ?? 0}/3`,
    ] : []),
    `- Prompt: ${String(attempt.prompt || "").trim()}`,
    `- Your answer: ${String(attempt.learnerAnswer || "").trim()}`,
    `- Reference answer: ${String(attempt.referenceAnswer || "").trim()}`,
    `- Score: ${attempt.score ?? ""}`,
    `- Feedback: ${formatFeedback(attempt.feedback)}`,
    "",
  ].join("\n");
  fs.appendFileSync(targetPath, block, "utf8");
  return { saved: true, path: targetPath };
}
