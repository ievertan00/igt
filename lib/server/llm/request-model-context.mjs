import { AsyncLocalStorage } from "node:async_hooks";
import { cliModelTasks } from "./cli-models.mjs";

const requests = new AsyncLocalStorage();

export function withRequestModel(req, run) {
  const profileId = req.headers?.["x-igt-model-profile"];
  if (profileId != null && (typeof profileId !== "string" || !profileId || profileId.length > 80 || /[\r\n\0]/.test(profileId))) {
    throw Object.assign(new Error("Invalid model configuration ID"), { status: 400, code: "INVALID_REQUEST" });
  }
  const cliTask = req.headers?.["x-igt-cli-task"];
  if (cliTask != null && (!cliModelTasks.includes(cliTask) || profileId)) {
    throw Object.assign(new Error("Invalid CLI model task"), { status: 400, code: "INVALID_REQUEST" });
  }
  return requests.run({ profileId, cliTask }, run);
}

export const getRequestModelContext = () => requests.getStore();
