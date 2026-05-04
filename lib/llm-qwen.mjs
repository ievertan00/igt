/**
 * Qwen (DashScope/Alibaba Cloud) LLM Provider
 * Uses OpenAI-compatible API endpoint for Qwen models
 * API: https://dashscope.aliyuncs.com/compatible-mode/v1
 * Supports task-aware model selection (flash for grammar, pro for handbook)
 */

import { resolveModel } from "./model-resolver.mjs";

/**
 * Get API keys for Qwen
 * Priority: Environment variable > Config (QwenApiKeys from .env)
 */
function getApiKeys(config) {
  const keys = [];
  
  // Check environment variable
  if (process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY) {
    keys.push(process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY);
  }
  
  // Check config for Qwen-specific keys (from .env)
  if (config.QwenApiKeys && Array.isArray(config.QwenApiKeys) && config.QwenApiKeys.length > 0) {
    keys.push(...config.QwenApiKeys);
  } else if (config.QwenApiKey) {
    // Support single key format
    keys.push(config.QwenApiKey);
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
  const { model } = resolveModel("qwen", taskType, config);
  return model;
}

/**
 * Get API base URL
 */
function getApiBaseUrl(config) {
  return config.QwenApiBase || "https://dashscope.aliyuncs.com/compatible-mode/v1";
}

/**
 * Make API call to Qwen/DashScope
 */
async function callQwenAPI(apiKey, messages, config, taskType = "grammar", responseFormat = null) {
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
    throw new Error(`Qwen API error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.choices || data.choices.length === 0) {
    throw new Error("Qwen API returned no choices");
  }
  
  return data.choices[0].message.content.trim();
}

/**
 * Generate content using Qwen
 * @param {string} input - User input text
 * @param {string} systemPrompt - System prompt/instruction
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Generated text
 */
async function generate(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar", responseFormat } = options;
  const keys = getApiKeys(config);

  if (keys.length === 0) {
    throw new Error("No Qwen API keys found. Set DASHSCOPE_API_KEY/QWEN_API_KEY env var or add QwenApiKeys to igt_config.json.");
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: input });

  return callQwenAPI(keys[0], messages, config, taskType, responseFormat);
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
    throw new Error("No Qwen API keys found. Set DASHSCOPE_API_KEY/QWEN_API_KEY env var or add QwenApiKeys to igt_config.json.");
  }

  let lastError;
  for (const key of keys) {
    try {
      const messages = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      messages.push({ role: "user", content: input });
      return await callQwenAPI(key, messages, config, taskType, responseFormat);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`All ${keys.length} Qwen API key(s) exhausted. Last error: ${lastError?.message || "unknown"}`);
}

export default {
  name: "qwen",
  generate,
  generateWithFallback,
  getApiKeys,
  getModelName
};
