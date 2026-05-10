import { register } from "../router.mjs";
import configLoader from "../../config-loader.mjs";
import { getLastN, undoLastN, resetSessionState } from "../../db/inputs.mjs";
import { getRandomMessage } from "../../db/status-messages.mjs";

export function registerManagementRoutes({ getLLMManager }) {
  register("GET", "/health", async (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed / 1024 / 1024,
    }));
  });

  register("GET", (url) => url.startsWith("/inputs/last"), async (req, res) => {
    const n = parseInt(new URL(req.url, "http://x").searchParams.get("n") || "1", 10);
    const rows = await getLastN(n);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ rows }));
  });

  register("POST", "/undo", async (req, res, { body }) => {
    const n = body?.n ?? 1;
    const count = Math.max(1, Math.min(parseInt(n, 10) || 1, 50));
    const result = await undoLastN(count);
    if (result.deleted_inputs > 0) resetSessionState();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });

  register("GET", "/status-message", async (req, res) => {
    const row = await getRandomMessage();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(row));
  });

  register("POST", "/switch", async (req, res, { body }) => {
    const { provider } = body;
    if (!provider) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'provider' field" }));
      return;
    }
    const mgr = await getLLMManager();
    const newProvider = mgr.switchProvider(provider, { updateEnv: false });
    process.env.IGT_LLM_PROVIDER = newProvider;
    configLoader.updateEnv({ IGT_LLM_PROVIDER: newProvider });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ provider: newProvider }));
  });

  register("POST", "/switch-model", async (req, res, { body }) => {
    const { provider, model } = body;
    if (!provider) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'provider' field" }));
      return;
    }
    const mgr = await getLLMManager();
    const newProvider = mgr.switchProvider(provider, { updateEnv: false });
    process.env.IGT_LLM_PROVIDER = newProvider;
    const updates = { IGT_LLM_PROVIDER: newProvider };
    if (newProvider === "ollama") {
      if (!model) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing 'model' field for ollama provider" }));
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
