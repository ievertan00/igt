/**
 * Deepseek LLM Provider
 * Uses OpenAI-compatible API endpoint
 * API: https://api.deepseek.com
 * Supports task-aware model selection (chat for grammar, reasoner for handbook)
 * Forced direct connection support for TUN/VPN environments
 */

import { fetchDirect, taskTimeout } from "./http-client.mjs";
import { resolveModel } from "./model-resolver.mjs";

function getApiKeys(config) {
  const keys = [];
  if (process.env.DEEPSEEK_API_KEY) {
    keys.push(process.env.DEEPSEEK_API_KEY);
  }
  if (config.DeepseekApiKeys && Array.isArray(config.DeepseekApiKeys) && config.DeepseekApiKeys.length > 0) {
    keys.push(...config.DeepseekApiKeys);
  } else if (config.DeepseekApiKey) {
    keys.push(config.DeepseekApiKey);
  }
  return keys;
}

function getModelName(config, taskType = "grammar") {
  const { model } = resolveModel("deepseek", taskType, config);
  return model;
}

function getApiBaseUrl(config) {
  return config.DeepseekApiBase || "https://api.deepseek.com/v1";
}


async function callDeepseekAPI(apiKey, messages, config, taskType = "grammar", responseFormat = null, timeout) {
  timeout = taskTimeout(taskType, timeout);
  const baseUrl = getApiBaseUrl(config);
  const model = getModelName(config, taskType);
  const localAddress = config.LocalAddress || process.env.IGT_LOCAL_ADDRESS;

  const body = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  };
  if (responseFormat) body.response_format = responseFormat;

  const jsonBody = JSON.stringify(body);
  const response = await fetchDirect(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Content-Length": Buffer.byteLength(jsonBody)
    },
    body: jsonBody,
    localAddress,
    timeout
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

async function generate(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar", responseFormat, timeout = 60000 } = options;
  const keys = getApiKeys(config);
  if (keys.length === 0) {
    throw new Error("No Deepseek API keys found. Set DEEPSEEK_API_KEY env var or add DeepseekApiKey to igt_config.json.");
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: input });

  return callDeepseekAPI(keys[0], messages, config, taskType, responseFormat, timeout);
}

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

  for (const key of keys) {
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

        if (isAuthOrQuotaError) break;

        if (isNetworkError && attempts <= MAX_RETRIES_PER_KEY) {
          await new Promise(r => setTimeout(r, attempts * 500));
          continue;
        }

        break;
      }
    }
  }

  const msg = keys.length > 1
    ? `All ${keys.length} Deepseek API keys failed. Last error: ${lastError?.message || "unknown"}`
    : `Deepseek API failed. Error: ${lastError?.message || "unknown"}`;
  throw new Error(msg);
}

// ── Tool helpers ──────────────────────────────────────────────────────────────

function dedup(sources) {
  const seen = new Set();
  return sources.filter(s => {
    const key = `${s.book}||${s.unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Single HTTP call that accepts an OpenAI-compat tools array.
 * Returns { toolCall, content } — only one is non-null.
 */
async function callDeepseekAPIOnce(apiKey, messages, tools, config, taskType, toolChoice = "auto", timeout) {
  timeout = taskTimeout(taskType, timeout);
  const baseUrl = getApiBaseUrl(config);
  const model = getModelName(config, taskType);
  const localAddress = config.LocalAddress || process.env.IGT_LOCAL_ADDRESS;

  const body = {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
    tools,
    tool_choice: toolChoice,
  };
  const jsonBody = JSON.stringify(body);

  const response = await fetchDirect(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Content-Length": Buffer.byteLength(jsonBody),
    },
    body: jsonBody,
    localAddress,
    timeout,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepseek API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) throw new Error("Deepseek API returned no choices");

  const message = data.choices[0].message;
  if (message.tool_calls?.length) {
    return { toolCall: message.tool_calls[0], content: null };
  }
  return { toolCall: null, content: (message.content || "").trim() };
}

/**
 * Force a final text answer without tools.
 */
async function callDeepseekFinalAnswer(apiKey, messages, config, taskType, timeout) {
  timeout = taskTimeout(taskType, timeout);
  const baseUrl = getApiBaseUrl(config);
  const model = getModelName(config, taskType);
  const localAddress = config.LocalAddress || process.env.IGT_LOCAL_ADDRESS;

  const body = { model, messages, temperature: 0.7, max_tokens: 4096 };
  const jsonBody = JSON.stringify(body);

  const response = await fetchDirect(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Content-Length": Buffer.byteLength(jsonBody),
    },
    body: jsonBody,
    localAddress,
    timeout,
  });

  if (!response.ok) throw new Error(`Deepseek final answer error (${response.status})`);
  const data = await response.json();
  return (data.choices[0].message.content || "").trim();
}

/**
 * Generate with native function-calling support (tool loop).
 *
 * @param {string} userMessage
 * @param {string} systemPrompt
 * @param {Array} toolDefs    - canonical tool defs
 * @param {Function} toolExecutor - async ({ query }) => { result, sources }
 * @param {Object} options    - { config, taskType }
 * @returns {Promise<{ content: string, sources: Array<{book,unit,title}> }>}
 */
async function generateWithTools(userMessage, systemPrompt, toolDefs, toolExecutor, options = {}) {
  const { config, taskType = "grammar", timeout: timeoutOpt } = options;
  const timeout = taskTimeout(taskType, timeoutOpt);
  const keys = getApiKeys(config);
  if (keys.length === 0) throw new Error("No Deepseek API keys found.");

  const openAITools = toolDefs.map(def => ({ type: "function", function: def }));
  const MAX_TOOL_ITERATIONS = 3;
  const MAX_RETRIES_PER_KEY = 2;
  let lastError;

  for (const key of keys) {
    let attempts = 0;
    while (attempts <= MAX_RETRIES_PER_KEY) {
      try {
        const messages = [];
        if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
        messages.push({ role: "user", content: userMessage });
        const sources = [];
        let iter = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          // Force the first lookup; subsequent iterations let the model decide.
          const toolChoice = iter === 0 ? "required" : "auto";
          const { toolCall, content } = await callDeepseekAPIOnce(key, messages, openAITools, config, taskType, toolChoice, timeout);

          if (!toolCall) {
            return { content: content || "", sources: dedup(sources) };
          }

          if (iter >= MAX_TOOL_ITERATIONS) {
            messages.push({ role: "assistant", content: null, tool_calls: [toolCall] });
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: "Maximum lookups reached. Provide your final answer now.",
            });
            const finalContent = await callDeepseekFinalAnswer(key, messages, config, taskType, timeout);
            return { content: finalContent, sources: dedup(sources) };
          }

          // Parse and execute tool call
          let args;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            const finalContent = await callDeepseekFinalAnswer(key, messages, config, taskType, timeout);
            return { content: finalContent, sources: dedup(sources) };
          }

          const toolResult = await toolExecutor({ query: args.query });
          sources.push(...toolResult.sources);

          messages.push({ role: "assistant", content: null, tool_calls: [toolCall] });
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult.result });
          iter++;
        }
      } catch (error) {
        lastError = error;
        attempts++;

        // Deepseek Reasoner may not support tools — fall back to plain generate()
        if (error.message.includes("does not support tool") || error.message.includes("tool_calls") || error.message.includes("tool_choice")) {
          try {
            const content = await generate(userMessage, systemPrompt, options);
            return { content, sources: [] };
          } catch {
            // ignore fallback error; continue to next key
          }
          break;
        }

        const isNetworkError =
          error.message.includes("ECONNRESET") || error.message.includes("ETIMEDOUT") ||
          error.message.includes("ECONNREFUSED") || error.message.includes("socket disconnected") ||
          error.message.includes("TLS connection") || error.message.includes("EAI_AGAIN") ||
          error.message.includes("ENOTFOUND") || error.message.includes("fetch failed") ||
          error.message.includes("500") || error.message.includes("502") ||
          error.message.includes("503") || error.message.includes("504");

        if (isNetworkError && attempts <= MAX_RETRIES_PER_KEY) {
          await new Promise(r => setTimeout(r, attempts * 500));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`Deepseek generateWithTools failed. Last error: ${lastError?.message}`);
}

export default {
  name: "deepseek",
  generate,
  generateWithFallback,
  generateWithTools,
  getApiKeys,
  getModelName
};
