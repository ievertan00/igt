import { register } from "../router.mjs";
import { getOrStartSession } from "../../db/inputs.mjs";
import { askTurn, saveAsk } from "../../application/ask.mjs";
import * as history from "../../features/ask/history.mjs";
import { errorPayload } from "../../contracts/errors.mjs";

function isRateLimitError(err) {
  const msg = (err?.message || "").toLowerCase();
  return err?.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/.test(msg);
}

function json(res, status, payload) {
  if (typeof payload?.error === "string") payload = { ...payload, ...errorPayload(status >= 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST", payload.error, status >= 500) };
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
}

export function registerAskRoutes({ getLLMManager, config }) {
  register("POST", "/ask", async (req, res, { body }) => {
    req.setTimeout(0);
    res.setTimeout(0);
    const question = (body?.text || body?.question || "").trim();
    if (!question) {
      json(res, 400, { error: "Missing 'text' or 'question' field" });
      return;
    }
    let llm;
    try {
      llm = await getLLMManager();
      const result = await askTurn({
        sessionId: Array.isArray(body?.messages) ? undefined : (history.getActiveSessionId() ?? await getOrStartSession()),
        messages: body?.messages,
        question,
        llm,
        config,
      });
      json(res, 200, result.response);
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      const status = isRateLimitError(error) ? 429 : 500;
      json(res, status, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });

  register("POST", "/ask/save", async (req, res, { body }) => {
    req.setTimeout(0);
    res.setTimeout(0);
    let llm;
    try {
      llm = await getLLMManager();
      const result = await saveAsk({
        sessionId: Array.isArray(body?.messages) ? undefined : (history.getActiveSessionId() ?? await getOrStartSession()),
        messages: body?.messages,
        llm,
        config,
      });
      json(res, 200, result);
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      const status = isRateLimitError(error) ? 429 : 500;
      json(res, status, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });

  register("POST", "/ask/reset", async (req, res) => {
    try {
      const sessionId = history.getActiveSessionId() ?? await getOrStartSession();
      history.reset(sessionId);
      json(res, 200, { ok: true });
    } catch (error) {
      json(res, 500, { error: error.message });
    }
  });
}
