import configLoader from "../../shared/config-loader.mjs";
import { readSavedProfiles } from "./saved-profiles.mjs";
import { resolveModel } from "./model-resolver.mjs";

export const cliModelTasks = [
  "grammar", "translation", "word", "practice", "text", "ask", "chat", "coach",
];

export function readCliModels(loader = configLoader) {
  const config = loader.load();
  const saved = readSavedProfiles(loader).filter(profile => profile.models.flash || profile.models.pro);
  const provider = (process.env.IGT_LLM_PROVIDER || config.LLMProvider || "gemini").toLowerCase();
  const legacy = { id: "legacy", name: "现有配置", provider, model: resolveModel(provider, "grammar", config).model };
  const profiles = saved.map(profile => ({
    id: profile.id,
    name: profile.name,
    provider: profile.provider,
    model: profile.models.flash || profile.models.pro,
  }));
  const stored = JSON.parse(loader.env.IGT_CLI_MODELS || "{}");
  const selections = {};
  for (const task of ["default", ...cliModelTasks]) {
    if (profiles.some(profile => profile.id === stored[task])) selections[task] = stored[task];
  }
  const defaultId = selections.default || legacy.id;
  return { config, saved, profiles, legacy, selections, defaultId };
}

export function selectedCliModel(state, task) {
  const id = state.selections[task] || state.defaultId;
  return state.profiles.find(profile => profile.id === id) || state.legacy;
}
