/**
 * LLM Provider Initializer
 * Registers all available LLM providers and sets up the default provider
 * Uses config-loader to merge .env and config.json
 */

import { llmManager } from "./llm-provider.mjs";
import configLoader from "./config-loader.mjs";
import geminiProvider from "./llm-gemini.mjs";
import qwenProvider from "./llm-qwen.mjs";
import deepseekProvider from "./llm-deepseek.mjs";
import ollamaProvider from "./llm-ollama.mjs";

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
