/**
 * Ollama local LLM provider
 * OpenAI-compatible HTTP API at localhost:11434 — no API key required.
 * Default model: phi4 (Phi-4 14B). Configurable via OllamaModel in igt_config.json.
 */

import { resolveModel } from "./model-resolver.mjs";

function getBaseUrl(config) {
  const url = config.OllamaBaseUrl || "http://localhost:11434/v1";
  // Native /api/chat endpoint requires the base without /v1
  return url.replace(/\/v1\/?$/, "");
}

function getModelName(config, taskType = "grammar") {
  const { model } = resolveModel("ollama", taskType, config);
  return model;
}

async function callOllama(messages, config, taskType = "grammar") {
  const baseUrl = getBaseUrl(config);
  const model = getModelName(config, taskType);
  const think = taskType !== "grammar";

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      think,
      stream: false,
      options: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.message?.content) throw new Error("Ollama returned no content");
  return data.message.content.trim();
}

async function generate(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar" } = options;
  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: input });
  return callOllama(messages, config, taskType);
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
