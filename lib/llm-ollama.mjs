/**
 * Ollama local LLM provider
 * OpenAI-compatible HTTP API at localhost:11434 — no API key required.
 * Default model: phi4 (Phi-4 14B). Configurable via OllamaActiveModel in igt_config.json.
 */

import { resolveModel } from "./model-resolver.mjs";

function getBaseUrl(config) {
  return config.OllamaBaseUrl || "http://localhost:11434/v1";
}

function getModelName(config, taskType = "grammar") {
  const { model } = resolveModel("ollama", taskType, config);
  return model;
}

async function callOllama(messages, config, taskType = "grammar") {
  const baseUrl = getBaseUrl(config);
  const model = getModelName(config, taskType);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.choices?.length) throw new Error("Ollama returned no choices");
  return data.choices[0].message.content.trim();
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
