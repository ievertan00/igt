/**
 * Deepseek LLM Provider
 * Uses OpenAI-compatible API endpoint
 * API: https://api.deepseek.com
 * Supports task-aware model selection (chat for grammar, reasoner for handbook)
 * Forced direct connection support for TUN/VPN environments
 */

import https from "node:https";
import dns from "node:dns/promises";
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

/**
 * Resolve hostname to real public IP using a public DNS to bypass local TUN/Fake-IP
 */
async function resolveRealIP(hostname) {
  try {
    const resolver = new dns.Resolver();
    resolver.setServers(['223.5.5.5', '8.8.8.8']);
    const addresses = await resolver.resolve4(hostname);
    return addresses[0];
  } catch {
    return null;
  }
}

/**
 * Custom direct fetch using node:https
 * Supports localAddress binding to bypass TUN/VPN
 */
async function fetchDirect(url, { method, headers, body, localAddress }) {
  const { hostname, pathname, search } = new URL(url);

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
          'Host': hostname
        },
        family: 4,
        timeout: 60000,
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

async function callDeepseekAPI(apiKey, messages, config, taskType = "grammar", responseFormat = null) {
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
    throw new Error(`Deepseek API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error("Deepseek API returned no choices");
  }

  return data.choices[0].message.content.trim();
}

async function generate(input, systemPrompt, options = {}) {
  const { config, taskType = "grammar", responseFormat } = options;
  const keys = getApiKeys(config);
  if (keys.length === 0) {
    throw new Error("No Deepseek API keys found. Set DEEPSEEK_API_KEY env var or add DeepseekApiKey to igt_config.json.");
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: input });

  return callDeepseekAPI(keys[0], messages, config, taskType, responseFormat);
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

export default {
  name: "deepseek",
  generate,
  generateWithFallback,
  getApiKeys,
  getModelName
};
