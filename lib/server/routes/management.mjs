import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { getRandomMessage } from "../../db/status-messages.mjs";
import { unloadModel } from "../llm/ollama.mjs";
import { resolveModel } from "../llm/model-resolver.mjs";
import { errorPayload } from "../../contracts/errors.mjs";
import { getRequestModelContext } from "../llm/request-model-context.mjs";

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

export function registerManagementRoutes({ getLLMManager }) {
  register("GET", "/health", async (req, res) => {
    let database = "ok";
    try {
      const { getDb } = await import("../../db/connection.mjs");
      const db = await getDb();
      db.prepare("SELECT 1").get();
    } catch {
      database = "error";
    }
    const ready = database === "ok";
    res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: ready ? "ok" : "degraded",
      checks: { database },
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed / 1024 / 1024,
    }));
  });

  register("GET", "/status-message", async (req, res) => {
    const row = await getRandomMessage();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(row));
  });

  register("POST", "/switch", async (req, res, { body }) => {
    const { provider } = body;
    if (!provider) {
      json(res, 400, errorPayload("INVALID_REQUEST", "Missing 'provider' field"));
      return;
    }
    const mgr = await getLLMManager();
    const newProvider = mgr.switchProvider(provider, { updateEnv: false });
    process.env.IGT_LLM_PROVIDER = newProvider;
    configLoader.updateEnv({ IGT_LLM_PROVIDER: newProvider });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ provider: newProvider }));
  });

  register("POST", "/ollama/unload", async (req, res) => {
    const cliManager = getRequestModelContext()?.cliTask ? await getLLMManager() : null;
    const config = cliManager?.config || configLoader.load();
    const provider = cliManager?.getCurrentProviderName() || process.env.IGT_LLM_PROVIDER || config.LLMProvider || "gemini";
    if (provider !== "ollama") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ skipped: true }));
      return;
    }
    const { model } = resolveModel("ollama", "grammar", config);
    const baseUrl = config.OllamaBaseUrl || "http://localhost:11434";
    await unloadModel(baseUrl, model);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, model }));
  });

  register("POST", "/switch-model", async (req, res, { body }) => {
    const { provider, model } = body;
    if (!provider) {
      json(res, 400, errorPayload("INVALID_REQUEST", "Missing 'provider' field"));
      return;
    }
    const mgr = await getLLMManager();
    const newProvider = mgr.switchProvider(provider, { updateEnv: false });
    process.env.IGT_LLM_PROVIDER = newProvider;
    const updates = { IGT_LLM_PROVIDER: newProvider };
    if (newProvider === "ollama") {
      if (!model) {
        json(res, 400, errorPayload("INVALID_REQUEST", "Missing 'model' field for ollama provider"));
        return;
      }
      const config = configLoader.load();
      config.OllamaModel = model;
      updates.IGT_OLLAMA_MODEL = model;
    }
    configLoader.updateEnv(updates);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ provider: newProvider, model: newProvider === "ollama" ? model : undefined }));
  });
}
