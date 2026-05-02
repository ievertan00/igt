/**
 * Configuration Loader
 * Merges .env (private) and config.json (shared) into unified config
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

/**
 * Parse .env file manually (no external dependency)
 */
function parseEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf8");
  return dotenv.parse(content);
}

/**
 * Load and merge configuration from .env and config.json
 */
class ConfigLoader {
  constructor(projectRoot = null) {
    this.projectRoot = projectRoot || path.join(__dirname, "..");
    this.envPath = path.join(this.projectRoot, ".env");
    this.configPath = path.join(__dirname, "igt_config.json");
    this.env = {};
    this.config = {};
    this.merged = {};
  }

  /**
   * Load all configurations
   */
  load() {
    // Load .env file
    this.env = parseEnvFile(this.envPath);

    // Load config.json
    if (fs.existsSync(this.configPath)) {
      this.config = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
    } else {
      throw new Error(`Config file not found: ${this.configPath}`);
    }

    // Merge configurations
    this.merged = this.mergeConfigs();

    // Set environment variables from .env if not already set
    this.applyEnvVars();

    return this.merged;
  }

  /**
   * Merge .env and config.json with proper priority
   * Priority: .env vars > config.json > defaults
   */
  mergeConfigs() {
    const merged = { ...this.config };

    // API Keys
    merged.GeminiApiKeys = this.parseApiKeys("GOOGLE_API_KEYS");
    merged.QwenApiKeys = this.parseApiKeys("DASHSCOPE_API_KEYS");
    merged.DeepseekApiKeys = this.parseApiKeys("DEEPSEEK_API_KEYS");

    // 映射表：envKey => mergedKey
    const mappings = {
      IGT_DB_PATH: "DbPath",
      IGT_LOG_PATH: "LogPath",
      IGT_REVIEW_PATH: "ReviewPath",
      IGT_REPORT_PATH: "ReportPath",
      IGT_VAULT_DIR: "VaultDir",
      IGT_PRACTICE_FILE: "PracticeFile",
    };

    // 批量赋值
    Object.entries(mappings).forEach(([k, m]) => {
      if (this.env[k]) merged[m] = this.env[k];
    });

    // 特殊
    if (this.env.IGT_LLM_PROVIDER)
      merged.LLMProvider = this.env.IGT_LLM_PROVIDER.toLowerCase();
    merged.VocabFile =
      this.env.IGT_VOCABULARY_FILE ||
      this.env.IGT_VOCAB_FILE ||
      merged.VocabFile;

    // 默认值
    merged.DbPath ??= "igt_data.db";
    merged.LogPath ??= "igt_db_error.log";
    merged.ReportPath ??= "docs";
    merged.VocabFile ??= "IGT Vocabulary.md";

    return merged;
  }

  /**
   * Parse comma-separated API keys from .env
   */
  parseApiKeys(envKey) {
    const value = this.env[envKey];
    if (!value || value.trim() === "") {
      return [];
    }

    return value
      .split(",")
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
  }

  /**
   * Apply environment variables from .env to process.env
   * Only if not already set in system environment
   */
  applyEnvVars() {
    const envMappings = {
      GOOGLE_API_KEYS: null, // Handled separately
      DASHSCOPE_API_KEYS: null,
      DEEPSEEK_API_KEYS: null,
      IGT_LLM_PROVIDER: null, // Handled separately
      IGT_DB_PATH: null, // Handled separately
      IGT_LOG_PATH: null, // Handled separately
      IGT_REVIEW_PATH: null, // Handled separately
      IGT_REPORT_PATH: null, // Handled separately
      IGT_VAULT_DIR: null, // Handled separately
      IGT_VOCAB_FILE: null, // Handled separately
      IGT_VOCABULARY_FILE: null, // Handled separately
      IGT_PRACTICE_FILE: null, // Handled separately
      GEMINI_SYSTEM_MD: "GEMINI_SYSTEM_MD",
      GEMINI_TELEMETRY_ENABLED: "GEMINI_TELEMETRY_ENABLED",
    };

    for (const [envKey, procKey] of Object.entries(envMappings)) {
      if (envKey in this.env && procKey && !(procKey in process.env)) {
        process.env[procKey] = this.env[envKey];
      }
    }

    // Set individual API keys for backward compatibility
    const apiKeyEnvVars = [
      "GOOGLE_API_KEYS",
      "DASHSCOPE_API_KEYS",
      "DEEPSEEK_API_KEYS",
    ];

    const setApikey = (envKey) => {
      if (this.env[envKey] && !process.env[envKey.replace("_KEYS", "_KEY")]) {
        const keys = this.parseApiKeys(envKey);
        if (keys.length) process.env[envKey.replace("_KEYS", "_KEY")] = keys[0];
      }
    };

    apiKeyEnvVars.forEach(setApikey);
  }

  /**
   * Get merged configuration
   */
  getConfig() {
    if (Object.keys(this.merged).length === 0) {
      return this.load();
    }
    return this.merged;
  }

  /**
   * Save configuration back to config.json (without API keys)
   */
  saveConfig(config) {
    const configToSave = { ...config };

    // Remove any API keys that might have been added
    delete configToSave.GeminiApiKeys;
    delete configToSave.QwenApiKeys;
    delete configToSave.DeepseekApiKeys;

    fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 4));
  }

  /**
   * Update .env file with new API keys
   */
  updateEnv(updates) {
    const currentEnv = parseEnvFile(this.envPath);
    const updated = { ...currentEnv, ...updates };

    // 1. 固定头部注释
    const lines = [
      "# ============================================",
      "# IGT Environment Configuration",
      "# ============================================",
      "# This file contains PRIVATE data (API keys, secrets)",
      "# NEVER commit this file to version control!",
      "# ============================================",
      "",
    ];

    // 2. 通用方法：生成一行环境变量
    const addEnvLine = (key) => {
      const value = updated[key] ?? "";
      lines.push(`${key}=${value}`);
    };

    // 3. 批量添加 API KEY（每组之间空行）
    const apiKeys = [
      "GOOGLE_API_KEYS",
      "DASHSCOPE_API_KEYS",
      "DEEPSEEK_API_KEYS",
    ];
    apiKeys.forEach((key) => {
      addEnvLine(key);
      lines.push("");
    });

    // 4. 其他配置
    if (updated.IGT_LLM_PROVIDER) {
      addEnvLine("IGT_LLM_PROVIDER");
    }

    // 5. 路径配置（带注释）
    lines.push("", "# File paths (managed in .env)");
    const pathConfigs = [
      "IGT_DB_PATH",
      "IGT_LOG_PATH",
      "IGT_REVIEW_PATH",
      "IGT_REPORT_PATH",
      "IGT_VAULT_DIR",
      "IGT_VOCABULARY_FILE",
      "IGT_PRACTICE_FILE",
    ];
    pathConfigs.forEach(addEnvLine);

    // 6. 写入文件
    fs.writeFileSync(this.envPath, lines.join("\n") + "\n");
  }

  /**
   * Check if .env file exists
   */
  hasEnvFile() {
    return fs.existsSync(this.envPath);
  }

  /**
   * Create .env from example if it doesn't exist
   */
  createEnvFromExample() {
    const examplePath = path.join(this.projectRoot, ".env.example");
    if (!this.hasEnvFile() && fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, this.envPath);
      return true;
    }
    return false;
  }
}

// Singleton instance
const configLoader = new ConfigLoader();

export { ConfigLoader, configLoader };
export default configLoader;
