import dotenv from "dotenv";
import fs from "fs";
import path from "path";

const __dirname = import.meta.dirname;

function parseEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  return dotenv.parse(fs.readFileSync(envPath, "utf8"));
}

class ConfigLoader {
  constructor(projectRoot = null) {
    this.projectRoot = projectRoot || path.join(__dirname, "..", "..");
    this.envPath = path.join(this.projectRoot, ".env");
    this.configPath = path.join(this.projectRoot, "igt_config.json");
    this.env = {};
    this.config = {};
    this.merged = {};
  }

  load() {
    this.env = parseEnvFile(this.envPath);
    if (fs.existsSync(this.configPath)) {
      this.config = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
    } else {
      throw new Error(`Config file not found: ${this.configPath}`);
    }
    this.merged = this._merge();
    this._applyEnvVars();
    return this.merged;
  }

  _merge() {
    const e = this.env;
    const merged = { ...this.config };

    merged.GeminiApiKeys = this._parseApiKeys("GOOGLE_API_KEYS");
    merged.QwenApiKeys = this._parseApiKeys("DASHSCOPE_API_KEYS");
    merged.DeepseekApiKeys = this._parseApiKeys("DEEPSEEK_API_KEYS");

    const mappings = {
      IGT_DB_PATH:                 "DbPath",
      IGT_GRAMMAR_REF_DB_PATH:     "GrammarRefDbPath",
      IGT_LOG_PATH:                "LogPath",
      IGT_REVIEW_PATH:             "ReviewPath",
      IGT_REPORT_PATH:             "ReportPath",
      IGT_VAULT_DIR:               "VaultDir",
      IGT_PRACTICE_FILE:           "PracticeFile",
      IGT_ASK_FILE:                "AskFile",
      IGT_ASK_DIR:                 "AskDir",
      IGT_LOCAL_ADDRESS:           "LocalAddress",
      IGT_THEME:                   "Theme",
      IGT_OLLAMA_FLASH_MODEL:      "OllamaFlashModel",
      IGT_OLLAMA_PRO_MODEL:        "OllamaProModel",
      IGT_OLLAMA_FAMILY:           "OllamaFamily",
      IGT_OLLAMA_GEMMA_FLASH_MODEL:"OllamaGemmaFlashModel",
      IGT_OLLAMA_GEMMA_PRO_MODEL:  "OllamaGemmaProModel",
      IGT_OLLAMA_PHI_FLASH_MODEL:  "OllamaPhiFlashModel",
      IGT_OLLAMA_PHI_PRO_MODEL:    "OllamaPhiProModel",
      IGT_PRE_FETCH_INSTEAD_OF_TOOLS: "PreFetchInsteadOfTools",
      IGT_GEMINI_FLASH_MODEL:      "GeminiFlashModel",
      IGT_GEMINI_PRO_MODEL:        "GeminiProModel",
      IGT_QWEN_FLASH_MODEL:        "QwenFlashModel",
      IGT_QWEN_PRO_MODEL:          "QwenProModel",
      IGT_DEEPSEEK_FLASH_MODEL:    "DeepseekFlashModel",
      IGT_DEEPSEEK_PRO_MODEL:      "DeepseekProModel",
    };
    for (const [k, m] of Object.entries(mappings)) {
      if (e[k]) {
        merged[m] = e[k];
      }
    }

    // IGT_OLLAMA_MODEL: legacy single-model override — applies to current family
    if (e.IGT_OLLAMA_MODEL) {
      const family = (merged.OllamaFamily || "gemma").toLowerCase();
      const t = family.charAt(0).toUpperCase() + family.slice(1);
      if (!e[`IGT_OLLAMA_${family.toUpperCase()}_FLASH_MODEL`])
        merged[`Ollama${t}FlashModel`] = e.IGT_OLLAMA_MODEL;
      if (!e[`IGT_OLLAMA_${family.toUpperCase()}_PRO_MODEL`])
        merged[`Ollama${t}ProModel`] = e.IGT_OLLAMA_MODEL;
      merged.OllamaFlashModel ??= e.IGT_OLLAMA_MODEL;
      merged.OllamaProModel   ??= e.IGT_OLLAMA_MODEL;
    }

    // TTS endpoint overrides — environment-specific values (ports) belong in
    // .env, so users can point IGT at any OpenAI-compatible TTS provider without
    // editing igt_config.json or code.
    merged.Tts = { ...(merged.Tts || {}) };
    if (e.IGT_TTS_BASE_URL) merged.Tts.BaseUrl = e.IGT_TTS_BASE_URL;
    if (e.IGT_TTS_VOICE)    merged.Tts.Voice   = e.IGT_TTS_VOICE;
    if (e.IGT_TTS_MODEL)    merged.Tts.Model   = e.IGT_TTS_MODEL;
    // Optional local TTS adapter script igt should auto-launch at startup (e.g. the
    // CosyVoice shim). Provider-agnostic: unset means no sidecar.
    if (e.IGT_TTS_SIDECAR)  merged.Tts.Sidecar = e.IGT_TTS_SIDECAR;
    // Low-latency streaming playback via ffplay (pipes raw PCM from the shim's
    // /v1/audio/stream). Off unless explicitly enabled; falls back to WAV if ffplay
    // is missing. IGT_TTS_FFPLAY overrides the ffplay binary path.
    if (e.IGT_TTS_STREAM)   merged.Tts.Stream    = e.IGT_TTS_STREAM === "true";
    if (e.IGT_TTS_FFPLAY)   merged.Tts.FfplayPath = e.IGT_TTS_FFPLAY;

    if (e.IGT_LLM_PROVIDER) merged.LLMProvider = e.IGT_LLM_PROVIDER.toLowerCase();
    merged.VocabFile = e.IGT_VOCABULARY_FILE || e.IGT_VOCAB_FILE || merged.VocabFile;

    merged.DbPath              ??= "igt_data.db";
    merged.GrammarRefDbPath    ??= "grammar_ref.db";
    merged.LogPath             ??= "igt_db_error.log";
    merged.Theme               ??= "auto";
    merged.VocabFile           ??= "IGT Vocabulary.md";
    merged.OllamaFamily        ??= "gemma";
    merged.OllamaGemmaFlashModel ??= "gemma4-fast";
    merged.OllamaGemmaProModel   ??= "gemma4:12b";
    merged.OllamaPhiFlashModel   ??= "phi4";
    merged.OllamaPhiProModel     ??= "phi4";
    merged.OllamaFlashModel      ??= "phi4";
    merged.OllamaProModel        ??= "phi4";
    merged.PracticeFile          ??= "IGT Practice.md";
    const askFileFromUser = merged.AskFile != null; // user set IGT_ASK_FILE / config AskFile
    merged.AskFile               ??= "03_Ask_Log.md";

    if (merged.PreFetchInsteadOfTools !== undefined) {
      merged.PreFetchInsteadOfTools =
        merged.PreFetchInsteadOfTools === true ||
        merged.PreFetchInsteadOfTools === "true";
    } else {
      merged.PreFetchInsteadOfTools = true;
    }

    if (merged.VaultDir) {
      merged.VocabularyPath = path.join(merged.VaultDir, merged.VocabFile);
      merged.PracticePath   = path.join(merged.VaultDir, merged.PracticeFile);

      if (!merged.AskDir && !askFileFromUser) {
        // No explicit AskDir/AskFile: reuse an existing vault folder if one is
        // present, otherwise default to "Asks".
        const existing = ["Asks", "Consultations", "Ask"]
          .map((name) => path.join(merged.VaultDir, name))
          .find((p) => fs.existsSync(p));
        merged.AskDir = existing || path.join(merged.VaultDir, "Asks");
      }
    }

    return merged;
  }

  _parseApiKeys(envKey) {
    const value = this.env[envKey];
    if (!value || !value.trim()) return [];
    return value.split(",").map(k => k.trim()).filter(Boolean);
  }

  _applyEnvVars() {
    const e = this.env;
    // Pass through a handful of env vars that code reads directly from process.env
    for (const key of ["IGT_OLLAMA_MODEL", "GEMINI_SYSTEM_MD", "GEMINI_TELEMETRY_ENABLED"]) {
      if (key in e && !(key in process.env)) process.env[key] = e[key];
    }
    // Set singular API key from plural for providers that still read GOOGLE_API_KEY etc.
    for (const plural of ["GOOGLE_API_KEYS", "DASHSCOPE_API_KEYS", "DEEPSEEK_API_KEYS"]) {
      const singular = plural.replace("_KEYS", "_KEY");
      if (e[plural] && !process.env[singular]) {
        const first = this._parseApiKeys(plural)[0];
        if (first) process.env[singular] = first;
      }
    }
  }

  saveConfig(config) {
    const toSave = { ...config };
    // Strip runtime-only (API key arrays) and env-managed fields
    for (const k of [
      "GeminiApiKeys", "QwenApiKeys", "DeepseekApiKeys",
      "DbPath", "GrammarRefDbPath", "LogPath",
      "ReviewPath", "ReportPath", "VaultDir",
      "PracticeFile", "AskFile", "AskDir", "LocalAddress",
      "VocabFile", "Theme",
      "VocabularyPath", "PracticePath",
      "OllamaFlashModel", "OllamaProModel",
    ]) delete toSave[k];
    fs.writeFileSync(this.configPath, JSON.stringify(toSave, null, 4));
  }

  updateEnv(updates) {
    // Line-preserving update: rewrite only the keys in `updates`, leaving every
    // other line — comments, blank lines, and keys we don't manage (TTS/COSY_*,
    // etc.) — untouched. A fixed-template regeneration used to silently drop all
    // of those, wiping voice config and commented-out settings on every provider
    // or theme switch.
    const lines = fs.existsSync(this.envPath)
      ? fs.readFileSync(this.envPath, "utf8").split(/\r?\n/)
      : [];
    const remaining = { ...updates };
    for (let i = 0; i < lines.length; i++) {
      // Match an uncommented `KEY=` assignment; commented lines start with # and
      // won't match the key char class, so they're preserved.
      const m = lines[i].match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m && Object.prototype.hasOwnProperty.call(remaining, m[1])) {
        lines[i] = `${m[1]}=${remaining[m[1]] ?? ""}`;
        delete remaining[m[1]];
      }
    }
    // Append any keys that weren't already present.
    for (const key of Object.keys(remaining)) {
      lines.push(`${key}=${remaining[key] ?? ""}`);
    }
    let out = lines.join("\n");
    if (!out.endsWith("\n")) out += "\n";
    fs.writeFileSync(this.envPath, out);
  }

  hasEnvFile() {
    return fs.existsSync(this.envPath);
  }

  createEnvFromExample() {
    const examplePath = path.join(this.projectRoot, ".env.example");
    if (!this.hasEnvFile() && fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, this.envPath);
      return true;
    }
    return false;
  }
}

const configLoader = new ConfigLoader();

export { ConfigLoader, configLoader };
export default configLoader;
