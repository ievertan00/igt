import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { parseDiagnosis as parseDiagnosisCore, GRAMMAR_RESPONSE_SCHEMA } from "../../domain/parse-diagnosis.mjs";
import * as errorTypes from "../../domain/error-types.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { appendReviewLog } from "../../db/review-log.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..", "..");

function getSystemPrompt(config) {
  const prompts = config.Prompts;
  if (prompts && prompts.SystemPrompt) return prompts.SystemPrompt;
  let p = config.SystemPromptPath || "system_prompt.txt";
  if (!path.isAbsolute(p)) p = path.join(projectRoot, p);
  return fs.readFileSync(p, "utf8");
}

function isRateLimitError(err) {
  const msg = (err?.message || "").toLowerCase();
  return err?.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/.test(msg);
}

function parseDiagnosis(output, config) {
  const logPath = path.isAbsolute(config.LogPath || "")
    ? config.LogPath
    : path.join(projectRoot, config.LogPath || "igt_db_error.log");
  return parseDiagnosisCore(output, errorTypes, { logPath });
}

function saveToReviewLog(userInput, parsed, config) {
  const reviewPath = config.ReviewPath || "00_Review_logs.md";
  const resolvedPath = path.isAbsolute(reviewPath) ? reviewPath : path.join(projectRoot, reviewPath);
  const saved = appendReviewLog(resolvedPath, {
    originalText: userInput,
    data: parsed,
  });
  return { saved: true, path: saved.path, entryId: saved.entryId };
}

export function registerGrammarRoutes({ getLLMManager }) {
  register("POST", "/grammar/save", async (req, res, { body }) => {
    const userInput = (body?.text || body?.input || "").trim();
    const data = body?.data;
    if (!userInput || !data || typeof data !== "object") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'text' and 'data' fields" }));
      return;
    }
    try {
      const config = configLoader.load();
      const persistence = saveToReviewLog(userInput, data, config);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ persistence }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        error: `Review log not saved: ${error.message}`,
        code: "REVIEW_LOG_NOT_SAVED",
      }));
    }
  });

  register("POST", "/grammar", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const userInput = (body?.text || body?.input || "").trim();
    if (!userInput) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'text' or 'input' field" }));
      return;
    }
    let llm;
    try {
      const config = configLoader.load();
      llm = await getLLMManager();
      const options = { taskType: "grammar", jsonSchema: GRAMMAR_RESPONSE_SCHEMA };
      const text = await llm.generateWithFallback(userInput, getSystemPrompt(config), options);
      const elapsed = performance.now() - startTime;
      const parsed = parseDiagnosis(text, config);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({
        data: parsed,
        persistence: { saved: false, requiresConfirmation: true },
        perf: { llm_ms: elapsed, total_ms: performance.now() - startTime },
      }));
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      const status = isRateLimitError(error) ? 429 : 500;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `${provider.toUpperCase()} Error: ${error.message}` }));
    }
  });
}
