/**
 * Qwen (DashScope/Alibaba Cloud) LLM Provider
 * Uses OpenAI-compatible API endpoint for Qwen models
 * API: https://dashscope.aliyuncs.com/compatible-mode/v1
 * Supports task-aware model selection (flash for grammar, pro for handbook)
 * Forced direct connection support for TUN/VPN environments
 */

import https from "node:https";
import dns from "node:dns/promises";
import { resolveModel } from "./model-resolver.mjs";

/**
 * Get API keys for Qwen
 */
function getApiKeys(config) {
  const keys = [];
  if (process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY) {
    keys.push(process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY);
  }
  if (config.QwenApiKeys && Array.isArray(config.QwenApiKeys) && config.QwenApiKeys.length > 0) {
    keys.push(...config.QwenApiKeys);
  } else if (config.QwenApiKey) {
    keys.push(config.QwenApiKey);
  }
  return keys;
}

function getModelName(config, taskType = "grammar") {
  const { model } = resolveModel("qwen", taskType, config);
  return model;
}

function getApiBaseUrl(config) {
  return config.QwenApiBase || "https://dashscope.aliyuncs.com/compatible-mode/v1";
}

/**
 * Resolve hostname to real public IP using a public DNS to bypass local TUN/Fake-IP
 */
async function resolveRealIP(hostname) {
  try {
    // Use AliDNS or Google DNS to get the REAL IP, not the Clash Fake-IP
    const resolver = new dns.Resolver();
    resolver.setServers(['223.5.5.5', '8.8.8.8']);
    const addresses = await resolver.resolve4(hostname);
    return addresses[0];
  } catch (err) {
    // Fallback to system resolver if custom DNS fails
    return null;
  }
}

/**
 * Custom direct fetch using node:https
 * Supports localAddress binding to bypass TUN/VPN
 */
async function fetchDirect(url, { method, headers, body, localAddress }) {
  const { hostname, pathname, search } = new URL(url);

  // Resolve real IP if bypass is requested via localAddress
  let targetIP = hostname;
  if (localAddress) {
    const realIP = await resolveRealIP(hostname);
    if (realIP) targetIP = realIP;
  }

  return new Promise((resolve, reject) => {
    try {
      const options = {
        hostname: targetIP,
        path: pathname + search,
        method,
        headers: {
          ...headers,
          'Host': hostname // Crucial: must keep original Host header for TLS/Routing
        },
        family: 4,
        timeout: 60000,
        // If localAddress is provided, bind to it to force route through physical interface
        ...(localAddress ? { localAddress } : {})
      };

      const req = https.request(options, (res) => {
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
      });

      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timed out (60s)"));
      });
      req.write(body);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Make API call to Qwen/DashScope
 */
async function callQwenAPI(apiKey, messages, config, taskType = "grammar", responseFormat = null) {
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
    localAddress
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

async function generate(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar", responseFormat } = options;
  const keys = getApiKeys(config);
  if (keys.length === 0) throw new Error("No Qwen API keys found.");

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: input });

  return callQwenAPI(keys[0], messages, config, taskType, responseFormat);
}

async function generateWithFallback(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar", responseFormat } = options;
  const keys = getApiKeys(config);
  if (keys.length === 0) throw new Error("No Qwen API keys found.");

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: input });

  let lastError;
  const MAX_RETRIES_PER_KEY = 5;

  for (const key of keys) {
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
          error.message.includes("socket disconnected") ||
          error.message.includes("TLS connection") ||
          error.message.includes("fetch failed");

        if (isNetworkError && attempts <= MAX_RETRIES_PER_KEY) {
          await new Promise(r => setTimeout(r, attempts * 500));
          continue;
        }
        break;
      }
    }
  }
  throw new Error(`Qwen API failed. Last error: ${lastError?.message}`);
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
 * Returns { toolCall, content } — only one of the two is non-null.
 */
async function callQwenAPIOnce(apiKey, messages, tools, config, taskType, toolChoice = "auto") {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qwen API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) throw new Error("Qwen API returned no choices");

  const message = data.choices[0].message;
  if (message.tool_calls?.length) {
    return { toolCall: message.tool_calls[0], content: null };
  }
  return { toolCall: null, content: (message.content || "").trim() };
}

/**
 * Call Qwen without tools to force a final text response.
 */
async function callQwenFinalAnswer(apiKey, messages, config, taskType) {
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
  });

  if (!response.ok) throw new Error(`Qwen final answer error (${response.status})`);
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
  const { config, taskType = "grammar" } = options;
  const keys = getApiKeys(config);
  if (keys.length === 0) throw new Error("No Qwen API keys found.");

  const openAITools = toolDefs.map(def => ({ type: "function", function: def }));
  const MAX_TOOL_ITERATIONS = 3;
  const MAX_RETRIES_PER_KEY = 5;
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
          const { toolCall, content } = await callQwenAPIOnce(key, messages, openAITools, config, taskType, toolChoice);

          if (!toolCall) {
            return { content: content || "", sources: dedup(sources) };
          }

          if (iter >= MAX_TOOL_ITERATIONS) {
            // Max iterations reached — force a final answer without tools
            messages.push({ role: "assistant", content: null, tool_calls: [toolCall] });
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: "Maximum lookups reached. Provide your final answer now.",
            });
            const finalContent = await callQwenFinalAnswer(key, messages, config, taskType);
            return { content: finalContent, sources: dedup(sources) };
          }

          // Parse and execute tool call
          let args;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            // Malformed args — treat as end of tool loop
            const finalContent = await callQwenFinalAnswer(key, messages, config, taskType);
            return { content: finalContent, sources: dedup(sources) };
          }

          const toolResult = await toolExecutor({ query: args.query });
          sources.push(...toolResult.sources);

          // Append tool call + result to conversation
          messages.push({ role: "assistant", content: null, tool_calls: [toolCall] });
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult.result });
          iter++;
        }
      } catch (error) {
        lastError = error;
        attempts++;
        const isNetworkError =
          error.message.includes("ECONNRESET") || error.message.includes("ETIMEDOUT") ||
          error.message.includes("socket disconnected") || error.message.includes("TLS connection") ||
          error.message.includes("fetch failed");
        if (isNetworkError && attempts <= MAX_RETRIES_PER_KEY) {
          await new Promise(r => setTimeout(r, attempts * 500));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`Qwen generateWithTools failed. Last error: ${lastError?.message}`);
}

export default {
  name: "qwen",
  generate,
  generateWithFallback,
  generateWithTools,
  getApiKeys,
  getModelName
};
