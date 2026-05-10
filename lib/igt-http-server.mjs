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
import { runMigrations } from "./migrations.mjs";
import { grade as gradeCard, QUALITY_CORRECT, QUALITY_WRONG } from "./srs.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const PORT = parseInt(process.env.IGT_SERVER_PORT || "18964", 10);
const HOST = process.env.IGT_SERVER_HOST || "127.0.0.1";

// Load merged config
const config = configLoader.load();
const projectRoot = path.join(__dirname, "..");

// Initialize LLM providers lazily
let llmManager = null;
let systemPrompt = null;

// Session state held in memory (single-user CLI; Node event loop serializes writes within process).
// Loaded once at boot from MAX(timestamp), session_id. New sessions inserted only on >30-min gap.
const SESSION_GAP_MS = 30 * 60 * 1000;
let currentSessionId = null;
let lastInputAt = null;
let sessionBootstrapped = false;

function parseSqliteTs(s) {
  if (!s) return null;
  const iso = s.includes("T") ? s : s.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

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

function parseDiagnosis(output, errorTypes) {
  const logPath = path.isAbsolute(config.LogPath || "")
    ? config.LogPath
    : path.join(projectRoot, config.LogPath || "igt_db_error.log");
  return parseDiagnosisCore(output, errorTypes, { logPath });
}

// /undo cascade: hard-delete the last N inputs and everything FK'd to them, in one txn.
// Returns counts. Does NOT touch the markdown log file (md cleanup deferred to 0.5c/d).
function undoLastInputs(db, n) {
  const ids = db.prepare(`SELECT id FROM inputs ORDER BY id DESC LIMIT ?`).all(n).map(r => r.id);
  if (ids.length === 0) return { deleted_inputs: 0, deleted_diagnoses: 0, deleted_advice: 0, deleted_cards: 0 };

  const placeholders = ids.map(() => "?").join(",");
  const tx = db.transaction(() => {
    const diagIds = db.prepare(`SELECT id FROM diagnoses WHERE input_id IN (${placeholders})`).all(...ids).map(r => r.id);
    const cardsDeleted = diagIds.length === 0 ? 0 : db.prepare(
      `DELETE FROM srs_cards WHERE source_type IN ('cloze','diagnosis') AND source_id IN (${diagIds.map(()=>"?").join(",")})`
    ).run(...diagIds).changes;
    const adviceDeleted = db.prepare(`DELETE FROM advice WHERE input_id IN (${placeholders})`).run(...ids).changes;
    const diagDeleted = db.prepare(`DELETE FROM diagnoses WHERE input_id IN (${placeholders})`).run(...ids).changes;
    const inputsDeleted = db.prepare(`DELETE FROM inputs WHERE id IN (${placeholders})`).run(...ids).changes;
    return { cardsDeleted, adviceDeleted, diagDeleted, inputsDeleted };
  });
  const r = tx();
  return {
    deleted_inputs: r.inputsDeleted,
    deleted_diagnoses: r.diagDeleted,
    deleted_advice: r.adviceDeleted,
    deleted_cards: r.cardsDeleted,
    input_ids: ids,
  };
}

// Save to database (non-blocking). `parsed` is the normalized object from parseDiagnosis.
async function saveToDatabase(userInput, parsed) {
  const logPath = config.LogPath || "igt_db_error.log";
  const resolvedLogPath = path.isAbsolute(logPath) ? logPath : path.join(projectRoot, logPath);

  try {
    const dbPath = config.DbPath || "igt_data.db";
    const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
    const DbClass = await getDatabase();
    const db = new DbClass(resolvedDbPath);
    db.pragma("journal_mode = WAL");
    // Schema is owned by lib/migrations.mjs and applied at boot via ensureMigrations().

    const correction = parsed.correction;
    const refine = parsed.refine;

    if (!correction && parsed.diagnoses.length === 0 && !parsed.review) {
      fs.appendFileSync(
        resolvedLogPath,
        `${new Date().toISOString()} WARN: empty parsed payload for: "${userInput.slice(0, 80)}"\n`
      );
      return;
    }

    // Bootstrap in-memory session state from the latest input row (one-time per process)
    if (!sessionBootstrapped) {
      const last = db.prepare(`
        SELECT timestamp, session_id FROM inputs
        WHERE session_id IS NOT NULL
        ORDER BY id DESC LIMIT 1
      `).get();
      if (last) {
        currentSessionId = last.session_id;
        lastInputAt = parseSqliteTs(last.timestamp);
      }
      sessionBootstrapped = true;
    }

    // Decide whether to start a new session (>30-min gap or first ever)
    const now = Date.now();
    if (currentSessionId === null || lastInputAt === null || (now - lastInputAt) > SESSION_GAP_MS) {
      const startIso = new Date(now).toISOString();
      const sessionRes = db.prepare(`
        INSERT INTO sessions (start_time, end_time, total_inputs) VALUES (?, ?, 0)
      `).run(startIso, startIso);
      currentSessionId = sessionRes.lastInsertRowid;
    }
    lastInputAt = now;

    const insertInput = db.prepare(`
      INSERT INTO inputs (session_id, original_text, correction, refine)
      VALUES (?, ?, ?, ?)
    `);
    const inputResult = insertInput.run(currentSessionId, userInput, correction, refine);
    const inputId = inputResult.lastInsertRowid;

    // Denormalized session counters (kept fresh for fast queries)
    db.prepare(`
      UPDATE sessions
      SET end_time = ?, total_inputs = total_inputs + 1
      WHERE id = ?
    `).run(new Date(now).toISOString(), currentSessionId);

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

      if (correction && userInput.trim() !== correction.trim()) {
        db.prepare(`
          INSERT INTO srs_cards (source_type, source_id, prompt, answer, due_date)
          VALUES ('input', ?, ?, ?, date('now'))
        `).run(inputId, userInput.trim(), correction.trim());
      }
    }

    if (parsed.rule || parsed.tip) {
      const insertAdvice = db.prepare(`
        INSERT INTO advice (input_id, rule, tip)
        VALUES (?, ?, ?)
      `);
      insertAdvice.run(inputId, parsed.rule, parsed.tip);
    }

    db.close();
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

  // SRS — list cards due today
  if (req.method === "GET" && req.url.startsWith("/review/due")) {
    try {
      const dbPath = config.DbPath || "igt_data.db";
      const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
      const DbClass = await getDatabase();
      const db = new DbClass(resolvedDbPath, { readonly: true });
      const urlParams = new URL(req.url, "http://x").searchParams;
      const limit = parseInt(urlParams.get("limit") ?? "10", 10) || 10;
      const typeFilter = urlParams.get("type") || "all";
      const typeCondition = typeFilter === "vocab"
        ? `c.source_type = 'vocab'`
        : typeFilter === "grammar"
        ? `c.source_type = 'input'`
        : `c.source_type IN ('input', 'vocab')`;
      const cards = db.prepare(`
        SELECT c.id, c.source_type, c.source_id, c.prompt, c.answer, c.ease, c.interval_days, c.due_date, c.total_reviews, c.correct_streak,
               CASE WHEN c.source_type = 'input'
                 THEN (SELECT GROUP_CONCAT(d.error_type, ' · ') FROM diagnoses d WHERE d.input_id = c.source_id)
                 ELSE NULL
               END AS hint
        FROM srs_cards c
        WHERE ${typeCondition}
          AND c.due_date <= date('now')
        ORDER BY c.due_date ASC, c.id ASC
        LIMIT ?
      `).all(Math.max(1, Math.min(limit, 100)));
      db.close();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ cards }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // SRS — grade a card. Exact-match first; LLM fall-through if response differs.
  if (req.method === "POST" && req.url === "/review/grade") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      try {
        const { card_id, response, correct: correctOverride } = JSON.parse(body || "{}");
        const dbPath = config.DbPath || "igt_data.db";
        const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
        const DbClass = await getDatabase();
        const db = new DbClass(resolvedDbPath);
        const card = db.prepare(`SELECT * FROM srs_cards WHERE id = ?`).get(card_id);
        if (!card) {
          db.close();
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
          ease: card.ease,
          intervalDays: card.interval_days,
          totalReviews: card.total_reviews,
          correctStreak: card.correct_streak,
        }, correct ? QUALITY_CORRECT : QUALITY_WRONG);

        db.prepare(`
          UPDATE srs_cards
          SET ease = ?, interval_days = ?, due_date = ?, last_reviewed = CURRENT_TIMESTAMP,
              total_reviews = ?, correct_streak = ?
          WHERE id = ?
        `).run(next.ease, next.intervalDays, next.dueDate, next.totalReviews, next.correctStreak, card.id);
        db.close();

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ correct, judgement, next: { intervalDays: next.intervalDays, dueDate: next.dueDate, ease: next.ease } }));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // SRS — permanently delete a card (mis-input / test sentence)
  if (req.method === "POST" && req.url === "/review/delete") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      try {
        const { card_id } = JSON.parse(body || "{}");
        const dbPath = config.DbPath || "igt_data.db";
        const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
        const DbClass = await getDatabase();
        const db = new DbClass(resolvedDbPath);
        const changes = db.prepare(`DELETE FROM srs_cards WHERE id = ?`).run(card_id).changes;
        db.close();
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

      const dbPath = config.DbPath || "igt_data.db";
      const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
      const DbClass = await getDatabase();
      const db = new DbClass(resolvedDbPath);

      // Migrate old two-card format (with dir field) to single-card format
      db.prepare(`DELETE FROM srs_cards WHERE source_type='vocab' AND (prompt LIKE 'VOCAB|||word2zh|||%' OR prompt LIKE 'VOCAB|||zh2word|||%')`).run();

      const mkPrompt = (e) => ["VOCAB", e.word, e.pos, e.zh, e.meaning, e.example, e.note].join("|||");
      const check = db.prepare(`SELECT COUNT(*) AS n FROM srs_cards WHERE source_type='vocab' AND prompt LIKE ?`);
      const ins = db.prepare(`INSERT INTO srs_cards (source_type, source_id, prompt, answer, due_date) VALUES ('vocab', 0, ?, ?, date('now'))`);

      let seeded = 0;
      for (const e of entries) {
        if (!e.word || !e.zh) continue;
        const existing = check.get(`VOCAB|||${e.word}|||%`).n;
        if (existing === 0) {
          ins.run(mkPrompt(e), e.word);
          seeded++;
        }
      }

      db.close();
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
      const dbPath = config.DbPath || "igt_data.db";
      const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
      const DbClass = await getDatabase();
      const db = new DbClass(resolvedDbPath, { readonly: true });

      const byLength = db.prepare(`
        SELECT bucket_id,
          CASE bucket_id WHEN 1 THEN '0-10' WHEN 2 THEN '11-20' WHEN 3 THEN '21-30' ELSE '31+' END AS bucket,
          AVG(error_count) AS avg_errors
        FROM (
          SELECT i.id,
            CASE
              WHEN (length(trim(i.original_text)) - length(replace(trim(i.original_text),' ','')) + 1) <= 10 THEN 1
              WHEN (length(trim(i.original_text)) - length(replace(trim(i.original_text),' ','')) + 1) <= 20 THEN 2
              WHEN (length(trim(i.original_text)) - length(replace(trim(i.original_text),' ','')) + 1) <= 30 THEN 3
              ELSE 4
            END AS bucket_id,
            COUNT(d.id) AS error_count
          FROM inputs i LEFT JOIN diagnoses d ON d.input_id = i.id
          GROUP BY i.id
        )
        GROUP BY bucket_id ORDER BY bucket_id
      `).all();

      const cefrTrajectory = db.prepare(`
        SELECT date(timestamp) AS day, level FROM assessments ORDER BY timestamp
      `).all();

      const { getMastery: getMast } = await import("./mastery.mjs");
      const mastery = getMast(db);

      const { total_inputs } = db.prepare("SELECT COUNT(*) as total_inputs FROM inputs").get();
      const { total_diagnoses } = db.prepare("SELECT COUNT(*) as total_diagnoses FROM diagnoses").get();

      db.close();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ byLength, cefrTrajectory, mastery, totalInputs: total_inputs, totalDiagnoses: total_diagnoses }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Session summary for end-of-session display
  if (req.method === "GET" && req.url === "/session/summary") {
    try {
      if (!currentSessionId) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ no_session: true }));
        return;
      }
      const dbPath = config.DbPath || "igt_data.db";
      const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
      const DbClass = await getDatabase();
      const db = new DbClass(resolvedDbPath, { readonly: true });
      const sid = currentSessionId;

      const sess = db.prepare(`SELECT total_inputs FROM sessions WHERE id = ?`).get(sid);
      const errCount = db.prepare(`SELECT COUNT(*) c FROM diagnoses d JOIN inputs i ON i.id = d.input_id WHERE i.session_id = ?`).get(sid);
      const topErr = db.prepare(`SELECT error_type, COUNT(*) c FROM diagnoses d JOIN inputs i ON i.id = d.input_id WHERE i.session_id = ? GROUP BY error_type ORDER BY c DESC LIMIT 1`).get(sid);
      const cardsAdded = db.prepare(`SELECT COUNT(*) c FROM srs_cards WHERE source_id IN (SELECT d.id FROM diagnoses d JOIN inputs i ON i.id = d.input_id WHERE i.session_id = ?)`).get(sid);
      const cardsDueTomorrow = db.prepare(`SELECT COUNT(*) c FROM srs_cards WHERE due_date = date('now', '+1 day')`).get();
      const avg7day = db.prepare(`SELECT CAST(COUNT(d.id) AS REAL) / MAX(1, COUNT(DISTINCT i.id)) avg FROM inputs i LEFT JOIN diagnoses d ON d.input_id = i.id WHERE i.timestamp > datetime('now', '-7 days')`).get();

      db.close();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        session_id: sid,
        total_inputs: sess?.total_inputs || 0,
        total_errors: errCount?.c || 0,
        top_error: topErr?.error_type || null,
        cards_added: cardsAdded?.c || 0,
        cards_due_tomorrow: cardsDueTomorrow?.c || 0,
        avg_errors_7day: avg7day?.avg || 0,
      }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Last N inputs (preview for /undo confirmation)
  if (req.method === "GET" && req.url.startsWith("/inputs/last")) {
    const n = parseInt(new URL(req.url, "http://x").searchParams.get("n") || "1", 10);
    try {
      const dbPath = config.DbPath || "igt_data.db";
      const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
      const DbClass = await getDatabase();
      const db = new DbClass(resolvedDbPath, { readonly: true });
      const rows = db.prepare(`SELECT id, timestamp, original_text FROM inputs ORDER BY id DESC LIMIT ?`).all(Math.max(1, Math.min(n, 50)));
      db.close();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ rows }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Hard-delete the last N inputs and cascade (A14)
  if (req.method === "POST" && req.url === "/undo") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", async () => {
      try {
        const { n = 1 } = JSON.parse(body || "{}");
        const count = Math.max(1, Math.min(parseInt(n, 10) || 1, 50));
        const dbPath = config.DbPath || "igt_data.db";
        const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
        const DbClass = await getDatabase();
        const db = new DbClass(resolvedDbPath);
        const result = undoLastInputs(db, count);
        db.close();
        // Reset session memory if we wiped the latest rows
        if (result.deleted_inputs > 0) {
          currentSessionId = null;
          lastInputAt = null;
          sessionBootstrapped = false;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Get a random status message (tip/quote/fact) for display
  if (req.method === "GET" && req.url === "/status-message") {
    try {
      const dbPath = config.DbPath || "igt_data.db";
      const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
      const DbClass = await getDatabase();
      const db = new DbClass(resolvedDbPath);
      
      const row = db.prepare(`
        SELECT * FROM status_messages 
        ORDER BY last_shown_at ASC, RANDOM() 
        LIMIT 1
      `).get();

      if (row) {
        db.prepare(`
          UPDATE status_messages 
          SET last_shown_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(row.id);
      }

      db.close();
      
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(row || { content: "Keep practicing!", type: "tip" }));
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

  // Provider switch — updates server-side llmManager in memory + persists to .env
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

  // Model switch — updates server-side llmManager + persists provider & ollama model to .env
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

  // Grammar check (single endpoint — JSON in, structured JSON out)
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
  res.end(JSON.stringify({ error: "Not found. Use POST /grammar" }));
});

async function nonStreamingResponse(res, llm, userInput, systemPrompt, startTime) {
  const provider = llm.getCurrentProviderName();
  const options = { taskType: "grammar" };
  if (provider === "gemini") {
    options.responseSchema = GRAMMAR_RESPONSE_SCHEMA;
  } else {
    options.responseFormat = { type: "json_object" };
  }

  const text = await llm.generateWithFallback(userInput, systemPrompt, options);
  const elapsed = performance.now() - startTime;

  const errorTypes = await getDbFunctions();
  const parsed = parseDiagnosis(text, errorTypes);

  await saveToDatabase(userInput, parsed);

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify({
    data: parsed,
    perf: { llm_ms: elapsed, total_ms: performance.now() - startTime }
  }));
}

// Apply pending migrations once at boot (synchronous before listen)
async function ensureMigrations() {
  const dbPath = config.DbPath || "igt_data.db";
  const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);
  const DbClass = await getDatabase();
  const db = new DbClass(resolvedDbPath);
  db.pragma("journal_mode = WAL");
  const ran = await runMigrations(db, path.join(projectRoot, "migrations"), {
    logger: (msg) => console.error(`[IGT-SERVER] ${msg}`),
  });
  db.close();
  if (ran.length > 0) console.error(`[IGT-SERVER] Applied ${ran.length} migration(s).`);
}

await ensureMigrations();

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

