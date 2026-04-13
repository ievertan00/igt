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

// Parse diagnosis from LLM output
function parseDiagnosis(output, errorTypes) {
  const result = {
    diagnoses: [],
    advice: { rule: null, tip: null }
  };

  const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      const jsonData = JSON.parse(jsonMatch[1]);
      if (jsonData.diagnoses && Array.isArray(jsonData.diagnoses)) {
        for (const d of jsonData.diagnoses) {
          const rawType = (d.error_type || "").trim();
          const classifiedType = errorTypes.classifyErrorType(rawType);
          result.diagnoses.push({
            error_type: errorTypes.getErrorTypePath(classifiedType),
            severity: d.severity || "Minor",
            explanation: d.explanation || ""
          });
        }
      }
      result.advice.rule = jsonData.rule || null;
      result.advice.tip = jsonData.tip || null;
      return result;
    } catch (e) {
      // JSON parse failed
    }
  }

  return result;
}

// Extract Correction and Refine sections
function extractSections(output) {
  const correctionMatch = output.match(/\*\*Correction\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);
  const refineMatch = output.match(/\*\*Refine\*\*:\s*([\s\S]*?)(?=\*\*[A-Z]|$)/i);

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

    if (!dbExists) {
      db.pragma("journal_mode = WAL");
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
    } else {
      db.pragma("journal_mode = WAL");
    }

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

    db.close();
  } catch (error) {
    // Silently fail
  }
}

// Request handler
const server = http.createServer(async (req, res) => {
  const startTime = performance.now();
  
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
      try {
        const payload = JSON.parse(body);
        const userInput = payload.text || payload.input;
        
        if (!userInput) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'text' or 'input' field" }));
          return;
        }

        const llm = await getLLMManager();
        const prompt = getSystemPrompt();
        
        // Use streaming API
        const provider = llm.getCurrentProvider();
        const config = llm.config;
        
        // For Gemini, use streaming
        if (provider && provider.name === "gemini") {
          await streamGeminiResponse(res, userInput, prompt, llm, startTime);
        } else {
          // Fallback: non-streaming for other providers
          await nonStreamingResponse(res, llm, userInput, prompt, startTime);
        }
      } catch (error) {
        const providerName = llmManager ? llmManager.getCurrentProviderName() : "unknown";
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
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
      try {
        const payload = JSON.parse(body);
        const userInput = payload.text || payload.input;
        
        if (!userInput) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'text' or 'input' field" }));
          return;
        }

        await nonStreamingResponse(res, await getLLMManager(), userInput, getSystemPrompt(), startTime);
      } catch (error) {
        const providerName = llmManager ? llmManager.getCurrentProviderName() : "unknown";
        res.writeHead(500, { "Content-Type": "application/json" });
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
  res.write(`data: ${JSON.stringify({ 
    type: "complete", 
    content: fullText,
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
  
  // Save to DB asynchronously
  setImmediate(() => saveToDatabase(userInput, text));

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify({
    content: text,
    perf: {
      llm_ms: elapsed,
      total_ms: performance.now() - startTime
    }
  }));
}

// Start server
server.listen(PORT, HOST, () => {
  const provider = config.LLMProvider || "qwen";
  const grammarModelField = provider === "qwen" ? "QwenFlashModel" : 
                            provider === "deepseek" ? "DeepseekFlashModel" : "GeminiFlashModel";
  const grammarModel = config[grammarModelField] || "unknown";
  
  console.error(`[IGT-SERVER] Ready on http://${HOST}:${PORT}`);
  console.error(`[IGT-SERVER] PID: ${process.pid}`);
  console.error(`[IGT-SERVER] Provider: ${provider}`);
  console.error(`[IGT-SERVER] Grammar model: ${grammarModel}`);
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
