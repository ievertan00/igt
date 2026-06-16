/**
 * OpenAI-compatible LLM provider factory.
 *
 * Qwen (DashScope) and Deepseek both speak the OpenAI /chat/completions
 * protocol — identical request body, tool-call envelope, and response shape.
 * This module holds the single converged implementation; each provider is a
 * thin spec (see qwen.mjs / deepseek.mjs) describing only what genuinely
 * differs: its base URL and where its API keys come from.
 *
 * Behaviour is the superset of the two former hand-written implementations:
 *   - wide network-error retry list (incl. ECONNREFUSED / ENOTFOUND / 5xx)
 *   - auth/quota errors (401/403/429) break to the next key instead of retrying
 *   - reasoning_content (Deepseek-R1) is threaded back into the tool loop when present
 *   - a provider that rejects tools falls back to a plain generate() call
 *
 * Direct-connection (VPN bypass) support comes from the shared http-client.
 */

import { performance } from "node:perf_hooks";
import { fetchDirect, taskTimeout } from "./http-client.mjs";
import { resolveModel } from "./model-resolver.mjs";

const MAX_RETRIES_PER_KEY = 2;
const MAX_TOOL_ITERATIONS = 3;

function isNetworkError(msg) {
  return (
    msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNREFUSED") || msg.includes("socket disconnected") ||
    msg.includes("TLS connection") || msg.includes("EAI_AGAIN") ||
    msg.includes("ENOTFOUND") || msg.includes("fetch failed") ||
    msg.includes("500") || msg.includes("502") ||
    msg.includes("503") || msg.includes("504")
  );
}

function isAuthOrQuotaError(msg) {
  return msg.includes("401") || msg.includes("403") || msg.includes("429");
}

function isToolUnsupportedError(msg) {
  return msg.includes("does not support tool") || msg.includes("tool_calls") || msg.includes("tool_choice");
}

function dedup(sources) {
  const seen = new Set();
  return sources.filter((s) => {
    const key = `${s.book}||${s.unit}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Build a provider object from a declarative spec.
 *
 * @param {Object} spec
 * @param {string} spec.name              - provider name (also drives model routing)
 * @param {string} spec.defaultBaseUrl    - fallback API base URL
 * @param {string} spec.baseUrlConfigKey  - config field that overrides the base URL
 * @param {string[]} spec.keyEnvVars      - env var names to read API keys from, in order
 * @param {string} spec.keyConfigArray    - config field holding an array of keys
 * @param {string} spec.keyConfigSingle   - config field holding a single key (legacy)
 * @returns {Object} provider implementing the standard provider interface
 */
export function createOpenAICompatProvider(spec) {
  const {
    name,
    defaultBaseUrl,
    baseUrlConfigKey,
    keyEnvVars = [],
    keyConfigArray,
    keyConfigSingle,
  } = spec;

  function getApiKeys(config) {
    const keys = [];
    for (const envVar of keyEnvVars) {
      if (process.env[envVar]) keys.push(process.env[envVar]);
    }
    const arr = config[keyConfigArray];
    if (Array.isArray(arr) && arr.length > 0) {
      keys.push(...arr);
    } else if (config[keyConfigSingle]) {
      keys.push(config[keyConfigSingle]);
    }
    return [...new Set(keys)];
  }

  function getModelName(config, taskType = "grammar") {
    return resolveModel(name, taskType, config).model;
  }

  function getBaseUrl(config) {
    return config[baseUrlConfigKey] || defaultBaseUrl;
  }

  function buildMessages(systemPrompt, userInput) {
    const messages = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userInput });
    return messages;
  }

  // Single POST to /chat/completions. Returns the assistant message object.
  async function post(apiKey, body, config, taskType, timeout) {
    timeout = taskTimeout(taskType, timeout);
    const localAddress = config.LocalAddress || process.env.IGT_LOCAL_ADDRESS;
    const jsonBody = JSON.stringify(body);

    const response = await fetchDirect(`${getBaseUrl(config)}/chat/completions`, {
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
      throw new Error(`${name} API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
      throw new Error(`${name} API returned no choices`);
    }
    return data.choices[0].message;
  }

  async function callChat(apiKey, messages, config, taskType, responseFormat, timeout) {
    const body = { model: getModelName(config, taskType), messages, temperature: 0.7, max_tokens: 4096 };
    if (responseFormat) body.response_format = responseFormat;
    const message = await post(apiKey, body, config, taskType, timeout);
    return (message.content || "").trim();
  }

  // One tool-enabled call. Exactly one of { toolCall, content } is meaningful.
  async function callChatWithTools(apiKey, messages, tools, config, taskType, timeout) {
    const body = {
      model: getModelName(config, taskType),
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      tools,
      tool_choice: "auto",
    };
    const message = await post(apiKey, body, config, taskType, timeout);
    if (message.tool_calls?.length) {
      return { toolCall: message.tool_calls[0], content: null, reasoningContent: message.reasoning_content || null };
    }
    return { toolCall: null, content: (message.content || "").trim(), reasoningContent: message.reasoning_content || null };
  }

  async function generate(input, systemPrompt, options = {}) {
    const { config, taskType = "grammar", jsonSchema, timeout = 60000 } = options;
    const keys = getApiKeys(config);
    if (keys.length === 0) throw new Error(`No ${name} API keys found.`);
    const responseFormat = jsonSchema ? { type: "json_object" } : null;
    return callChat(keys[0], buildMessages(systemPrompt, input), config, taskType, responseFormat, timeout);
  }

  async function generateWithFallback(input, systemPrompt, options = {}) {
    const { config, taskType = "grammar", jsonSchema } = options;
    const keys = getApiKeys(config);
    if (keys.length === 0) throw new Error(`No ${name} API keys found.`);
    const messages = buildMessages(systemPrompt, input);
    const responseFormat = jsonSchema ? { type: "json_object" } : null;

    let lastError;
    for (const key of keys) {
      let attempts = 0;
      while (attempts <= MAX_RETRIES_PER_KEY) {
        try {
          return await callChat(key, messages, config, taskType, responseFormat);
        } catch (error) {
          lastError = error;
          attempts++;
          if (isAuthOrQuotaError(error.message)) break; // dead/limited key — move on
          if (isNetworkError(error.message) && attempts <= MAX_RETRIES_PER_KEY) {
            await new Promise((r) => setTimeout(r, attempts * 500));
            continue;
          }
          break;
        }
      }
    }

    const msg = keys.length > 1
      ? `All ${keys.length} ${name} API keys failed. Last error: ${lastError?.message || "unknown"}`
      : `${name} API failed. Error: ${lastError?.message || "unknown"}`;
    throw new Error(msg);
  }

  async function generateWithTools(userMessage, systemPrompt, toolDefs, toolExecutor, options = {}) {
    const { config, taskType = "grammar", timeout: timeoutOpt } = options;
    const timeout = taskTimeout(taskType, timeoutOpt);
    const keys = getApiKeys(config);
    if (keys.length === 0) throw new Error(`No ${name} API keys found.`);

    const openAITools = toolDefs.map((def) => ({ type: "function", function: def }));
    let lastError;

    for (const key of keys) {
      let attempts = 0;
      while (attempts <= MAX_RETRIES_PER_KEY) {
        try {
          const messages = buildMessages(systemPrompt, userMessage);
          const sources = [];
          const callTimings = [];
          let iter = 0;

          const finish = (content) => {
            const answerMs = callTimings[callTimings.length - 1] ?? 0;
            const toolMs = callTimings.slice(0, -1).reduce((a, b) => a + b, 0);
            return {
              content: content || "",
              sources: dedup(sources),
              perf: { callCount: callTimings.length, toolMs: Math.round(toolMs), answerMs: Math.round(answerMs) },
            };
          };

          // Re-ask with no tools to force a final prose answer.
          const forceFinalAnswer = async () => {
            const t = performance.now();
            const final = await callChat(key, messages, config, taskType, null, timeout);
            callTimings.push(performance.now() - t);
            return finish(final);
          };

          // eslint-disable-next-line no-constant-condition
          while (true) {
            const t = performance.now();
            const { toolCall, content, reasoningContent } = await callChatWithTools(
              key, messages, openAITools, config, taskType, timeout,
            );
            callTimings.push(performance.now() - t);

            if (!toolCall) return finish(content);

            const assistantTurn = {
              role: "assistant",
              content: null,
              tool_calls: [toolCall],
              ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
            };

            if (iter >= MAX_TOOL_ITERATIONS) {
              messages.push(assistantTurn);
              messages.push({ role: "tool", tool_call_id: toolCall.id, content: "Maximum lookups reached. Provide your final answer now." });
              return await forceFinalAnswer();
            }

            let args;
            try {
              args = JSON.parse(toolCall.function.arguments);
            } catch {
              return await forceFinalAnswer(); // malformed args — give up the loop
            }

            const toolResult = await toolExecutor({ query: args.query });
            sources.push(...toolResult.sources);
            messages.push(assistantTurn);
            messages.push({ role: "tool", tool_call_id: toolCall.id, content: toolResult.result });
            iter++;
          }
        } catch (error) {
          lastError = error;
          attempts++;
          // Some reasoner models reject tools entirely — fall back to a plain answer.
          if (isToolUnsupportedError(error.message)) {
            try {
              const content = await generate(userMessage, systemPrompt, options);
              return { content, sources: [] };
            } catch {
              // ignore fallback error; advance to next key
            }
            break;
          }
          if (isNetworkError(error.message) && attempts <= MAX_RETRIES_PER_KEY) {
            await new Promise((r) => setTimeout(r, attempts * 500));
            continue;
          }
          break;
        }
      }
    }

    throw new Error(`${name} generateWithTools failed. Last error: ${lastError?.message || "unknown"}`);
  }

  return { name, generate, generateWithFallback, generateWithTools, getApiKeys, getModelName };
}

export default createOpenAICompatProvider;
