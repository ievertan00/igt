import { generateAndSaveCoachPlan } from "../lib/features/learning-diagnosis/ai-coach.mjs";
import initializeLLMProviders from "../lib/server/llm/init.mjs";
import { resolveModel } from "../lib/server/llm/model-resolver.mjs";
import { renderCoachPlan } from "../lib/features/learning-diagnosis/coach.mjs";
import {
  completeLearningTaskById,
  createLearningPlanFromDiagnosis,
  pauseActiveLearningPlanById,
  resumeLearningTaskById,
  resumeLearningPlanNow,
  skipLearningTaskById,
} from "../lib/features/learning-diagnosis/plans.mjs";
import configLoader from "../lib/shared/config-loader.mjs";

const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
  const arg = args.find((item) => item.startsWith(`${name}=`));
  return arg ? arg.slice(name.length + 1) : fallback;
};
const parsedDays = Number(valueOf("--days", "90"));
const days = Number.isInteger(parsedDays) && parsedDays >= 0 && parsedDays <= 3650 ? parsedDays : 90;
const resourceMode = valueOf("--resources", "local-and-web");
const config = configLoader.load();
const completedTask = valueOf("--complete", "");
const skippedTask = valueOf("--skip", "");
const resumedTask = valueOf("--resume", "");
const pausePlan = args.includes("--pause-plan");
const resumePlan = args.includes("--resume-plan");

if (pausePlan || resumePlan) {
  const changed = pausePlan ? await pauseActiveLearningPlanById() : await resumeLearningPlanNow();
  process.stdout.write(changed
    ? (pausePlan ? "Learning plan paused.\n" : "Learning plan resumed.\n")
    : (pausePlan ? "No active learning plan to pause.\n" : "No paused learning plan to resume.\n"));
  process.exit(changed ? 0 : 1);
}

if (completedTask || skippedTask || resumedTask) {
  const operation = completedTask ? "complete" : skippedTask ? "skip" : "resume";
  const rawTaskId = completedTask || skippedTask || resumedTask;
  const taskId = Number(rawTaskId);
  if (!Number.isInteger(taskId) || taskId < 1) {
    process.stdout.write("Usage: /coach --complete=<task-id> | --skip=<task-id> | --resume=<task-id>\n");
    process.exit(1);
  }
  const handlers = { complete: completeLearningTaskById, skip: skipLearningTaskById, resume: resumeLearningTaskById };
  const changed = await handlers[operation](taskId);
  const state = { complete: "completed", skip: "skipped", resume: "resumed" }[operation];
  process.stdout.write(changed ? `Learning task #${taskId} ${state}.\n` : `Learning task #${taskId} cannot be ${operation}d in its current state.\n`);
  process.exit(changed ? 0 : 1);
}

if (args.some((arg) => arg === "--goal" || arg.startsWith("--goal="))) {
  process.stdout.write("/coach now analyzes general English ability; --goal is ignored. Domain weaknesses are inferred from evidence.\n");
}
try {
  const llm = initializeLLMProviders(config);
  const provider = llm.getCurrentProviderName();
  const model = resolveModel(provider, "coach", config).model;
  process.stdout.write(`Analyzing English learning evidence with ${provider} (${model})...\n`);
  const diagnosis = await generateAndSaveCoachPlan({ llm, days, resourceMode, vaultDir: config.VaultDir }, createLearningPlanFromDiagnosis);
  process.stdout.write(renderCoachPlan({ ...diagnosis, provider, model }));
  if (!diagnosis.planId) process.stdout.write("No new plan created; the existing plan is unchanged.\n");
} catch (error) {
  process.stderr.write(`Coach analysis failed: ${error.message}\nNo replacement plan was created. Please retry after checking the model configuration.\n`);
  process.exitCode = 1;
}
