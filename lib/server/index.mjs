/**
 * IGT HTTP Server — boot + route registration.
 * All route handlers live under lib/server/routes/*.
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import configLoader from "../shared/config-loader.mjs";
import { runMigrations } from "../db/migrations.mjs";
import { backupBeforeMigrations } from "../db/backup.mjs";
import { createDispatcher } from "./router.mjs";
import { registerGrammarRoutes } from "./routes/grammar.mjs";
import { registerSrsRoutes } from "./routes/srs.mjs";
import { registerVocabRoutes } from "./routes/vocab.mjs";
import { registerStatsRoutes } from "./routes/stats.mjs";
import { registerManagementRoutes } from "./routes/management.mjs";
import { registerLlmSettingsRoutes } from "./routes/llm-settings.mjs";
import { registerFileSettingsRoutes } from "./routes/file-settings.mjs";
import { registerAskRoutes } from "./routes/ask.mjs";
import { registerChatRoutes } from "./routes/chat.mjs";
import { getDb, closeAll } from "../db/connection.mjs";
import { acquireRuntimeLock, updateRuntimeLock, releaseRuntimeLock } from "../db/runtime-lock.mjs";
import { registerTranslationRoutes } from "./routes/translation.mjs";
import { registerPracticeRoutes } from "./routes/practice.mjs";
import { appendPracticeLog } from "../application/practice.mjs";
import { registerTextRoutes } from "./routes/text.mjs";
import { serveStatic } from "./static.mjs";
import { registerRuntimeRoutes } from "./routes/runtime.mjs";
import { registerDashboardRoutes } from "./routes/dashboard.mjs";
import { registerCoachRoutes } from "./routes/coach.mjs";
import { registerWordRoutes } from "./routes/word.mjs";
import { registerHandbookRoutes } from "./routes/handbook.mjs";
import { registerTtsRoutes } from "./routes/tts.mjs";
import { startTtsSidecar, stopTtsSidecar } from "../cli/server-manager.mjs";
import { syncVocabularySrs } from "../application/vocabulary.mjs";
import { requestModelManager } from "./llm/request-model.mjs";
import { guardRequest } from "./request-guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");
let runtimeActive = false;

function validateActiveProviderKeys(manager, config) {
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
    throw Object.assign(new Error(`No API keys configured for "${provider}". Add ${entry.env} to .env.`), { status: 503, code: "LLM_KEYS_MISSING" });
  }
}

async function ensureMigrations(dbPath) {
  const db = await getDb();
  const logger = (message) => console.error(`[IGT-SERVER] ${message}`);
  const ran = await runMigrations(db, path.join(projectRoot, "migrations"), {
    logger,
    beforeApply: ({ firstFile }) => backupBeforeMigrations({ db, dbPath, firstMigration: firstFile, logger }),
  });
  if (ran.length > 0) logger(`Applied ${ran.length} migration(s).`);
}

export async function startRuntime({
  port = Number.parseInt(process.env.IGT_SERVER_PORT || "0", 10),
  host = process.env.IGT_SERVER_HOST || "127.0.0.1",
  mode = process.env.IGT_RUNTIME_MODE || "standalone",
  skipVocabularySync = process.argv.includes("--skip-vocabulary-sync"),
} = {}) {
  if (runtimeActive) throw new Error("A Local Runtime is already starting or running in this process.");
  runtimeActive = true;
  let lockPath;
  let server;
  let sidecarStarted = false;
  let closing;
  const pendingRequests = new Set();

  function close() {
    closing ??= (async () => {
      try {
        if (server?.listening) await new Promise(resolve => server.close(resolve));
        // A disconnected client can leave its handler running, including writes.
        await Promise.allSettled(pendingRequests);
      } finally {
        try {
          if (sidecarStarted) stopTtsSidecar();
        } finally {
          try {
            if (lockPath) closeAll();
          } finally {
            if (lockPath) releaseRuntimeLock(lockPath);
            runtimeActive = false;
          }
        }
      }
    })();
    return closing;
  }

  try {
    const config = configLoader.load();
    const dbPath = path.resolve(projectRoot, config.DbPath || "igt_data.db");
    const lock = acquireRuntimeLock(dbPath, { mode, host, port });
    if (!lock.ok) {
      const other = lock.existing;
      throw new Error(`Another Local Runtime is already using this database (mode=${other.mode}, pid=${other.pid}, port=${other.port}, since ${other.startedAt}). Stop the other instance and retry.`);
    }
    lockPath = lock.lockPath;
    await ensureMigrations(dbPath);
    if (!skipVocabularySync) {
      const sync = await syncVocabularySrs({ config });
      if (sync.inserted || sync.updated) {
        console.error(`[IGT-SERVER] Vocabulary sync: ${sync.inserted} inserted, ${sync.updated} updated.`);
      }
    }

    let llmManager;
    const getLLMManager = requestModelManager(async ({ validateKeys = true } = {}) => {
      if (!llmManager) {
        const initializeLLMProviders = (await import("./llm/init.mjs")).default;
        llmManager ??= initializeLLMProviders(config);
      }
      if (validateKeys) validateActiveProviderKeys(llmManager, config);
      return llmManager;
    });
    const dispatchRuntime = createDispatcher(() => {
      registerGrammarRoutes({ getLLMManager });

      registerSrsRoutes({ getLLMManager });

      registerVocabRoutes();

      registerStatsRoutes();

      registerManagementRoutes({ getLLMManager });

      registerLlmSettingsRoutes({ getLLMManager, config });

      registerFileSettingsRoutes({ config, host });

      registerAskRoutes({ getLLMManager, config });

      registerChatRoutes({ getLLMManager, config });

      registerTranslationRoutes({ getLLMManager });

      registerPracticeRoutes({ getLLMManager, appendPracticeLog, config });

      registerTextRoutes({ getLLMManager });

      registerRuntimeRoutes();

      registerDashboardRoutes();

      registerCoachRoutes({ getLLMManager });

      registerWordRoutes({ getLLMManager });

      registerHandbookRoutes({ getLLMManager });

      registerTtsRoutes();
    });

    server = http.createServer((req, res) => {
      if (!guardRequest(req, res) || serveStatic(req, res)) return;
      const request = dispatchRuntime(req, res);
      pendingRequests.add(request);
      void request.finally(() => pendingRequests.delete(request));
    });
    // Coach reports may use the full configured generation budget.
    server.requestTimeout = 0;
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        server.off("error", reject);
        resolve();
      });
    });

    const actualPort = server.address().port;
    updateRuntimeLock(lockPath, { port: actualPort });
    if (config.Tts?.Sidecar) {
      startTtsSidecar(config.Tts.Sidecar);
      sidecarStarted = true;
    }
    const provider = config.LLMProvider || "gemini";
    const model = {
      gemini: config.GeminiFlashModel || "gemini-2.5-flash",
      qwen: config.QwenFlashModel || "qwen3.5-flash",
      deepseek: config.DeepseekFlashModel || "deepseek-chat",
    }[provider] || "unknown";
    return { host, port: actualPort, provider, model, close };
  } catch (error) {
    await close();
    throw error;
  }
}

export async function runRuntimeProcess() {
  const starting = startRuntime();
  let shuttingDown = false;
  async function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error("[IGT-SERVER] Shutting down...");
    const deadline = setTimeout(() => {
      stopTtsSidecar();
      process.exit(1);
    }, 4000).unref();
    try {
      await (await starting).close();
      process.exit(0);
    } catch (error) {
      console.error(`[IGT-SERVER] Shutdown failed: ${error.message}`);
      process.exit(1);
    } finally {
      clearTimeout(deadline);
    }
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("message", message => { if (message?.type === "igt:shutdown") void shutdown(); });
  if (process.send) process.on("disconnect", shutdown);
  process.on("uncaughtException", error => {
    console.error("[IGT-SERVER] Uncaught exception:", error.message);
    process.exit(1);
  });

  try {
    const runtime = await starting;
    if (shuttingDown) return;
    console.error(`[IGT-SERVER] Ready on http://${runtime.host}:${runtime.port}`);
    console.error(`[IGT-SERVER] PID: ${process.pid}`);
    console.error(`[IGT-SERVER] Provider: ${runtime.provider} | Model: ${runtime.model}`);
  } catch (error) {
    console.error(`[IGT-SERVER] Failed to start: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.main) await runRuntimeProcess();
