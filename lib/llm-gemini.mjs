/**
 * Google Gemini LLM Provider
 * Refactored from original implementation to use unified interface
 * Supports task-aware model selection (flash for grammar, pro for handbook)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { resolveModel } from "./model-resolver.mjs";

/**
 * Get API keys for Gemini
 * Priority: Environment variable > Config (GeminiApiKeys from .env)
 */
function getApiKeys(config) {
  const keys = [];
  
  // Check environment variable (single key for backward compatibility)
  if (process.env.GOOGLE_API_KEY) {
    keys.push(process.env.GOOGLE_API_KEY);
  }
  
  // Check config for Gemini-specific keys (from .env GeminiApiKeys)
  if (config.GeminiApiKeys && Array.isArray(config.GeminiApiKeys) && config.GeminiApiKeys.length > 0) {
    keys.push(...config.GeminiApiKeys);
  } else if (config.ApiKeys && Array.isArray(config.ApiKeys) && config.ApiKeys.length > 0) {
    // Backward compatibility with old config format
    keys.push(...config.ApiKeys);
  } else if (config.ApiKey) {
    // Support old single key format
    keys.push(config.ApiKey);
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
  const { model } = resolveModel("gemini", taskType, config);
  return model;
}

/**
 * Generate content using Gemini SDK
 * @param {string} input - User input text
 * @param {string} systemPrompt - System prompt/instruction
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Generated text
 */
function buildModelConfig(config, taskType, systemPrompt, responseSchema) {
  const cfg = {
    model: getModelName(config, taskType),
    systemInstruction: systemPrompt,
  };
  if (responseSchema) {
    cfg.generationConfig = {
      responseMimeType: "application/json",
      responseSchema,
    };
  }
  return cfg;
}

async function generate(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar", responseSchema } = options;
  const keys = getApiKeys(config);

  if (keys.length === 0) {
    throw new Error("No Gemini API keys found. Set GOOGLE_API_KEY env var or add ApiKeys to igt_config.json.");
  }

  const genAI = new GoogleGenerativeAI(keys[0]);
  const model = genAI.getGenerativeModel(buildModelConfig(config, taskType, systemPrompt, responseSchema));
  const result = await model.generateContent(input);
  return result.response.text().trim();
}

/**
 * Generate content with automatic retry on failure (tries all keys)
 * @param {string} input - User input text
 * @param {string} systemPrompt - System prompt/instruction
 * @param {Object} options - Additional options
 * @returns {Promise<string>} Generated text
 */
async function generateWithFallback(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar", responseSchema } = options;
  const keys = getApiKeys(config);

  if (keys.length === 0) {
    throw new Error("No Gemini API keys found. Set GOOGLE_API_KEY env var or add ApiKeys to igt_config.json.");
  }

  let lastError;
  for (const key of keys) {
    try {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel(buildModelConfig(config, taskType, systemPrompt, responseSchema));
      const result = await model.generateContent(input);
      return result.response.text().trim();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`All ${keys.length} Gemini API key(s) exhausted. Last error: ${lastError?.message || "unknown"}`);
}

export default {
  name: "gemini",
  generate,
  generateWithFallback,
  getApiKeys,
  getModelName
};
