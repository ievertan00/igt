import { validateAskLanguage } from "../../features/ask/language.mjs";
import { register } from "../router.mjs";
import { getOrStartSession } from "../../db/inputs.mjs";
import { askTurn, saveAsk } from "../../application/ask.mjs";
import * as history from "../../features/ask/history.mjs";
import { errorPayload } from "../../contracts/errors.mjs";
import { listAskNotes, readAskNote, deleteAskNote } from "../../application/ask-notes.mjs";

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
  register("POST", "/ask/notes/delete", async (req, res, { body }) => {
    try {
      json(res, 200, deleteAskNote(body?.id, config));
    } catch (error) {
      const status = error.status === 400 ? 400 : 503;
      json(res, status, errorPayload(error.code || "ASK_NOTES_ERROR", error.message, status === 503));
    }
  });

  register("GET", "/ask/notes", async (req, res) => {
    try {
      const result = listAskNotes(config);
      json(res, 200, result);
    } catch (error) {
      const status = [400, 404, 413].includes(error.status) ? error.status : 503;
      json(res, status, errorPayload(error.code || "ASK_NOTES_ERROR", status === 503 ? "Ask notes could not be listed." : error.message, status === 503));
    }
  });

  register("GET", "/ask/notes/read", async (req, res) => {
    try {
      const id = new URL(req.url, "http://127.0.0.1").searchParams.get("id");
      json(res, 200, readAskNote(id, config));
    } catch (error) {
      const status = [400, 404, 413].includes(error.status) ? error.status : 503;
      json(res, status, errorPayload(error.code || "ASK_NOTES_ERROR", status === 503 ? "This Ask note could not be read." : error.message, status === 503));
    }
  });

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
      validateAskLanguage(body?.language);
      llm = await getLLMManager();
      const result = await askTurn({
        sessionId: Array.isArray(body?.messages) ? undefined : (history.getActiveSessionId() ?? await getOrStartSession()),
        messages: body?.messages,
        question,
        llm,
        config: llm.config || config,
        language: body?.language,
      });
      json(res, 200, result.response);
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      const status = error.status || (isRateLimitError(error) ? 429 : 500);
      json(res, status, { error: `${provider.toUpperCase()} Error: ${error.message}` });
    }
  });

  register("POST", "/ask/save", async (req, res, { body }) => {
    req.setTimeout(0);
    res.setTimeout(0);
    if (Object.hasOwn(body || {}, "messages") && !Array.isArray(body.messages)) {
      json(res, 400, errorPayload("INVALID_REQUEST", "messages must be an array of answered questions."));
      return;
    }
    let llm;
    try {
      validateAskLanguage(body?.language);
      const result = await saveAsk({
        sessionId: Array.isArray(body?.messages) ? undefined : (history.getActiveSessionId() ?? await getOrStartSession()),
        messages: body?.messages,
        llm,
        getLLMManager,
        config,
        language: body?.language,
      });
      json(res, 200, result);
    } catch (error) {
      const status = error.status || (isRateLimitError(error) ? 429 : 500);
      json(res, status, errorPayload(error.code || "ASK_SAVE_FAILED", error.message, status >= 500));
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
