/**
 * Deepseek LLM Provider
 * Uses OpenAI-compatible API endpoint
 * API: https://api.deepseek.com
 * Supports task-aware model selection (chat for grammar, reasoner for handbook)
 */

import { resolveModel } from "./model-resolver.mjs";

/**
 * Get API keys for Deepseek
 * Priority: Environment variable > Config (DeepseekApiKeys from .env)
 */
function getApiKeys(config) {
  const keys = [];
  
  // Check environment variable
  if (process.env.DEEPSEEK_API_KEY) {
    keys.push(process.env.DEEPSEEK_API_KEY);
  }
  
  // Check config for Deepseek-specific keys (from .env)
  if (config.DeepseekApiKeys && Array.isArray(config.DeepseekApiKeys) && config.DeepseekApiKeys.length > 0) {
    keys.push(...config.DeepseekApiKeys);
  } else if (config.DeepseekApiKey) {
    // Support single key format
    keys.push(config.DeepseekApiKey);
  }
  
  return keys;
}

/**
 * Get model name from config or use default
 * @param {Object} config - Configuration object
 * @param {string} taskType - Task type (grammar, handbook, practice)
 * @returns {string} Model name
 */
function getModelName(config, taskType = "grammar") {
  const { model } = resolveModel("deepseek", taskType, config);
  return model;
}

/**
 * Get API base URL
 */
function getApiBaseUrl(config) {
  return config.DeepseekApiBase || "https://api.deepseek.com/v1";
}

/**
 * Make API call to Deepseek
 */
async function callDeepseekAPI(apiKey, messages, config, taskType = "grammar", responseFormat = null) {
  const baseUrl = getApiBaseUrl(config);
  const model = getModelName(config, taskType);

  const body = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  };
  if (responseFormat) body.response_format = responseFormat;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepseek API error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error("Deepseek API returned no choices");
  }
  
  return data.choices[0].message.content.trim();
}

/**
 * Generate content using Deepseek
 * @param {string} input - User input text
 * @param {string} systemPrompt - System prompt/instruction
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Generated text
 */
async function generate(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar", responseFormat } = options;
  const keys = getApiKeys(config);

  if (keys.length === 0) {
    throw new Error("No Deepseek API keys found. Set DEEPSEEK_API_KEY env var or add DeepseekApiKey to igt_config.json.");
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: input });

  return callDeepseekAPI(keys[0], messages, config, taskType, responseFormat);
}

/**
 * Generate content with automatic retry on failure (tries all keys)
 * @param {string} input - User input text
 * @param {string} systemPrompt - System prompt/instruction
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Generated text
 */
async function generateWithFallback(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar", responseFormat } = options;
  const keys = getApiKeys(config);

  if (keys.length === 0) {
    throw new Error("No Deepseek API keys found. Set DEEPSEEK_API_KEY env var or add DeepseekApiKey to igt_config.json.");
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: input });

  let lastError;
  const MAX_RETRIES_PER_KEY = 2;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    let attempts = 0;

    while (attempts <= MAX_RETRIES_PER_KEY) {
      try {
        return await callDeepseekAPI(key, messages, config, taskType, responseFormat);
      } catch (error) {
        lastError = error;
        attempts++;

        const isNetworkError = 
          error.message.includes("ECONNRESET") || 
          error.message.includes("ETIMEDOUT") || 
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("fetch failed") ||
          error.message.includes("500") ||
          error.message.includes("502") ||
          error.message.includes("503") ||
          error.message.includes("504");

        const isAuthOrQuotaError = 
          error.message.includes("401") || 
          error.message.includes("403") || 
          error.message.includes("429");

        // If it's an auth/quota error, don't retry this key, move to next
        if (isAuthOrQuotaError) {
          break; 
        }

        // If it's a network error and we have retries left, wait a bit and retry
        if (isNetworkError && attempts <= MAX_RETRIES_PER_KEY) {
          const delay = attempts * 500;
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // Otherwise, move to next key
        break;
      }
    }
  }

  const msg = keys.length > 1 
    ? `All ${keys.length} Deepseek API keys failed. Last error: ${lastError?.message || "unknown"}`
    : `Deepseek API failed. Error: ${lastError?.message || "unknown"}`;
  throw new Error(msg);
}

export default {
  name: "deepseek",
  generate,
  generateWithFallback,
  getApiKeys,
  getModelName
};
