import configLoader from "../../shared/config-loader.mjs";
import { initializeLLMProviders } from "./init.mjs";
import { readSavedProfiles } from "./saved-profiles.mjs";
import { getRequestModelContext } from "./request-model-context.mjs";
import { readCliModels, selectedCliModel } from "./cli-models.mjs";

export function createProfileManager(profileId, loader = configLoader) {
  const resolved = loader.load();
  const profiles = readSavedProfiles(loader);
  const profile = profiles.find(value => value.id === profileId);
  if (!profile && !(profileId === "current" && !loader.env.IGT_LLM_PROFILES)) {
    throw Object.assign(new Error("Saved model configuration was not found. Choose another model."), { status: 404, code: "MODEL_PROFILE_NOT_FOUND" });
  }
  return buildManager(resolved, profile, profileId);
}

function buildManager(resolved, profile, profileId, selectedModel) {
  const config = { ...resolved, ModelProfileId: profileId };
  if (selectedModel) config.SelectedModel = selectedModel;
  if (profile) {
    delete config.DefaultModel;
    config.LLMProvider = profile.provider;
    if (profile.provider === "ollama") {
      const family = (profile.ollamaFamily || "gemma").toLowerCase();
      const title = family.charAt(0).toUpperCase() + family.slice(1);
      Object.assign(config, { OllamaFamily: family, OllamaBaseUrl: profile.baseUrl,
        [`Ollama${title}FlashModel`]: profile.models.flash, [`Ollama${title}ProModel`]: profile.models.pro });
    } else {
      const title = { custom: "Custom", gemini: "Gemini", qwen: "Qwen", deepseek: "Deepseek" }[profile.provider];
      Object.assign(config, { [`${title}ApiKeys`]: [...profile.apiKeys], [`${title}ApiBase`]: profile.baseUrl,
        [`${title}FlashModel`]: profile.models.flash, [`${title}ProModel`]: profile.models.pro });
    }
  }
  const manager = initializeLLMProviders(config);
  // The legacy initializer also considers process.env; this request's profile wins.
  manager.switchProvider(config.LLMProvider || "gemini", { updateEnv: false });
  return manager;
}

export function createCliModelManager(task, loader = configLoader) {
  const state = readCliModels(loader);
  const selected = selectedCliModel(state, task);
  const profile = state.saved.find(profile => profile.id === selected.id);
  // Legacy providers can still obtain credentials from their environment.
  return buildManager({ ...state.config, LLMProvider: selected.provider }, profile, profile?.id, selected.model);
}

export function requestModelManager(getDefaultManager, loader = configLoader) {
  return async (options = {}) => {
    const context = getRequestModelContext();
    if (options.validateKeys === false) return getDefaultManager(options);
    if (context?.cliTask) {
      context.manager ??= createCliModelManager(context.cliTask, loader);
      return context.manager;
    }
    if (!context?.profileId) return getDefaultManager(options);
    // The config snapshot belongs to this request, including after awaits/tool calls.
    context.manager ??= createProfileManager(context.profileId, loader);
    return context.manager;
  };
}
