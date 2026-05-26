import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * LLM Provider Manager
 * Handles switching between different LLM providers (Gemini, Qwen, Deepseek)
 */

class LLMProviderManager {
  constructor() {
    this.providers = new Map();
    this.currentProvider = null;
    this.config = null;
  }

  /**
   * Set configuration (from config-loader)
   */
  setConfig(config) {
    this.config = config;

    // Determine current provider from config or environment
    const providerName = process.env.IGT_LLM_PROVIDER ||
                         config.LLMProvider ||
                         "gemini";

    this.currentProvider = providerName.toLowerCase();
  }

  /**
   * Register a new LLM provider
   * @param {string} name - Provider name (e.g., 'gemini', 'qwen', 'deepseek')
   * @param {Object} providerImpl - Provider implementation with generate() method
   */
  registerProvider(name, providerImpl) {
    this.providers.set(name.toLowerCase(), providerImpl);
  }

  /**
   * Get current provider instance
   * @returns {Object} Provider implementation
   */
  getCurrentProvider() {
    if (!this.config) {
      throw new Error("Configuration not loaded. Call setConfig() first.");
    }

    const provider = this.providers.get(this.currentProvider);
    if (!provider) {
      throw new Error(
        `Unknown LLM provider: "${this.currentProvider}". ` +
        `Available providers: ${Array.from(this.providers.keys()).join(", ")}`
      );
    }

    return provider;
  }

  /**
   * Switch to a different LLM provider
   * @param {string} providerName - Provider name to switch to
   * @param {Object} options - Options (e.g., { updateEnv: true })
   */
  switchProvider(providerName, options = { updateEnv: true }) {
    const name = providerName.toLowerCase();
    if (!this.providers.has(name)) {
      throw new Error(
        `Unknown provider: "${providerName}". ` +
        `Available: ${Array.from(this.providers.keys()).join(", ")}`
      );
    }

    this.currentProvider = name;

    // Update .env file
    if (options.updateEnv) {
      this.updateEnvProvider(name);
    }

    // Update config
    if (this.config) {
      this.config.LLMProvider = name;
    }

    return name;
  }

  /**
   * Update provider in .env file
   */
  updateEnvProvider(providerName) {
    try {
      // Import config-loader dynamically to avoid circular dependency
      import("../../shared/config-loader.mjs").then(({ configLoader }) => {
        configLoader.updateEnv({ IGT_LLM_PROVIDER: providerName });
      }).catch(() => {
        // Silently fail if config-loader is not available
      });
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * List all available providers
   * @returns {Array<string>} Available provider names
   */
  listProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Get current provider name
   * @returns {string} Current provider name
   */
  getCurrentProviderName() {
    return this.currentProvider || "unknown";
  }

  /**
   * Generate content using current provider
   * @param {string} input - User input text
   * @param {string} systemPrompt - System prompt/instruction
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Generated text
   */
  async generate(input, systemPrompt, options = {}) {
    const provider = this.getCurrentProvider();
    return provider.generate(input, systemPrompt, {
      config: this.config,
      ...options
    });
  }

  /**
   * Generate content with automatic retry on failure (tries all keys)
   * @param {string} input - User input text
   * @param {string} systemPrompt - System prompt/instruction
   * @param {Object} options - Additional options
   * @returns {Promise<string>} Generated text
   */
  async generateWithFallback(input, systemPrompt, options = {}) {
    const provider = this.getCurrentProvider();
    return provider.generateWithFallback(input, systemPrompt, {
      config: this.config,
      ...options
    });
  }

  /**
   * Generate with native function-calling tool loop (Gemini/Qwen/Deepseek),
   * or pre-retrieval injection for providers that don't support tool calling (Ollama).
   *
   * @param {string} userMessage
   * @param {string} systemPrompt
   * @param {Array} toolDefs       - canonical tool definitions (from lib/db/grammar-ref.mjs)
   * @param {Function} toolExecutor - async ({ query }) => { result: string, sources: [] }
   * @param {Object} options        - forwarded to provider (taskType, etc.)
   * @returns {Promise<{ content: string, sources: Array<{book,unit,title}> }>}
   */
  async generateWithTools(userMessage, systemPrompt, toolDefs, toolExecutor, options = {}) {
    const TOOL_CAPABLE = new Set(["gemini", "qwen", "deepseek"]);

    if (TOOL_CAPABLE.has(this.currentProvider)) {
      const provider = this.getCurrentProvider();
      return provider.generateWithTools(userMessage, systemPrompt, toolDefs, toolExecutor, {
        config: this.config,
        ...options,
      });
    }

    // Ollama (and any future non-tool provider): pre-retrieve top-2 chunks and inject
    const preFetch = await toolExecutor({ query: userMessage });
    let augmentedPrompt = systemPrompt;
    if (preFetch.result && !preFetch.result.startsWith("No relevant")) {
      augmentedPrompt =
        `${systemPrompt}\n\n` +
        `## Reference Material from Grammar Books\n\n` +
        `${preFetch.result}\n\n` +
        `Use the above reference material to ground your answer if relevant.`;
    }

    const content = await this.generateWithFallback(userMessage, augmentedPrompt, options);
    return { content, sources: [] };
  }
}

// Singleton instance
const llmManager = new LLMProviderManager();

export { LLMProviderManager, llmManager };
export default llmManager;
