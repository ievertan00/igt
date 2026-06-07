import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { getOrStartSession } from "../../db/inputs.mjs";
import { handleChatTurn, resetChat } from "../../features/chat/handler.mjs";

function isRateLimitError(err) {
  const msg = (err?.message || "").toLowerCase();
  return err?.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/.test(msg);
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
}

export function registerChatRoutes({ getLLMManager, config }) {
  register("POST", "/chat", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const message = (body?.text || body?.message || "").trim();
    if (!message) {
      json(res, 400, { error: "Missing 'text' field" });
      return;
    }
    let llm;
    try {
      llm = await getLLMManager();
      const sessionId = await getOrStartSession();
      const { response, elapsed } = await handleChatTurn({ sessionId, message, llm, config });
      const model = llm.getCurrentProvider().getModelName(config, "ask");
      json(res, 200, {
        data: response,
        perf: { llm_ms: elapsed, total_ms: performance.now() - startTime, model },
      });
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      const status = isRateLimitError(error) ? 429 : 500;
      json(res, status, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });

  register("POST", "/chat/reset", async (req, res) => {
    try {
      const sessionId = await getOrStartSession();
      resetChat(sessionId);
      json(res, 200, { ok: true });
    } catch (error) {
      json(res, 500, { error: error.message });
    }
  });
}
