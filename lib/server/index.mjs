/**
 * IGT HTTP Server — boot + route registration.
 * All route handlers live under lib/server/routes/*.
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import configLoader from "../shared/config-loader.mjs";
import { runMigrations } from "../db/migrations.mjs";
import { dispatch } from "./router.mjs";
import { registerGrammarRoutes } from "./routes/grammar.mjs";
import { registerSrsRoutes } from "./routes/srs.mjs";
import { registerVocabRoutes } from "./routes/vocab.mjs";
import { registerStatsRoutes } from "./routes/stats.mjs";
import { registerManagementRoutes } from "./routes/management.mjs";
import { registerAskRoutes } from "./routes/ask.mjs";
import { registerChatRoutes } from "./routes/chat.mjs";
import { getDb, closeAll } from "../db/connection.mjs";
import { grammarRefAvailable } from "../db/grammar-ref.mjs";
import { registerTranslationRoutes } from "./routes/translation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");
const PORT = parseInt(process.env.IGT_SERVER_PORT || "18964", 10);
const HOST = process.env.IGT_SERVER_HOST || "127.0.0.1";
const config = configLoader.load();

let _llmManager = null;
async function getLLMManager() {
  if (!_llmManager) {
    const initializeLLMProviders = (await import("./llm/init.mjs")).default;
    _llmManager = initializeLLMProviders(config);
    validateActiveProviderKeys(_llmManager);
  }
  return _llmManager;
}

function validateActiveProviderKeys(manager) {
  const provider = (manager.getCurrentProviderName() || "").toLowerCase();
  const map = {
    gemini: { keys: "GeminiApiKeys", env: "GOOGLE_API_KEYS" },
    qwen: { keys: "QwenApiKeys", env: "DASHSCOPE_API_KEYS" },
    deepseek: { keys: "DeepseekApiKeys", env: "DEEPSEEK_API_KEYS" },
  };
  const entry = map[provider];
  if (!entry) return;
  const keys = config[entry.keys];
  if (!Array.isArray(keys) || keys.length === 0) {
    process.stderr.write(
      `Error: No API keys configured for "${provider}". Add ${entry.env} to .env\n`,
    );
    process.exit(1);
  }
}

async function ensureMigrations() {
  const db = await getDb();
  const ran = await runMigrations(db, path.join(projectRoot, "migrations"), {
    logger: (msg) => console.error(`[IGT-SERVER] ${msg}`),
  });
  if (ran.length > 0) console.error(`[IGT-SERVER] Applied ${ran.length} migration(s).`);
}

await ensureMigrations();

registerGrammarRoutes({ getLLMManager });
registerSrsRoutes({ getLLMManager });
registerVocabRoutes();
registerStatsRoutes();
registerManagementRoutes({ getLLMManager });
registerAskRoutes({ getLLMManager, config });
registerChatRoutes({ getLLMManager, config });
registerTranslationRoutes({ getLLMManager });

const server = http.createServer((req, res) => dispatch(req, res));

server.listen(PORT, HOST, () => {
  const provider = config.LLMProvider || "gemini";
  const modelMap = {
    gemini: config.GeminiFlashModel || "gemini-2.5-flash",
    qwen: config.QwenFlashModel || "qwen3.5-flash",
    deepseek: config.DeepseekFlashModel || "deepseek-chat",
  };
  console.error(`[IGT-SERVER] Ready on http://${HOST}:${PORT}`);
  console.error(`[IGT-SERVER] PID: ${process.pid}`);
  console.error(`[IGT-SERVER] Provider: ${provider} | Model: ${modelMap[provider] || "unknown"}`);
  if (!grammarRefAvailable()) {
    console.error(
      `[IGT-SERVER] ⚠️  Grammar reference disabled — grammar_ref.db not found. Run: node scripts/index-wikipedia.mjs`,
    );
  } else {
    console.error(`[IGT-SERVER] 📚 Grammar reference grounding active`);
  }
});

const shutdown = () => {
  console.error("[IGT-SERVER] Shutting down...");
  server.close(() => {
    closeAll();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", (e) =>
  console.error("[IGT-SERVER] Uncaught exception:", e.message),
);
