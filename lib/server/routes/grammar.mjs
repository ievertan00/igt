import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import { parseDiagnosis as parseDiagnosisCore, GRAMMAR_RESPONSE_SCHEMA } from "../../domain/parse-diagnosis.mjs";
import * as errorTypes from "../../domain/error-types.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { getOrStartSession, insertInput } from "../../db/inputs.mjs";
import { insertDiagnoses, insertAdvice } from "../../db/diagnoses.mjs";
import { insertGrammarCard } from "../../db/srs-cards.mjs";

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

async function saveToDatabase(userInput, parsed, config) {
  const logPath = config.LogPath || "igt_db_error.log";
  const resolvedLogPath = path.isAbsolute(logPath) ? logPath : path.join(projectRoot, logPath);
  try {
    if (!parsed.correction && parsed.diagnoses.length === 0 && !parsed.review) {
      fs.appendFileSync(resolvedLogPath,
        `${new Date().toISOString()} WARN: empty parsed payload for: "${userInput.slice(0, 80)}"\n`);
      return;
    }
    const sessionId = await getOrStartSession();
    const inputId = await insertInput(sessionId, userInput, parsed.correction, parsed.refine);
    if (parsed.diagnoses.length > 0) {
      await insertDiagnoses(inputId, parsed.diagnoses);
      if (parsed.correction && userInput.trim() !== parsed.correction.trim()) {
        await insertGrammarCard(inputId, userInput.trim(), parsed.correction.trim());
      }
    }
    await insertAdvice(inputId, parsed.rule, parsed.tip);
  } catch (error) {
    try { fs.appendFileSync(resolvedLogPath, `${new Date().toISOString()} ${error.stack || error.message}\n`); }
    catch {}
  }
}

export function registerGrammarRoutes({ getLLMManager }) {
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
      const provider = llm.getCurrentProviderName();
      const options = { taskType: "grammar" };
      if (provider === "gemini") options.responseSchema = GRAMMAR_RESPONSE_SCHEMA;
      else options.responseFormat = { type: "json_object" };
      const text = await llm.generateWithFallback(userInput, getSystemPrompt(config), options);
      const elapsed = performance.now() - startTime;
      const parsed = parseDiagnosis(text, config);
      await saveToDatabase(userInput, parsed, config);
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ data: parsed, perf: { llm_ms: elapsed, total_ms: performance.now() - startTime } }));
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      const status = isRateLimitError(error) ? 429 : 500;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `${provider.toUpperCase()} Error: ${error.message}` }));
    }
  });
}
