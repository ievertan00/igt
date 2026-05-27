/**
 * Model Resolver
 * Selects the appropriate model based on provider and task type
 */

/**
 * Task type to model field mapping per provider
 */
const TASK_FIELD_MAP = {
  gemini: {
    grammar: "GeminiFlashModel",
    translation: "GeminiFlashModel",
    handbook: "GeminiProModel",
    practice: "GeminiProModel",
  },
  qwen: {
    grammar: "QwenFlashModel",
    translation: "QwenFlashModel",
    handbook: "QwenProModel",
    practice: "QwenProModel",
  },
  deepseek: {
    grammar: "DeepseekFlashModel",
    translation: "DeepseekFlashModel",
    handbook: "DeepseekProModel",
    practice: "DeepseekProModel",
  },
  ollama: {
    grammar: "OllamaFamilyFlash", // Placeholder, constructed dynamically
    translation: "OllamaFamilyFlash",
    handbook: "OllamaFamilyPro",
    practice: "OllamaFamilyPro",
  },
};

/**
 * Default model values for each provider and task
 */
const DEFAULT_MODELS = {
  gemini: {
    grammar: "gemini-2.5-flash",
    translation: "gemini-2.5-flash",
    handbook: "gemini-3.0-pro",
    practice: "gemini-3.0-pro",
  },
  qwen: {
    grammar: "qwen3.5-flash",
    translation: "qwen3.5-flash",
    handbook: "qwen3-max",
    practice: "qwen3-max",
  },
  deepseek: {
    grammar: "deepseek-chat",
    translation: "deepseek-chat",
    handbook: "deepseek-reasoner",
    practice: "deepseek-reasoner",
  },
  ollama: {
    gemma: {
      grammar: "gemma4:e4b",
      translation: "gemma4:e4b",
      handbook: "gemma4:e4b",
      practice: "gemma4:e4b",
    },
    phi: {
      grammar: "phi4",
      translation: "phi4",
      handbook: "phi4",
      practice: "phi4",
    },
  },
};

/**
 * Backward compatibility field mapping (old config format)
 */
const BACKWARD_COMPAT_FIELD_MAP = {
  gemini: ["Model", "GeminiModel", "GeminiFlashModel"],
  qwen: ["QwenModel"],
  deepseek: ["DeepseekModel"],
};

/**
 * Resolve model name for a given provider and task type
 *
 * @param {string} provider - Provider name (gemini, qwen, deepseek)
 * @param {string} taskType - Task type (grammar, handbook, practice)
 * @param {Object} config - Configuration object
 * @param {boolean} options.requireConfig - If true, throw error when pro model not configured
 * @returns {Object} { model: string, field: string, isDefault: boolean }
 */
function resolveModel(provider, taskType, config, options = {}) {
  const { requireConfig = false } = options;
  const normalizedProvider = provider.toLowerCase();
  const normalizedTask = taskType.toLowerCase();

  // Validate provider
  if (!TASK_FIELD_MAP[normalizedProvider]) {
    throw new Error(
      `Unknown provider: "${provider}". Available: ${Object.keys(TASK_FIELD_MAP).join(", ")}`,
    );
  }

  // Handle Ollama specialized logic
  if (normalizedProvider === "ollama") {
    const family = (config.OllamaFamily || "gemma").toLowerCase();
    const role = normalizedTask === "grammar" ? "Flash" : "Pro";
    const familyTitle = family.charAt(0).toUpperCase() + family.slice(1);
    const fieldName = `Ollama${familyTitle}${role}Model`;
    const genericFieldName = `Ollama${role}Model`;

    // Priority:
    // 1. Family-specific field (OllamaGemmaFlashModel)
    // 2. Generic role field (OllamaFlashModel)
    // 3. Fallback to family-specific default
    let model = config[fieldName] || config[genericFieldName];
    let isDefault = false;

    if (!model) {
      model =
        DEFAULT_MODELS.ollama[family]?.[normalizedTask] ||
        (family === "phi" ? "phi4" : role === "Flash" ? "gemma4-fast" : "gemma4:e4b");
      isDefault = true;

      if ((normalizedTask === "handbook" || normalizedTask === "practice") && requireConfig) {
        throw new Error(
          `Pro model not configured for Ollama (${family}).\n` +
            `Please configure "${fieldName}" or "${genericFieldName}" in igt_config.json.\n` +
            `Recommended: ${model}`,
        );
      }
    }

    return { model, field: model === config[fieldName] ? fieldName : genericFieldName, isDefault };
  }

  // Validate task type for other providers
  if (!TASK_FIELD_MAP[normalizedProvider][normalizedTask]) {
    throw new Error(
      `Unknown task type: "${taskType}" for provider "${provider}". Available: ${Object.keys(TASK_FIELD_MAP[normalizedProvider]).join(", ")}`,
    );
  }

  // Get the field name for this provider+task combo
  const fieldName = TASK_FIELD_MAP[normalizedProvider][normalizedTask];

  // Try to get model from config
  let model = config[fieldName];
  let isDefault = false;

  // If not found, try backward compatibility fields
  if (!model) {
    const backwardFields = BACKWARD_COMPAT_FIELD_MAP[normalizedProvider] || [];
    for (const field of backwardFields) {
      if (config[field]) {
        model = config[field];
        isDefault = true;
        break;
      }
    }
  }

  // If still not found, use default
  if (!model) {
    model = DEFAULT_MODELS[normalizedProvider][normalizedTask];
    isDefault = true;

    // For pro models, warn user if not configured
    if (normalizedTask === "handbook" || normalizedTask === "practice") {
      if (requireConfig) {
        throw new Error(
          `Pro model not configured for ${normalizedTask}.\n` +
            `Please configure "${fieldName}" in igt_config.json or run "llm setup".\n` +
            `Recommended: ${DEFAULT_MODELS[normalizedProvider][normalizedTask]}`,
        );
      }
      console.warn(`⚠️  Pro model not configured. Using default: ${model}`);
    }
  }

  return {
    model,
    field: fieldName,
    isDefault,
  };
}

/**
 * Get all configured models for a provider
 *
 * @param {string} provider - Provider name
 * @param {Object} config - Configuration object
 * @returns {Object} { grammar: { model, configured }, handbook: { model, configured }, practice: { model, configured } }
 */
function getProviderModels(provider, config) {
  const normalizedProvider = provider.toLowerCase();

  if (!TASK_FIELD_MAP[normalizedProvider]) {
    throw new Error(`Unknown provider: "${provider}"`);
  }

  const result = {};

  if (normalizedProvider === "ollama") {
    const family = (config.OllamaFamily || "gemma").toLowerCase();
    const familyTitle = family.charAt(0).toUpperCase() + family.slice(1);

    ["grammar", "handbook", "practice"].forEach((task) => {
      const role = task === "grammar" ? "Flash" : "Pro";
      const fieldName = `Ollama${familyTitle}${role}Model`;
      const model = config[fieldName] || DEFAULT_MODELS.ollama[family]?.[task];
      result[task] = {
        model,
        configured: !!config[fieldName],
        field: fieldName,
      };
    });
    return result;
  }

  for (const [taskType, fieldName] of Object.entries(TASK_FIELD_MAP[normalizedProvider])) {
    const model = config[fieldName];
    result[taskType] = {
      model: model || DEFAULT_MODELS[normalizedProvider][taskType],
      configured: !!model,
      field: fieldName,
    };
  }

  return result;
}

/**
 * Check if pro models are properly configured
 *
 * @param {Object} config - Configuration object
 * @returns {Object} { configured: boolean, missing: string[] }
 */
function checkProModelsConfigured(config) {
  const missing = [];

  // Check Gemini pro model
  if (!config.GeminiProModel) {
    missing.push("GeminiProModel (Gemini)");
  }

  // Check Qwen pro model
  if (!config.QwenProModel) {
    missing.push("QwenProModel (Qwen)");
  }

  // Check Deepseek pro model
  if (!config.DeepseekProModel) {
    missing.push("DeepseekProModel (Deepseek)");
  }

  // Check Ollama pro model for current family
  const family = (config.OllamaFamily || "gemma").toLowerCase();
  const familyTitle = family.charAt(0).toUpperCase() + family.slice(1);
  const ollamaProField = `Ollama${familyTitle}ProModel`;
  if (!config[ollamaProField]) {
    missing.push(`${ollamaProField} (Ollama ${familyTitle})`);
  }

  return {
    configured: missing.length === 0,
    missing,
  };
}

export {
  resolveModel,
  getProviderModels,
  checkProModelsConfigured,
  TASK_FIELD_MAP,
  DEFAULT_MODELS,
  BACKWARD_COMPAT_FIELD_MAP,
};

export default {
  resolveModel,
  getProviderModels,
  checkProModelsConfigured,
};
