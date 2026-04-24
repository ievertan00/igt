/**
 * Configuration Loader
 * Merges .env (private) and config.json (shared) into unified config
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse .env file manually (no external dependency)
 */
function parseEnvFile(envPath) {
  const env = {};
  
  if (!fs.existsSync(envPath)) {
    return env;
  }
  
  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split("\n");
  
  for (const line of lines) {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    
    // Parse KEY=VALUE
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let rawValue = match[2].trim();
      let value = "";
      
      // Handle inline comments and quotes
      if (rawValue.startsWith('"')) {
        const endQuote = rawValue.indexOf('"', 1);
        value = (endQuote !== -1) ? rawValue.slice(1, endQuote) : rawValue.slice(1);
      } else if (rawValue.startsWith("'")) {
        const endQuote = rawValue.indexOf("'", 1);
        value = (endQuote !== -1) ? rawValue.slice(1, endQuote) : rawValue.slice(1);
      } else {
        // No quotes, everything before the first # is the value
        const hashIdx = rawValue.indexOf('#');
        value = (hashIdx !== -1) ? rawValue.slice(0, hashIdx).trim() : rawValue;
      }
      
      env[key] = value;
    }
  }
  
  return env;
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

    // Extract API keys from .env
    merged.GeminiApiKeys = this.parseApiKeys("GOOGLE_API_KEYS");
    merged.QwenApiKeys = this.parseApiKeys("DASHSCOPE_API_KEYS");
    merged.DeepseekApiKeys = this.parseApiKeys("DEEPSEEK_API_KEYS");

    // LLM Provider from .env takes priority
    if (this.env.IGT_LLM_PROVIDER) {
      merged.LLMProvider = this.env.IGT_LLM_PROVIDER.toLowerCase();
    }

    // File paths from .env take priority over config.json
    if (this.env.IGT_DB_PATH) {
      merged.DbPath = this.env.IGT_DB_PATH;
    }
    if (this.env.IGT_LOG_PATH) {
      merged.LogPath = this.env.IGT_LOG_PATH;
    }
    if (this.env.IGT_REVIEW_PATH) {
      merged.ReviewPath = this.env.IGT_REVIEW_PATH;
    }
    if (this.env.IGT_REPORT_PATH) {
      merged.ReportPath = this.env.IGT_REPORT_PATH;
    }
    if (this.env.IGT_VAULT_DIR) {
      merged.VaultDir = this.env.IGT_VAULT_DIR;
    }
    if (this.env.IGT_VOCAB_FILE || this.env.IGT_VOCABULARY_FILE) {
      merged.VocabFile = this.env.IGT_VOCABULARY_FILE || this.env.IGT_VOCAB_FILE;
    }
    if (this.env.IGT_PRACTICE_FILE) {
      merged.PracticeFile = this.env.IGT_PRACTICE_FILE;
    }

    // Default values if not provided anywhere
    if (!merged.DbPath) merged.DbPath = "igt_data.db";
    if (!merged.LogPath) merged.LogPath = "igt_db_error.log";
    if (!merged.ReportPath) merged.ReportPath = "docs";
    if (!merged.VocabFile) merged.VocabFile = "IGT Vocabulary.md";

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
      .map(key => key.trim())
      .filter(key => key.length > 0);
  }
  
  /**
   * Apply environment variables from .env to process.env
   * Only if not already set in system environment
   */
  applyEnvVars() {
    const envMappings = {
      "GOOGLE_API_KEYS": null, // Handled separately
      "DASHSCOPE_API_KEYS": null,
      "DEEPSEEK_API_KEYS": null,
      "IGT_LLM_PROVIDER": null, // Handled separately
      "IGT_DB_PATH": null, // Handled separately
      "IGT_LOG_PATH": null, // Handled separately
      "IGT_REVIEW_PATH": null, // Handled separately
      "IGT_REPORT_PATH": null, // Handled separately
      "IGT_VAULT_DIR": null, // Handled separately
      "IGT_VOCAB_FILE": null, // Handled separately
      "IGT_VOCABULARY_FILE": null, // Handled separately
      "IGT_PRACTICE_FILE": null, // Handled separately
      "GEMINI_SYSTEM_MD": "GEMINI_SYSTEM_MD",
      "GEMINI_TELEMETRY_ENABLED": "GEMINI_TELEMETRY_ENABLED",
      "NO_COLOR": "NO_COLOR"
    };
    
    for (const [envKey, procKey] of Object.entries(envMappings)) {
      if (envKey in this.env && procKey && !(procKey in process.env)) {
        process.env[procKey] = this.env[envKey];
      }
    }
    
    // Set individual API keys for backward compatibility
    if (this.env.GOOGLE_API_KEYS && !process.env.GOOGLE_API_KEY) {
      const keys = this.parseApiKeys("GOOGLE_API_KEYS");
      if (keys.length > 0) {
        process.env.GOOGLE_API_KEY = keys[0];
      }
    }
    
    if (this.env.DASHSCOPE_API_KEYS && !process.env.DASHSCOPE_API_KEY) {
      const keys = this.parseApiKeys("DASHSCOPE_API_KEYS");
      if (keys.length > 0) {
        process.env.DASHSCOPE_API_KEY = keys[0];
      }
    }
    
    if (this.env.DEEPSEEK_API_KEYS && !process.env.DEEPSEEK_API_KEY) {
      const keys = this.parseApiKeys("DEEPSEEK_API_KEYS");
      if (keys.length > 0) {
        process.env.DEEPSEEK_API_KEY = keys[0];
      }
    }
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
    
    fs.writeFileSync(
      this.configPath,
      JSON.stringify(configToSave, null, 4)
    );
  }
  
  /**
   * Update .env file with new API keys
   */
  updateEnv(updates) {
    const currentEnv = parseEnvFile(this.envPath);
    const updated = { ...currentEnv, ...updates };
    
    const lines = [
      "# ============================================",
      "# IGT Environment Configuration",
      "# ============================================",
      "# This file contains PRIVATE data (API keys, secrets)",
      "# NEVER commit this file to version control!",
      "# ============================================",
      ""
    ];
    
    // Write API keys
    if (updated.GOOGLE_API_KEYS) {
      lines.push(`GOOGLE_API_KEYS=${updated.GOOGLE_API_KEYS}`);
    } else {
      lines.push("GOOGLE_API_KEYS=");
    }
    lines.push("");
    
    if (updated.DASHSCOPE_API_KEYS) {
      lines.push(`DASHSCOPE_API_KEYS=${updated.DASHSCOPE_API_KEYS}`);
    } else {
      lines.push("DASHSCOPE_API_KEYS=");
    }
    lines.push("");
    
    if (updated.DEEPSEEK_API_KEYS) {
      lines.push(`DEEPSEEK_API_KEYS=${updated.DEEPSEEK_API_KEYS}`);
    } else {
      lines.push("DEEPSEEK_API_KEYS=");
    }
    lines.push("");
    
    // Write other settings
    if (updated.IGT_LLM_PROVIDER) {
      lines.push(`IGT_LLM_PROVIDER=${updated.IGT_LLM_PROVIDER}`);
    }
    if (updated.GEMINI_SYSTEM_MD) {
      lines.push(`GEMINI_SYSTEM_MD=${updated.GEMINI_SYSTEM_MD}`);
    }
    if (updated.GEMINI_TELEMETRY_ENABLED) {
      lines.push(`GEMINI_TELEMETRY_ENABLED=${updated.GEMINI_TELEMETRY_ENABLED}`);
    }
    if (updated.NO_COLOR) {
      lines.push(`NO_COLOR=${updated.NO_COLOR}`);
    }
    
    // Write Path settings
    lines.push("");
    lines.push("# File paths (managed in .env)");
    if (updated.IGT_DB_PATH) {
      lines.push(`IGT_DB_PATH=${updated.IGT_DB_PATH}`);
    } else {
      lines.push("IGT_DB_PATH=");
    }

    if (updated.IGT_LOG_PATH) {
      lines.push(`IGT_LOG_PATH=${updated.IGT_LOG_PATH}`);
    } else {
      lines.push("IGT_LOG_PATH=");
    }

    if (updated.IGT_REVIEW_PATH) {
      lines.push(`IGT_REVIEW_PATH=${updated.IGT_REVIEW_PATH}`);
    } else {
      lines.push("IGT_REVIEW_PATH=");
    }
    
    if (updated.IGT_REPORT_PATH) {
      lines.push(`IGT_REPORT_PATH=${updated.IGT_REPORT_PATH}`);
    } else {
      lines.push("IGT_REPORT_PATH=");
    }

    if (updated.IGT_VAULT_DIR) {
      lines.push(`IGT_VAULT_DIR=${updated.IGT_VAULT_DIR}`);
    } else {
      lines.push("IGT_VAULT_DIR=");
    }

    if (updated.IGT_VOCAB_FILE) {
      lines.push(`IGT_VOCAB_FILE=${updated.IGT_VOCAB_FILE}`);
    } else {
      lines.push("IGT_VOCAB_FILE=");
    }

    if (updated.IGT_VOCABULARY_FILE) {
      lines.push(`IGT_VOCABULARY_FILE=${updated.IGT_VOCABULARY_FILE}`);
    } else {
      lines.push("IGT_VOCABULARY_FILE=");
    }

    if (updated.IGT_PRACTICE_FILE) {
      lines.push(`IGT_PRACTICE_FILE=${updated.IGT_PRACTICE_FILE}`);
    } else {
      lines.push("IGT_PRACTICE_FILE=");
    }
    
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
