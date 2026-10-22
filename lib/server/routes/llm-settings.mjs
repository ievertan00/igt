import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { resolveModel, DEFAULT_MODELS } from "../llm/model-resolver.mjs";
import { errorPayload } from "../../contracts/errors.mjs";
import customProvider from "../llm/custom.mjs";

const PROVIDERS = {
  gemini: { envKeys: "GOOGLE_API_KEYS", configKeys: "GeminiApiKeys", singularKey: "GOOGLE_API_KEY", baseUrl: null },
  qwen: { envKeys: "DASHSCOPE_API_KEYS", configKeys: "QwenApiKeys", singularKey: "DASHSCOPE_API_KEY", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  deepseek: { envKeys: "DEEPSEEK_API_KEYS", configKeys: "DeepseekApiKeys", singularKey: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com/v1" },
  ollama: { envKeys: null, configKeys: null, singularKey: null, baseUrl: "http://localhost:11434" },
  custom: { envKeys: "IGT_CUSTOM_API_KEYS", configKeys: "CustomApiKeys", singularKey: "IGT_CUSTOM_API_KEY", baseUrl: "http://localhost:1234/v1" },
};

const MODEL_TASKS = { flash: "grammar", pro: "handbook" };
const DEFAULT_PROVIDER = "gemini";
const LEGACY_COMPAT_PROVIDERS = new Set(["gemini", "qwen", "deepseek"]);
const GEMINI_COMPAT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const json = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
};

function readSettings(config, activeProvider) {
  const customHasSavedConfig = Boolean(
    config.CustomApiBase || config.CustomFlashModel || config.CustomProModel || config.CustomApiKeys?.length,
  );
  const migrationSource = LEGACY_COMPAT_PROVIDERS.has(activeProvider) && !customHasSavedConfig
    ? activeProvider
    : "custom";
  const providers = Object.fromEntries(Object.entries(PROVIDERS).map(([name, spec]) => {
    const sourceName = name === "custom" ? migrationSource : name;
    const sourceSpec = PROVIDERS[sourceName];
    const keys = sourceSpec.configKeys ? config[sourceSpec.configKeys] || [] : [];
    const models = {};
    for (const [role, task] of Object.entries(MODEL_TASKS)) {
      const model = resolveModel(sourceName, task, config).model;
      const field = sourceName === "gemini" ? role === "flash" ? "GeminiFlashModel" : "GeminiProModel"
        : sourceName === "qwen" ? role === "flash" ? "QwenFlashModel" : "QwenProModel"
          : sourceName === "deepseek" ? role === "flash" ? "DeepseekFlashModel" : "DeepseekProModel"
            : sourceName === "custom" ? role === "flash" ? "CustomFlashModel" : "CustomProModel"
              : `Ollama${(config.OllamaFamily || "gemma").charAt(0).toUpperCase()}${(config.OllamaFamily || "gemma").slice(1)}${role === "flash" ? "Flash" : "Pro"}Model`;
      const defaultModel = sourceName === "ollama"
        ? DEFAULT_MODELS.ollama[(config.OllamaFamily || "gemma").toLowerCase()]?.[task]
        : DEFAULT_MODELS[sourceName]?.[task];
      models[role] = config[field] || (model === defaultModel ? "" : model);
    }
    const baseUrl = sourceName === "ollama" ? config.OllamaBaseUrl || sourceSpec.baseUrl
      : sourceName === "qwen" ? config.QwenApiBase || sourceSpec.baseUrl
        : sourceName === "deepseek" ? config.DeepseekApiBase || sourceSpec.baseUrl
          : sourceName === "gemini" ? GEMINI_COMPAT_BASE_URL
            : sourceName === "custom" ? config.CustomApiBase || sourceSpec.baseUrl : "";
    return [name, {
      keyConfigured: keys.length > 0,
      keyMasked: keys[0] ? `••••${keys[0].slice(-4)}` : "",
      models,
      baseUrl,
    }];
  }));
  return { provider: LEGACY_COMPAT_PROVIDERS.has(activeProvider) ? "custom" : activeProvider, providers };
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

  register("POST", "/settings/llm/test", async (req, res, { body }) => {
    try {
      const baseUrl = safeText(body.baseUrl, "API base URL", 1000).replace(/\/$/, "");
      const model = safeText(body.model, "Flash model", 300);
      const apiKey = safeText(body.apiKey, "API key", 4000);
      if (!baseUrl || !model) return json(res, 400, errorPayload("INVALID_REQUEST", "Enter an API base URL and a Flash model first"));
      const parsed = new URL(baseUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) return json(res, 400, errorPayload("INVALID_REQUEST", "API base URL must use HTTP or HTTPS"));
      const resolved = configLoader.load();
      const activeProvider = (process.env.IGT_LLM_PROVIDER || resolved.LLMProvider || DEFAULT_PROVIDER).toLowerCase();
      const legacyKeys = LEGACY_COMPAT_PROVIDERS.has(activeProvider)
        ? resolved[PROVIDERS[activeProvider].configKeys] || []
        : [];
      const keys = apiKey ? [apiKey] : resolved.CustomApiKeys?.length ? resolved.CustomApiKeys : legacyKeys;
      await customProvider.generate("Reply with OK.", "This is a connection test. Reply with OK.", {
        config: { ...resolved, CustomApiBase: baseUrl, CustomFlashModel: model, CustomApiKeys: keys },
        taskType: "grammar",
        timeout: 15000,
        ...(apiKey ? { apiKey } : {}),
      });
      return json(res, 200, { ok: true, message: "Connection successful" });
    } catch (error) {
      return json(res, error.status || 502, errorPayload(error.code || "CONNECTION_FAILED", error.message || "Connection test failed", true));
    }
  });

  register("POST", "/settings/llm", async (req, res, { body }) => {
    try {
      const resolved = configLoader.load();
      const provider = safeText(body.provider, "Provider", 30).toLowerCase();
      if (!PROVIDERS[provider]) return json(res, 400, errorPayload("INVALID_REQUEST", "Choose a supported model provider"));

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
              : name === "custom" ? role === "flash" ? "CustomFlashModel" : "CustomProModel"
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
        ["CustomApiBase", "IGT_CUSTOM_API_BASE", 1000],
      ]) {
        const value = safeText(body.baseUrls?.[field], field, max);
        if (value) {
          const normalized = value.replace(/\/$/, "");
          updates[env] = normalized;
          assignments[field] = normalized;
        }
      }

      // Move the active legacy provider's key into the shared compatible-provider
      // slot when the user switches to it. Keep the original entry for legacy CLI use.
      const currentProvider = (process.env.IGT_LLM_PROVIDER || resolved.LLMProvider || DEFAULT_PROVIDER).toLowerCase();
      if (provider === "custom" && LEGACY_COMPAT_PROVIDERS.has(currentProvider)) {
        const legacySpec = PROVIDERS[currentProvider];
        const customKeys = assignments.CustomApiKeys ?? resolved.CustomApiKeys ?? [];
        const explicitlyCleared = Boolean(body.clearApiKeys?.custom);
        if (!explicitlyCleared && customKeys.length === 0) {
          const legacyKeys = resolved[legacySpec.configKeys] || [];
          if (legacyKeys.length > 0) {
            updates.IGT_CUSTOM_API_KEYS = legacyKeys.join(",");
            assignments.CustomApiKeys = legacyKeys;
            processEnvUpdates.IGT_CUSTOM_API_KEY = legacyKeys[0];
          }
        } else if (explicitlyCleared && !(assignments.CustomApiKeys?.length)) {
          updates[legacySpec.envKeys] = "";
          assignments[legacySpec.configKeys] = [];
          processEnvUpdates[legacySpec.singularKey] = "";
        }

        const customHasSavedConfig = Boolean(
          resolved.CustomApiBase || resolved.CustomFlashModel || resolved.CustomProModel || resolved.CustomApiKeys?.length,
        );
        if (!customHasSavedConfig) {
          for (const [role, task] of Object.entries(MODEL_TASKS)) {
            if (safeText(body.models?.custom?.[role], `custom ${role} model`, 300)) continue;
            const model = resolveModel(currentProvider, task, resolved).model;
            const title = role === "flash" ? "Flash" : "Pro";
            updates[`IGT_CUSTOM_${title.toUpperCase()}_MODEL`] = model;
            assignments[`Custom${title}Model`] = model;
          }
        }
      }

      const selectedKeyField = PROVIDERS[provider].configKeys;
      const proposedKeys = selectedKeyField ? assignments[selectedKeyField] ?? resolved[selectedKeyField] ?? [] : [];
      if (selectedKeyField && provider !== "custom" && proposedKeys.length === 0) {
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
