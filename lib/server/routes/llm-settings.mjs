import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { resolveModel } from "../llm/model-resolver.mjs";
import { errorPayload } from "../../contracts/errors.mjs";

const PROVIDERS = {
  gemini: { envKeys: "GOOGLE_API_KEYS", configKeys: "GeminiApiKeys", singularKey: "GOOGLE_API_KEY", baseUrl: null },
  qwen: { envKeys: "DASHSCOPE_API_KEYS", configKeys: "QwenApiKeys", singularKey: "DASHSCOPE_API_KEY", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  deepseek: { envKeys: "DEEPSEEK_API_KEYS", configKeys: "DeepseekApiKeys", singularKey: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com/v1" },
  ollama: { envKeys: null, configKeys: null, singularKey: null, baseUrl: "http://localhost:11434" },
};

const MODEL_TASKS = { flash: "grammar", pro: "handbook" };
const DEFAULT_PROVIDER = "gemini";
const json = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
};

function readSettings(config, activeProvider) {
  const providers = Object.fromEntries(Object.entries(PROVIDERS).map(([name, spec]) => {
    const keys = spec.configKeys ? config[spec.configKeys] || [] : [];
    const models = {};
    for (const [role, task] of Object.entries(MODEL_TASKS)) {
      models[role] = resolveModel(name, task, config).model;
    }
    return [name, {
      keyConfigured: keys.length > 0,
      keyMasked: keys[0] ? `••••${keys[0].slice(-4)}` : "",
      models,
      baseUrl: name === "ollama" ? config.OllamaBaseUrl || spec.baseUrl : name === "qwen" ? config.QwenApiBase || spec.baseUrl : name === "deepseek" ? config.DeepseekApiBase || spec.baseUrl : "",
    }];
  }));
  return { provider: activeProvider, providers };
}

function safeText(value, label, max = 500) {
  if (value == null || value === "") return "";
  const text = String(value).trim();
  if (text.length > max || /[\r\n\0]/.test(text)) {
    throw Object.assign(new Error(`${label} is too long or contains invalid characters`), { status: 400, code: "INVALID_REQUEST" });
  }
  return text;
}

export function registerLlmSettingsRoutes({ config, getLLMManager }) {
  register("GET", "/settings/llm", async (req, res) => {
    const resolved = configLoader.load();
    const provider = (process.env.IGT_LLM_PROVIDER || resolved.LLMProvider || DEFAULT_PROVIDER).toLowerCase();
    json(res, 200, readSettings(resolved, PROVIDERS[provider] ? provider : DEFAULT_PROVIDER));
  });

  register("POST", "/settings/llm", async (req, res, { body }) => {
    try {
      const resolved = configLoader.load();
      const provider = safeText(body.provider, "Provider", 30).toLowerCase();
      if (!PROVIDERS[provider]) return json(res, 400, errorPayload("INVALID_REQUEST", "Choose Gemini, Qwen, DeepSeek, or Ollama"));

      const updates = { IGT_LLM_PROVIDER: provider };
      const assignments = { LLMProvider: provider };
      const processEnvUpdates = {};
      for (const [name, spec] of Object.entries(PROVIDERS)) {
        if (!spec.configKeys) continue;
        if (body.clearApiKeys?.[name]) {
          updates[spec.envKeys] = "";
          assignments[spec.configKeys] = [];
          processEnvUpdates[spec.singularKey] = "";
        } else {
          const keyValue = safeText(body.apiKeys?.[name], `${name} API key`, 4000);
          if (keyValue) {
            const keys = keyValue.split(",").map((key) => key.trim()).filter(Boolean);
            updates[spec.envKeys] = keys.join(",");
            assignments[spec.configKeys] = keys;
            processEnvUpdates[spec.singularKey] = keys[0] || "";
          }
        }
        for (const role of ["flash", "pro"]) {
          const model = safeText(body.models?.[name]?.[role], `${name} ${role} model`, 300);
          if (!model) continue;
          const field = name === "gemini" ? role === "flash" ? "GeminiFlashModel" : "GeminiProModel"
            : name === "qwen" ? role === "flash" ? "QwenFlashModel" : "QwenProModel"
              : role === "flash" ? "DeepseekFlashModel" : "DeepseekProModel";
          const key = `IGT_${name.toUpperCase()}_${role.toUpperCase()}_MODEL`;
          updates[key] = model;
          assignments[field] = model;
        }
      }

      const family = (resolved.OllamaFamily || "gemma").toLowerCase();
      const familyTitle = family.charAt(0).toUpperCase() + family.slice(1);
      for (const role of ["flash", "pro"]) {
        const model = safeText(body.models?.ollama?.[role], `Ollama ${role} model`, 300);
        if (!model) continue;
        updates[`IGT_OLLAMA_${family.toUpperCase()}_${role.toUpperCase()}_MODEL`] = model;
        assignments[`Ollama${familyTitle}${role === "flash" ? "Flash" : "Pro"}Model`] = model;
      }

      for (const [field, env, max] of [
        ["OllamaBaseUrl", "IGT_OLLAMA_BASE_URL", 1000],
        ["QwenApiBase", "IGT_QWEN_API_BASE", 1000],
        ["DeepseekApiBase", "IGT_DEEPSEEK_API_BASE", 1000],
      ]) {
        const value = safeText(body.baseUrls?.[field], field, max);
        if (value) {
          const normalized = value.replace(/\/$/, "");
          updates[env] = normalized;
          assignments[field] = normalized;
        }
      }

      const selectedKeyField = PROVIDERS[provider].configKeys;
      const proposedKeys = selectedKeyField ? assignments[selectedKeyField] ?? resolved[selectedKeyField] ?? [] : [];
      if (selectedKeyField && proposedKeys.length === 0) {
        return json(res, 400, errorPayload("INVALID_REQUEST", `Add a ${provider} API key before selecting this provider`));
      }

      configLoader.updateEnv(updates);
      Object.assign(config, assignments);
      Object.assign(process.env, processEnvUpdates);
      for (const [name, spec] of Object.entries(PROVIDERS)) {
        if (spec.configKeys && assignments[spec.configKeys]) config[spec.configKeys] = assignments[spec.configKeys];
      }
      process.env.IGT_LLM_PROVIDER = provider;
      const manager = await getLLMManager();
      manager.switchProvider(provider, { updateEnv: false });
      return json(res, 200, { ok: true, ...readSettings(config, provider) });
    } catch (error) {
      return json(res, error.status || 500, errorPayload(error.code || "INTERNAL_ERROR", error.message || "Unable to save LLM settings", error.status >= 500));
    }
  });
}
