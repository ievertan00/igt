/**
 * LLM Provider Initializer
 * Registers all available LLM providers and sets up the default provider
 * Uses config-loader to merge .env and config.json
 */

import { LLMProviderManager } from "./manager.mjs";
import configLoader from "../../shared/config-loader.mjs";
import geminiProvider from "./gemini.mjs";
import qwenProvider from "./qwen.mjs";
import deepseekProvider from "./deepseek.mjs";
import ollamaProvider from "./ollama.mjs";

/**
 * Initialize and register all LLM providers
 * @param {Object} [config] - Pre-loaded config; falls back to configLoader.load() if omitted
 */
export function initializeLLMProviders(config) {
  const resolvedConfig = config ?? configLoader.load();
  const llmManager = new LLMProviderManager(resolvedConfig);

  llmManager.registerProvider("gemini", geminiProvider);
  llmManager.registerProvider("qwen", qwenProvider);
  llmManager.registerProvider("deepseek", deepseekProvider);
  llmManager.registerProvider("ollama", ollamaProvider);

  return llmManager;
}

export { configLoader };
export default initializeLLMProviders;
