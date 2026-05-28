import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { getOrStartSession } from "../../db/inputs.mjs";
import { handleAskTurn } from "../../features/ask/handler.mjs";
import { saveSession } from "../../features/ask/save-handler.mjs";
import * as history from "../../features/ask/history.mjs";

function isRateLimitError(err) {
  const msg = (err?.message || "").toLowerCase();
  return err?.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/.test(msg);
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(payload));
}

export function registerAskRoutes({ getLLMManager, config }) {
  register("POST", "/ask", async (req, res, { body }) => {
    const startTime = performance.now();
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
      const sessionId = await getOrStartSession();
      const { response, elapsed, llmPerf } = await handleAskTurn({ sessionId, question, llm, config });
      const model = llm.getCurrentProvider().getModelName(config, "handbook");
      json(res, 200, {
        data: response,
        perf: {
          llm_ms: elapsed,
          total_ms: performance.now() - startTime,
          model,
          ...(llmPerf ? { tool_ms: llmPerf.toolMs, answer_ms: llmPerf.answerMs, call_count: llmPerf.callCount } : {}),
        },
      });
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      const status = isRateLimitError(error) ? 429 : 500;
      json(res, status, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });

  register("POST", "/ask/save", async (req, res) => {
    req.setTimeout(0);
    res.setTimeout(0);
    let llm;
    try {
      llm = await getLLMManager();
      const sessionId = await getOrStartSession();
      const result = await saveSession({ sessionId, llm, config });
      json(res, 200, result);
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      const status = isRateLimitError(error) ? 429 : 500;
      json(res, status, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });

  register("POST", "/ask/reset", async (req, res) => {
    try {
      const sessionId = await getOrStartSession();
      history.reset(sessionId);
      json(res, 200, { ok: true });
    } catch (error) {
      json(res, 500, { error: error.message });
    }
  });
}
