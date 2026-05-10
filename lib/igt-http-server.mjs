/**
 * IGT HTTP Server - Persistent background service
 * Eliminates Node.js startup overhead by staying resident
 * Communicates via HTTP JSON API
 */

import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { performance } from "perf_hooks";
import configLoader from "./config-loader.mjs";
import { parseDiagnosis as parseDiagnosisCore, GRAMMAR_RESPONSE_SCHEMA } from "./parse-diagnosis.mjs";
import * as errorTypes from "./error-types.mjs";
import { runMigrations } from "./migrations.mjs";
import { grade as gradeCard, QUALITY_CORRECT, QUALITY_WRONG } from "./srs.mjs";
import { getDb } from "./db/connection.mjs";
import { getOrStartSession, insertInput, getLastN, undoLastN, resetSessionState, getCurrentSessionId, getSessionSummary } from "./db/inputs.mjs";
import { insertDiagnoses, insertAdvice } from "./db/diagnoses.mjs";
import { getDueCards, getCardById, updateAfterGrading, deleteCard, insertGrammarCard, insertVocabCard, vocabCardExistsForWord, deleteLegacyVocabCards } from "./db/srs-cards.mjs";
import { getStats } from "./db/stats.mjs";
import { getRandomMessage } from "./db/status-messages.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.IGT_SERVER_PORT || "18964", 10);
const HOST = process.env.IGT_SERVER_HOST || "127.0.0.1";

const config = configLoader.load();
const projectRoot = path.join(__dirname, "..");

let llmManager = null;
let systemPrompt = null;

async function getLLMManager() {
  if (!llmManager) {
    const initializeLLMProviders = (await import("./llm-init.mjs")).default;
    llmManager = initializeLLMProviders();
    validateActiveProviderKeys(llmManager);
  }
  return llmManager;
}

function validateActiveProviderKeys(manager) {
  const provider = (manager.getCurrentProviderName() || "").toLowerCase();
  const map = {
    gemini:   { keys: "GeminiApiKeys",   env: "GOOGLE_API_KEYS" },
    qwen:     { keys: "QwenApiKeys",     env: "DASHSCOPE_API_KEYS" },
    deepseek: { keys: "DeepseekApiKeys", env: "DEEPSEEK_API_KEYS" },
  };
  const entry = map[provider];
  if (!entry) return;
  const keys = config[entry.keys];
  if (!Array.isArray(keys) || keys.length === 0) {
    process.stderr.write(`Error: No API keys configured for "${provider}". Add ${entry.env} to .env\n`);
    process.exit(1);
  }
}

function getSystemPrompt() {
  if (!systemPrompt) {
    if (config.Prompts && config.Prompts.SystemPrompt) {
      systemPrompt = config.Prompts.SystemPrompt;
    } else {
      let systemPromptPath = config.SystemPromptPath || "system_prompt.txt";
      if (!path.isAbsolute(systemPromptPath)) {
        systemPromptPath = path.join(__dirname, systemPromptPath);
      }
      systemPrompt = fs.readFileSync(systemPromptPath, "utf8");
    }
  }
  return systemPrompt;
}

function isRateLimitError(err) {
  const msg = (err?.message || "").toLowerCase();
  return err?.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/.test(msg);
}

function parseDiagnosis(output) {
  const logPath = path.isAbsolute(config.LogPath || "")
    ? config.LogPath
    : path.join(projectRoot, config.LogPath || "igt_db_error.log");
  return parseDiagnosisCore(output, errorTypes, { logPath });
}

async function saveToDatabase(userInput, parsed) {
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
    try {
      fs.appendFileSync(resolvedLogPath, `${new Date().toISOString()} ${error.stack || error.message}\n`);
    } catch (logErr) {
      console.error("[IGT-SERVER] DB error (and log write failed):", error.message, logErr.message);
    }
  }
}

// Request handler
const server = http.createServer(async (req, res) => {
  const startTime = performance.now();

  req.setTimeout(0);
  res.setTimeout(0);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  // SRS — list cards due today
  if (req.method === "GET" && req.url.startsWith("/review/due")) {
    try {
      const urlParams = new URL(req.url, "http://x").searchParams;
      const limit = parseInt(urlParams.get("limit") ?? "10", 10) || 10;
      const typeFilter = urlParams.get("type") || "all";
      const cards = await getDueCards({ limit, type: typeFilter });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ cards }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // SRS — grade a card
  if (req.method === "POST" && req.url === "/review/grade") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      try {
        const { card_id, response, correct: correctOverride } = JSON.parse(body || "{}");
        const card = await getCardById(card_id);
        if (!card) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "card not found" }));
          return;
        }
        let correct, judgement;
        if (typeof correctOverride === "boolean") {
          correct = correctOverride;
          judgement = "self-report";
        } else {
          const norm = (s) => (s || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,!?;:'"()\-]/g, "");
          const exactMatch = norm(response) === norm(card.answer);
          correct = exactMatch;
          judgement = exactMatch ? "exact" : null;
          if (!exactMatch) {
            const llm = await getLLMManager();
            const prompt = `Card prompt: ${card.prompt}\nExpected answer: ${card.answer}\nUser answer: ${response}\n\nIs the user's answer semantically equivalent to the expected answer for this English-grammar flashcard? Reply with exactly "YES" or "NO" followed by one short reason.`;
            try {
              const text = await llm.generateWithFallback(prompt, "You are an English grammar grader.", { taskType: "grammar" });
              correct = /^\s*yes\b/i.test(text);
              judgement = text.trim().slice(0, 200);
            } catch {
              judgement = "llm-unavailable";
              correct = false;
            }
          }
        }
        const next = gradeCard({
          ease: card.ease, intervalDays: card.interval_days,
          totalReviews: card.total_reviews, correctStreak: card.correct_streak,
        }, correct ? QUALITY_CORRECT : QUALITY_WRONG);
        await updateAfterGrading(card.id, next);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ correct, judgement, next: { intervalDays: next.intervalDays, dueDate: next.dueDate, ease: next.ease } }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // SRS — permanently delete a card
  if (req.method === "POST" && req.url === "/review/delete") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      try {
        const { card_id } = JSON.parse(body || "{}");
        const changes = await deleteCard(card_id);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ deleted: changes > 0 }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Vocab — seed SRS cards for all words in the markdown vault that lack cards
  if (req.method === "POST" && req.url === "/vocab/seed") {
    try {
      const vocabFile = config.VocabFile || "IGT Vocabulary.md";
      const baseDir = config.VaultDir
        ? (path.isAbsolute(config.VaultDir) ? config.VaultDir : path.join(projectRoot, config.VaultDir))
        : path.join(projectRoot, "docs");
      const noteFile = path.isAbsolute(vocabFile) ? vocabFile : path.join(baseDir, vocabFile);

      if (!fs.existsSync(noteFile)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ seeded: 0 }));
        return;
      }

      const content = fs.readFileSync(noteFile, "utf8");
      const lines = content.split("\n");
      const entries = [];
      let li = 0;
      while (li < lines.length) {
        const hm = lines[li].match(/^###?\s+(.+)/);
        if (hm) {
          const block = [lines[li++]];
          while (li < lines.length && !/^###?\s+/.test(lines[li])) block.push(lines[li++]);
          const raw = block.join("\n");
          const get = (k) => { const m = raw.match(new RegExp(`\\*\\*${k}:\\*\\*\\s*(.+)`)); return m ? m[1].trim() : ""; };
          const wm = raw.match(/^###?\s*(.+)/m);
          if (wm) entries.push({ word: wm[1].trim(), pos: get("PoS"), zh: get("中文"), meaning: get("Meaning"), example: get("Example"), note: get("Note") });
        } else {
          li++;
        }
      }

      await deleteLegacyVocabCards();
      const mkPrompt = (e) => ["VOCAB", e.word, e.pos, e.zh, e.meaning, e.example, e.note].join("|||");
      let seeded = 0;
      for (const e of entries) {
        if (!e.word || !e.zh) continue;
        const exists = await vocabCardExistsForWord(e.word);
        if (!exists) {
          await insertVocabCard(mkPrompt(e), e.word);
          seeded++;
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ seeded }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Analytics dashboard data
  if (req.method === "GET" && req.url === "/stats") {
    try {
      const stats = await getStats();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(stats));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Session summary for end-of-session display
  if (req.method === "GET" && req.url === "/session/summary") {
    try {
      const sid = getCurrentSessionId();
      if (!sid) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ no_session: true }));
        return;
      }
      const summary = await getSessionSummary(sid);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(summary));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Last N inputs (preview for /undo confirmation)
  if (req.method === "GET" && req.url.startsWith("/inputs/last")) {
    try {
      const n = parseInt(new URL(req.url, "http://x").searchParams.get("n") || "1", 10);
      const rows = await getLastN(n);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ rows }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Hard-delete the last N inputs and cascade
  if (req.method === "POST" && req.url === "/undo") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      try {
        const { n = 1 } = JSON.parse(body || "{}");
        const count = Math.max(1, Math.min(parseInt(n, 10) || 1, 50));
        const result = await undoLastN(count);
        if (result.deleted_inputs > 0) resetSessionState();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Get a random status message
  if (req.method === "GET" && req.url === "/status-message") {
    try {
      const row = await getRandomMessage();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(row));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      uptime: process.uptime(),
      memory: process.memoryUsage().heapUsed / 1024 / 1024
    }));
    return;
  }

  // Provider switch
  if (req.method === "POST" && req.url === "/switch") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      try {
        const { provider } = JSON.parse(body || "{}");
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
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Model switch
  if (req.method === "POST" && req.url === "/switch-model") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      try {
        const { provider, model } = JSON.parse(body || "{}");
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
          config.OllamaModel = model;
          updates.IGT_OLLAMA_MODEL = model;
        }
        configLoader.updateEnv(updates);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ provider: newProvider, model: newProvider === "ollama" ? model : undefined }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Grammar check
  if (req.method === "POST" && req.url === "/grammar") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON in request body" }));
        return;
      }
      try {
        const userInput = (payload.text || payload.input || "").trim();
        if (!userInput) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'text' or 'input' field" }));
          return;
        }
        await nonStreamingResponse(res, await getLLMManager(), userInput, getSystemPrompt(), startTime);
      } catch (error) {
        const providerName = llmManager ? llmManager.getCurrentProviderName() : "unknown";
        const status = isRateLimitError(error) ? 429 : 500;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `${providerName.toUpperCase()} Error: ${error.message}` }));
      }
    });
    return;
  }

  // Unknown endpoint
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Use POST /grammar" }));
});

async function nonStreamingResponse(res, llm, userInput, sysPrompt, startTime) {
  const provider = llm.getCurrentProviderName();
  const options = { taskType: "grammar" };
  if (provider === "gemini") {
    options.responseSchema = GRAMMAR_RESPONSE_SCHEMA;
  } else {
    options.responseFormat = { type: "json_object" };
  }

  const text = await llm.generateWithFallback(userInput, sysPrompt, options);
  const elapsed = performance.now() - startTime;
  const parsed = parseDiagnosis(text);
  await saveToDatabase(userInput, parsed);

  res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify({
    data: parsed,
    perf: { llm_ms: elapsed, total_ms: performance.now() - startTime }
  }));
}

async function ensureMigrations() {
  const db = await getDb();
  const ran = await runMigrations(db, path.join(projectRoot, "migrations"), {
    logger: (msg) => console.error(`[IGT-SERVER] ${msg}`),
  });
  if (ran.length > 0) console.error(`[IGT-SERVER] Applied ${ran.length} migration(s).`);
}

await ensureMigrations();

server.listen(PORT, HOST, () => {
  const provider = config.LLMProvider || "gemini";
  const modelMap = {
    gemini: config.GeminiFlashModel || "gemini-2.5-flash",
    qwen: config.QwenFlashModel || "qwen3.5-flash",
    deepseek: config.DeepseekFlashModel || "deepseek-chat"
  };
  const grammarModel = modelMap[provider] || "unknown";
  console.error(`[IGT-SERVER] Ready on http://${HOST}:${PORT}`);
  console.error(`[IGT-SERVER] PID: ${process.pid}`);
  console.error(`[IGT-SERVER] Provider: ${provider} | Model: ${grammarModel}`);
});

process.on("SIGINT", () => {
  console.error("[IGT-SERVER] Shutting down...");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.error("[IGT-SERVER] Shutting down...");
  server.close(() => process.exit(0));
});

process.on("uncaughtException", (error) => {
  console.error("[IGT-SERVER] Uncaught exception:", error.message);
});
