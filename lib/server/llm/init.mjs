/**
 * LLM Provider Initializer
 * Registers all available LLM providers and sets up the default provider
 * Uses config-loader to merge .env and config.json
 */

import { llmManager } from "./manager.mjs";
import configLoader from "../../shared/config-loader.mjs";
import geminiProvider from "./gemini.mjs";
import qwenProvider from "./qwen.mjs";
import deepseekProvider from "./deepseek.mjs";
import ollamaProvider from "./ollama.mjs";

/**
 * Initialize and register all LLM providers
 */
export function initializeLLMProviders() {
  // Register all providers
  llmManager.registerProvider("gemini", geminiProvider);
  llmManager.registerProvider("qwen", qwenProvider);
  llmManager.registerProvider("deepseek", deepseekProvider);
  llmManager.registerProvider("ollama", ollamaProvider);

  // Load config (merges .env and config.json)
  const config = configLoader.load();
  llmManager.setConfig(config);

  return llmManager;
}

export { llmManager, configLoader };
export default initializeLLMProviders;
