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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = parseInt(process.env.IGT_SERVER_PORT || "18964", 10);
const HOST = process.env.IGT_SERVER_HOST || "127.0.0.1";

// Load config once
const configPath = path.join(__dirname, "igt_config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Initialize LLM providers lazily
let llmManager = null;
let systemPrompt = null;

async function getLLMManager() {
  if (!llmManager) {
    const initializeLLMProviders = (await import("./llm-init.mjs")).default;
    llmManager = initializeLLMProviders();
  }
  return llmManager;
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

// Database functions (lazy loaded)
let dbFunctions = null;

async function getDbFunctions() {
  if (!dbFunctions) {
    const mod = await import("./error-types.mjs");
    dbFunctions = mod;
  }
  return dbFunctions;
}

let Database = null;

async function getDatabase() {
  if (!Database) {
    Database = (await import("better-sqlite3")).default;
  }
  return Database;
}

function isRateLimitError(err) {
  const msg = (err?.message || "").toLowerCase();
  return err?.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/.test(msg);
}

// Parse diagnosis from LLM output (supports JSON format and legacy fallback)
function parseDiagnosis(output, errorTypes) {
  const result = {
    diagnoses: [],
    advice: { rule: null, tip: null },
    raw: null
  };

  // Try parsing entire output as JSON (new format)
  try {
    const cleaned = output.replace(/^```json\s*|\s*```$/g, "").trim();
    const data = JSON.parse(cleaned);
    
    result.raw = data;
    if (data.diagnoses && Array.isArray(data.diagnoses)) {
      for (const d of data.diagnoses) {
        const rawType = (d.type || d.error_type || "").trim();
        const classifiedType = errorTypes.classifyErrorType(rawType);
        result.diagnoses.push({
          error_type: errorTypes.getErrorTypePath(classifiedType),
          severity: d.severity || "Minor",
          explanation: d.explanation || ""
        });
      }
    }
    result.advice.rule = Array.isArray(data.rule) ? data.rule.join("\n") : (data.rule || null);
    result.advice.tip = Array.isArray(data.tip) ? data.tip.join("\n") : (data.tip || null);
    return result;
  } catch (e) {
    // Not a pure JSON response, try searching for JSON block
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        const data = JSON.parse(jsonMatch[1]);
        result.raw = data;
        if (data.diagnoses && Array.isArray(data.diagnoses)) {
          for (const d of data.diagnoses) {
            const rawType = (d.type || d.error_type || "").trim();
            const classifiedType = errorTypes.classifyErrorType(rawType);
            result.diagnoses.push({
              error_type: errorTypes.getErrorTypePath(classifiedType),
              severity: d.severity || "Minor",
              explanation: d.explanation || ""
            });
          }
        }
        result.advice.rule = Array.isArray(data.rule) ? data.rule.join("\n") : (data.rule || null);
        result.advice.tip = Array.isArray(data.tip) ? data.tip.join("\n") : (data.tip || null);
        return result;
      } catch (e2) {}
    }
  }

  // Fallback: parse legacy markdown format
  const diagMatch = output.match(/\*\*Diagnosis\*\*[^:]*:\s*([\s\S]*?)(?=\*\*Rule\*\*|\*\*Tip\*\*|\n\n\*\*|$)/i);
  if (diagMatch) {
    const items = diagMatch[1].match(/[-*]\s*(.+?)\s*\((Minor|Moderate|Major)\)\s*[:：]\s*(.*)/gi) || [];
    for (const item of items) {
      const m = item.match(/[-*]\s*(.+?)\s*\((Minor|Moderate|Major)\)\s*[:：]\s*(.*)/i);
      if (m) {
        const rawType = m[1].trim().replace(/^[-*]+\s*/, "");
        const classifiedType = errorTypes.classifyErrorType(rawType);
        result.diagnoses.push({
          error_type: errorTypes.getErrorTypePath(classifiedType),
          severity: m[2].trim(),
          explanation: m[3].trim()
        });
      }
    }
  }

  const ruleMatch = output.match(/\*\*Rule\*\*[^:]*:\s*([\s\S]*?)(?=\*\*Tip\*\*|\n\n\*\*|$)/i);
  if (ruleMatch) result.advice.rule = ruleMatch[1].trim();

  const tipMatch = output.match(/\*\*Tip\*\*[^:]*:\s*([\s\S]*?)(?=\n\n\*\*|$)/i);
  if (tipMatch) result.advice.tip = tipMatch[1].trim();

  return result;
}

// Helper to strip unwanted characters from the start and end of strings
function cleanString(s) {
  if (!s) return "";
  // Remove wrapping brackets, single quotes, and double quotes
  return s.trim().replace(/^[[{("'\s]+|[\]})"'\s]+$/g, "").trim();
}

// Format the final display string based on rules
function formatDisplayContent(data) {
  const sections = [];

  if (data.review) {
    sections.push(`**Review**\n${cleanString(data.review)}`);
  }

  if (data.correction) {
    sections.push(`**Correction**\n${cleanString(data.correction)}`);
  }

  if (data.refine) {
    sections.push(`**Refine**\n${cleanString(data.refine)}`);
  }

  if (data.diagnoses && data.diagnoses.length > 0) {
    const lines = data.diagnoses.map(d => {
      const type = cleanString(d.type || d.error_type || "Error");
      const severity = cleanString(d.severity || "Minor");
      const explanation = cleanString(d.explanation);
      return `- ${type} (${severity}): ${explanation}`;
    });
    sections.push(`**Diagnosis**\n${lines.join("\n")}`);
  }

  if (data.rule) {
    const items = Array.isArray(data.rule) ? data.rule : data.rule.split("\n");
    const lines = items.filter(r => r.trim()).map(r => `- ${cleanString(r)}`);
    if (lines.length > 0) {
      sections.push(`**Rule**\n${lines.join("\n")}`);
    }
  }

  if (data.tip) {
    const items = Array.isArray(data.tip) ? data.tip : data.tip.split("\n");
    const lines = items.filter(t => t.trim()).map(t => `- ${cleanString(t)}`);
    if (lines.length > 0) {
      sections.push(`**Tip**\n${lines.join("\n")}`);
    }
  }

  return sections.join("\n\n");
}

// Word-level diff for same-length texts (used for correction-based vocab)
function diffWords(original, corrected) {
  const origTokens = original.split(/\s+/);
  const corrTokens = corrected.split(/\s+/);
  if (origTokens.length !== corrTokens.length) return null;

  const strip = s => s.replace(/^[.,!?;:'"()\-]+|[.,!?;:'"()\-]+$/g, "");
  const changes = [];
  for (let i = 0; i < origTokens.length; i++) {
    const a = strip(origTokens[i]).toLowerCase();
    const b = strip(corrTokens[i]).toLowerCase();
    if (a !== b && a.length > 0 && b.length > 0) {
      changes.push({ original: strip(origTokens[i]), better: strip(corrTokens[i]) });
    }
  }
  if (changes.length === 0 || changes.length > 2) return null;
  return changes[0];
}

// LCS-based phrase diff for Refine section — handles different word counts
function diffPhrases(original, corrected) {
  const strip = s => s.replace(/^[.,!?;:'"()\-]+|[.,!?;:'"()\-]+$/g, "");
  const ow = original.split(/\s+/);
  const cw = corrected.split(/\s+/);
  const m = ow.length, n = cw.length;

  // Build LCS table
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = strip(ow[i-1]).toLowerCase() === strip(cw[j-1]).toLowerCase()
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
    }
  }

  // Traceback: collect substitution chunks separated by common words
  const pairs = [];
  let i = m, j = n, delBuf = [], addBuf = [];

  const flush = () => {
    if (delBuf.length > 0 && addBuf.length > 0 && delBuf.length <= 3 && addBuf.length <= 3) {
      pairs.push({
        original: delBuf.reverse().map(strip).join(" "),
        better:   addBuf.reverse().map(strip).join(" ")
      });
    }
    delBuf = []; addBuf = [];
  };

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && strip(ow[i-1]).toLowerCase() === strip(cw[j-1]).toLowerCase()) {
      flush();
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      addBuf.push(cw[j-1]);
      j--;
    } else {
      delBuf.push(ow[i-1]);
      i--;
    }
  }
  flush();

  return pairs;
}

// Extract Correction and Refine sections
function extractSections(output) {
  const cleanPart = output.split('```')[0];
  const correctionMatch = cleanPart.match(/\*\*Correction\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  const refineMatch = cleanPart.match(/\*\*Refine\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);

  return {
    correction: correctionMatch ? correctionMatch[1].trim() : null,
    refine: refineMatch ? refineMatch[1].trim() : null
  };
}

// Save to database (non-blocking)
async function saveToDatabase(userInput, output) {
  try {
    const dbPath = config.DbPath || "igt_data.db";
    const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, dbPath);
    const DbClass = await getDatabase();
    const errorTypes = await getDbFunctions();

    const dbExists = fs.existsSync(resolvedDbPath);
    const db = new DbClass(resolvedDbPath);

    db.pragma("journal_mode = WAL");

    if (!dbExists) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          end_time TIMESTAMP,
          total_inputs INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS inputs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          original_text TEXT NOT NULL,
          correction TEXT,
          refine TEXT,
          FOREIGN KEY (session_id) REFERENCES sessions(id)
        );
        CREATE TABLE IF NOT EXISTS diagnoses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          input_id INTEGER,
          error_type TEXT NOT NULL,
          severity TEXT,
          explanation TEXT,
          FOREIGN KEY (input_id) REFERENCES inputs(id)
        );
        CREATE TABLE IF NOT EXISTS advice (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          input_id INTEGER,
          rule TEXT,
          tip TEXT,
          FOREIGN KEY (input_id) REFERENCES inputs(id)
        );
        CREATE INDEX IF NOT EXISTS idx_inputs_timestamp ON inputs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_diagnoses_input_id ON diagnoses(input_id);
        CREATE INDEX IF NOT EXISTS idx_diagnoses_error_type ON diagnoses(error_type);
        CREATE INDEX IF NOT EXISTS idx_advice_input_id ON advice(input_id);
      `);
    }

    // Migration-safe: ensure vocab table exists for both new and existing DBs
    db.exec(`
      CREATE TABLE IF NOT EXISTS vocab (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        input_id INTEGER,
        original_word TEXT NOT NULL,
        better_word TEXT NOT NULL,
        context TEXT,
        explanation TEXT,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        quiz_count INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        FOREIGN KEY (input_id) REFERENCES inputs(id)
      );
      CREATE INDEX IF NOT EXISTS idx_vocab_quiz ON vocab(quiz_count, correct_count);
    `);

    const parsed = parseDiagnosis(output, errorTypes);
    const sections = extractSections(output);

    const insertInput = db.prepare(`
      INSERT INTO inputs (session_id, original_text, correction, refine)
      VALUES (NULL, ?, ?, ?)
    `);
    const inputResult = insertInput.run(userInput, sections.correction, sections.refine);
    const inputId = inputResult.lastInsertRowid;

    if (parsed.diagnoses.length > 0) {
      const insertDiagnosis = db.prepare(`
        INSERT INTO diagnoses (input_id, error_type, severity, explanation)
        VALUES (?, ?, ?, ?)
      `);
      const insertMany = db.transaction((diagnoses) => {
        for (const d of diagnoses) {
          insertDiagnosis.run(inputId, d.error_type, d.severity, d.explanation);
        }
      });
      insertMany(parsed.diagnoses);
    }

    if (parsed.advice.rule || parsed.advice.tip) {
      const insertAdvice = db.prepare(`
        INSERT INTO advice (input_id, rule, tip)
        VALUES (?, ?, ?)
      `);
      insertAdvice.run(inputId, parsed.advice.rule, parsed.advice.tip);
    }

    const insertVocab = db.prepare(`
      INSERT INTO vocab (input_id, original_word, better_word, context, explanation)
      VALUES (?, ?, ?, ?, ?)
    `);
    const vocabExists = db.prepare(`SELECT 1 FROM vocab WHERE input_id = ? AND original_word = ? LIMIT 1`);

    // Extract vocab from Word Choice / Idiomatic Expression diagnoses (correction-based)
    const vocabTypes = ["Word Choice", "Idiomatic Expression"];
    const vocabDiagnoses = parsed.diagnoses.filter(d =>
      vocabTypes.some(t => d.error_type.includes(t))
    );
    if (vocabDiagnoses.length > 0 && sections.correction && userInput.trim() !== sections.correction.trim()) {
      const pair = diffWords(userInput.trim(), sections.correction.trim());
      if (pair) {
        const explanation = vocabDiagnoses.map(d => d.explanation).filter(Boolean).join("; ");
        insertVocab.run(inputId, pair.original, pair.better, userInput.trim(), explanation || null);
      }
    }

    // Also extract vocab from Refine section (stylistic improvements, no diagnosis needed)
    if (sections.refine && userInput.trim() !== sections.refine.trim()) {
      const refinePairs = diffPhrases(userInput.trim(), sections.refine.trim());
      for (const pair of refinePairs) {
        if (!vocabExists.get(inputId, pair.original)) {
          insertVocab.run(inputId, pair.original, pair.better, userInput.trim(), "Stylistic improvement");
        }
      }
    }

    db.close();
  } catch (error) {
    try {
      fs.appendFileSync(path.join(__dirname, "../igt_db_error.log"), `${new Date().toISOString()} ${error.stack || error.message}\n`);
    } catch {}
  }
}

// Request handler
const server = http.createServer(async (req, res) => {
  const startTime = performance.now();
  
  // Set no timeout for long-running requests
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

  // Grammar check (streaming)
  if (req.method === "POST" && req.url === "/grammar/stream") {
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

        const llm = await getLLMManager();
        const prompt = getSystemPrompt();

        // For Gemini, use streaming
        const provider = llm.getCurrentProvider();
        if (provider && provider.name === "gemini") {
          await streamGeminiResponse(res, userInput, prompt, llm, startTime);
        } else {
          // Fallback: non-streaming for other providers
          await nonStreamingResponse(res, llm, userInput, prompt, startTime);
        }
      } catch (error) {
        const providerName = llmManager ? llmManager.getCurrentProviderName() : "unknown";
        if (!res.headersSent) {
          const status = isRateLimitError(error) ? 429 : 500;
          res.writeHead(status, { "Content-Type": "application/json" });
        }
        res.end(JSON.stringify({
          error: `${providerName.toUpperCase()} Error: ${error.message}`
        }));
      }
    });
    return;
  }

  // Grammar check (non-streaming, backward compatible)
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
        res.end(JSON.stringify({
          error: `${providerName.toUpperCase()} Error: ${error.message}`
        }));
      }
    });
    return;
  }

  // Unknown endpoint
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found. Use POST /grammar or POST /grammar/stream" }));
});

// Streaming response for Gemini
async function streamGeminiResponse(res, userInput, systemPrompt, llm, startTime) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const config = llm.config;
  
  // Get API key
  const keys = [];
  if (process.env.GOOGLE_API_KEY) {
    keys.push(process.env.GOOGLE_API_KEY);
  }
  if (config.GeminiApiKeys && Array.isArray(config.GeminiApiKeys) && config.GeminiApiKeys.length > 0) {
    keys.push(...config.GeminiApiKeys);
  } else if (config.ApiKeys && Array.isArray(config.ApiKeys) && config.ApiKeys.length > 0) {
    keys.push(...config.ApiKeys);
  } else if (config.ApiKey) {
    keys.push(config.ApiKey);
  }
  
  if (keys.length === 0) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No Gemini API keys found" }));
    return;
  }
  
  const apiKey = keys[0];
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Resolve model
  const { resolveModel } = await import("./model-resolver.mjs");
  const { model: modelName } = resolveModel("gemini", "grammar", config);
  
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt
  });
  
  const t1 = performance.now();
  
  // Set headers for streaming
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  
  // Stream the response
  const result = await model.generateContentStream(userInput);
  let fullText = "";
  
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    fullText += chunkText;
    
    // Send chunk as SSE event
    res.write(`data: ${JSON.stringify({ type: "chunk", text: chunkText })}\n\n`);
  }
  
  const t2 = performance.now();
  const elapsed = t2 - t1;
  
  // Send completion event
  const errorTypes = await getDbFunctions();
  const parsed = parseDiagnosis(fullText, errorTypes);
  const formattedContent = parsed.raw ? formatDisplayContent(parsed.raw) : fullText;

  res.write(`data: ${JSON.stringify({ 
    type: "complete", 
    content: formattedContent,
    perf: { llm_ms: elapsed, total_ms: performance.now() - startTime }
  })}\n\n`);
  
  res.end();
  
  // Save to DB asynchronously
  setImmediate(() => saveToDatabase(userInput, fullText));
}

// Non-streaming response (fallback)
async function nonStreamingResponse(res, llm, userInput, systemPrompt, startTime) {
  const text = await llm.generateWithFallback(userInput, systemPrompt, {
    taskType: "grammar"
  });
  
  const elapsed = performance.now() - startTime;
  
  const errorTypes = await getDbFunctions();
  const parsed = parseDiagnosis(text, errorTypes);
  const formattedContent = parsed.raw ? formatDisplayContent(parsed.raw) : text;

  // Save to DB asynchronously
  setImmediate(() => saveToDatabase(userInput, text));

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify({
    content: formattedContent,
    perf: {
      llm_ms: elapsed,
      total_ms: performance.now() - startTime
    }
  }));
}

// Start server
server.listen(PORT, HOST, () => {
  const provider = config.LLMProvider || "gemini";
  
  // Determine the grammar model for the active provider
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

// Graceful shutdown
process.on("SIGINT", () => {
  console.error("[IGT-SERVER] Shutting down...");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.error("[IGT-SERVER] Shutting down...");
  server.close(() => process.exit(0));
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[IGT-SERVER] Uncaught exception:", error.message);
});

