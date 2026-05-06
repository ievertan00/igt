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
  const MAX_RETRIES_PER_KEY = 2;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    let attempts = 0;

    while (attempts <= MAX_RETRIES_PER_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel(buildModelConfig(config, taskType, systemPrompt, responseSchema));
        const result = await model.generateContent(input);
        return result.response.text().trim();
      } catch (error) {
        lastError = error;
        attempts++;

        const isNetworkError = 
          error.message.includes("ECONNRESET") || 
          error.message.includes("ETIMEDOUT") || 
          error.message.includes("ECONNREFUSED") ||
          error.message.includes("socket disconnected") ||
          error.message.includes("TLS connection") ||
          error.message.includes("EAI_AGAIN") ||
          error.message.includes("ENOTFOUND") ||
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
    ? `All ${keys.length} Gemini API keys failed. Last error: ${lastError?.message || "unknown"}`
    : `Gemini API failed. Error: ${lastError?.message || "unknown"}`;
  throw new Error(msg);
}

export default {
  name: "gemini",
  generate,
  generateWithFallback,
  getApiKeys,
  getModelName
};
