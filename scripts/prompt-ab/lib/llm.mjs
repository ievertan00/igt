import { initializeLLMProviders } from "../../../lib/server/llm/init.mjs";
import { resolveModel } from "../../../lib/server/llm/model-resolver.mjs";

export function createGenerationManager(config) {
  return initializeLLMProviders(config);
}

// Every provider resolves its model through resolveModel(), where SelectedModel
// wins over task-tier fields — so one config clone pins the judge model for all
// providers without touching production code paths.
export function createJudgeManager(config, { provider, model } = {}) {
  const judgeConfig = { ...config };
  if (provider) judgeConfig.LLMProvider = provider;
  const manager = initializeLLMProviders(judgeConfig);
  const judgeProvider = manager.getCurrentProviderName();
  const tierModel = resolveModel(judgeProvider, "handbook", { ...judgeConfig, SelectedModel: undefined }).model;
  const judgeModel = model || process.env.IGT_AB_JUDGE_MODEL || tierModel;
  judgeConfig.SelectedModel = judgeModel;
  return { manager, provider: judgeProvider, model: judgeModel };
}

export function describeGenerationModels(manager, config) {
  const provider = manager.getCurrentProviderName();
  return {
    provider,
    grammar: resolveModel(provider, "grammar", config).model,
    ask: resolveModel(provider, "ask", config).model,
    coach: resolveModel(provider, "handbook", config).model,
  };
}