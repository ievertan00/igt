/**
 * Ollama local LLM provider
 * OpenAI-compatible HTTP API at localhost:11434 — no API key required.
 * Default model: phi4 (Phi-4 14B). Configurable via OllamaModel in igt_config.json.
 */

import { resolveModel } from "./model-resolver.mjs";

function getModelName(config, taskType = "grammar") {
  const { model } = resolveModel("ollama", taskType, config);
  return model;
}

export async function unloadModel(baseUrl, model) {
  try {
    await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, keep_alive: 0, messages: [], stream: false }),
    });
  } catch {}
}

// Families whose Ollama models support the "think" (extended thinking) parameter.
// Gemma and Phi do not; QwQ, Qwen3, and DeepSeek-R1 do.
const THINKING_FAMILIES = new Set(["qwq", "qwen3", "deepseek-r1"]);

async function callOllama(messages, config, taskType = "grammar", responseFormat = null) {
  const baseUrl = config.OllamaBaseUrl || "http://localhost:11434";
  const model = getModelName(config, taskType);
  const family = (config.OllamaFamily || "gemma").toLowerCase();
  const think = taskType !== "grammar" && THINKING_FAMILIES.has(family);

  const requestBody = {
    model,
    messages,
    think,
    keep_alive: -1,
    stream: false,
    options: { temperature: 0.3 },
  };

  if (
    responseFormat === "json" ||
    (responseFormat &&
      typeof responseFormat === "object" &&
      (responseFormat.type === "json_object" || responseFormat.responseSchema))
  ) {
    requestBody.format = "json";
  }

  let res;
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    // Ollama is an optional local service; if it isn't running the fetch rejects
    // with a cryptic "fetch failed". Surface an actionable message instead.
    const detail = `${err?.cause?.code || ""} ${err?.message || ""}`;
    if (/ECONNREFUSED|ENOTFOUND|fetch failed/i.test(detail)) {
      throw new Error(`Ollama not reachable at ${baseUrl}. Is the Ollama service running? (start it with: ollama serve)`);
    }
    throw err;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.message?.content) throw new Error("Ollama returned no content");
  return data.message.content.trim();
}

async function generate(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar", responseFormat, responseSchema } = options;
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: input });
  return callOllama(messages, config, taskType, responseFormat || responseSchema);
}

async function generateWithFallback(input, systemPrompt, options = {}) {
  return generate(input, systemPrompt, options);
}

export default {
  name: "ollama",
  generate,
  generateWithFallback,
  getApiKeys: () => ["ollama"],
  getModelName,
};
