/**
 * Qwen (DashScope/Alibaba Cloud) LLM Provider
 * Uses OpenAI-compatible API endpoint for Qwen models
 * API: https://dashscope.aliyuncs.com/compatible-mode/v1
 * Supports task-aware model selection (flash for grammar, pro for handbook)
 */

import https from "node:https";
import { resolveModel } from "./model-resolver.mjs";

// Reuse connections but bypass any HTTPS_PROXY env var (https.request ignores it)
const directAgent = new https.Agent({ keepAlive: true });

function fetchDirect(url, { method, headers, body }) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname, search } = new URL(url);
    const req = https.request(
      { hostname, path: pathname + search, method, headers, agent: directAgent },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString();
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            text: () => Promise.resolve(text),
            json: () => Promise.resolve(JSON.parse(text)),
          });
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

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

  const response = await fetchDirect(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Content-Length": Buffer.byteLength(JSON.stringify(body)),
    },
    body: JSON.stringify(body),
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
        return await callQwenAPI(key, messages, config, taskType, responseFormat);
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
    ? `All ${keys.length} Qwen API keys failed. Last error: ${lastError?.message || "unknown"}`
    : `Qwen API failed. Error: ${lastError?.message || "unknown"}`;
  throw new Error(msg);
}

export default {
  name: "qwen",
  generate,
  generateWithFallback,
  getApiKeys,
  getModelName
};
