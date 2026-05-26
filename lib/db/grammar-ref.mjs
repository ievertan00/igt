/**
 * Grammar Reference DB — read-only FTS5 access layer.
 *
 * Opens grammar_ref.db (separate from igt_data.db) as a lazy singleton.
 * The DB is built from Wikipedia grammar articles and the English Grammar
 * Profile (Cambridge) via scripts/index-wikipedia.mjs.
 *
 * Exports: grammarRefAvailable(), searchGrammarRef(), executeGrammarSearch(),
 * and SEARCH_GRAMMAR_TOOL_DEF (canonical tool definition for all providers).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import configLoader from "../shared/config-loader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");

// ── Singleton state ──────────────────────────────────────────────────────────

let _db = null;
let _available = null; // null = unchecked, true, false

function resolveRefDbPath() {
  const config = configLoader.load();
  const p = config.GrammarRefDbPath || config.BooksDbPath || "grammar_ref.db";
  return path.isAbsolute(p) ? p : path.join(projectRoot, p);
}

/**
 * Returns true if grammar_ref.db exists on disk.
 * Result is cached after the first call.
 * Synchronous — safe to call in conditional branches before async work.
 */
export function grammarRefAvailable() {
  if (_available !== null) return _available;
  try {
    _available = fs.existsSync(resolveRefDbPath());
  } catch {
    _available = false;
  }
  return _available;
}

/**
 * Lazily open the DB (read-only) on first call.
 * @returns {import('better-sqlite3').Database}
 */
async function getDb() {
  if (_db) return _db;
  const { default: Database } = await import("better-sqlite3");
  _db = new Database(resolveRefDbPath(), { readonly: true });
  return _db;
}

// ── Search ───────────────────────────────────────────────────────────────────

/**
 * Full-text search across all indexed grammar reference material.
 *
 * @param {string} query  - Natural language grammar topic query
 * @param {number} topK   - Maximum results to return (default 3)
 * @returns {Promise<Array<{ article: string, section: string, text: string }>>}
 */
export async function searchGrammarRef(query, topK = 3) {
  if (!grammarRefAvailable()) return [];

  // Sanitize: FTS5 operators would break the MATCH expression
  const safeQuery = query.replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!safeQuery) return [];

  const SQL = `
    SELECT
      c.article,
      c.section,
      c.content AS text,
      bm25(grammar_chunks_fts) AS rank
    FROM grammar_chunks_fts
    JOIN grammar_chunks c ON c.id = grammar_chunks_fts.rowid
    WHERE grammar_chunks_fts MATCH ?
    ORDER BY rank          -- BM25 scores are negative; most negative = best match
    LIMIT ?
  `;

  try {
    const db = await getDb();

    // First attempt: full AND-match (all terms must appear)
    let rows = db.prepare(SQL).all(safeQuery, topK);

    // Fallback: if AND returns nothing, retry with individual terms joined by OR
    if (rows.length === 0) {
      const tokens = safeQuery.split(/\s+/).filter(t => t.length >= 3);
      if (tokens.length > 0) {
        const orQuery = tokens.join(" OR ");
        rows = db.prepare(SQL).all(orQuery, topK);
      }
    }

    return rows.map(r => ({
      article: r.article,
      section: r.section,
      text:    r.text,
    }));
  } catch {
    // FTS5 MATCH throws on malformed queries — degrade silently
    return [];
  }
}

// ── Tool definition ──────────────────────────────────────────────────────────

/**
 * Canonical provider-neutral tool definition.
 * Each LLM provider converts this into its own format (Gemini FunctionDeclaration
 * or OpenAI-compat function object) before passing to the API.
 */
export const SEARCH_GRAMMAR_TOOL_DEF = {
  name: "search_grammar_ref",
  description:
    "Search a grammar reference database of Wikipedia grammar articles " +
    "and the English Grammar Profile (Cambridge) for rules, explanations, " +
    "and examples relevant to a grammar topic. " +
    "Call this when you need a canonical rule, a precise distinction, " +
    "or want to ground your answer in a reliable reference before answering.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "A concise search query describing the grammar topic, " +
          "e.g. 'present perfect vs simple past usage' or " +
          "'articles with proper nouns and place names'.",
      },
    },
    required: ["query"],
  },
};

// ── Executor ─────────────────────────────────────────────────────────────────

/**
 * Execute a search_grammar_ref tool call.
 * Called by the LLM provider tool loop when the model requests a grammar search.
 *
 * @param {{ query: string }} args
 * @returns {Promise<{ result: string, sources: Array<{ article, section }> }>}
 */
export async function executeGrammarSearch({ query }) {
  const chunks = await searchGrammarRef(query, 3);

  if (chunks.length === 0) {
    return {
      result: "No relevant grammar reference entries found for that query.",
      sources: [],
    };
  }

  const result = chunks
    .map((c, i) => `[${i + 1}] ${c.article} — ${c.section}\n${c.text}`)
    .join("\n\n---\n\n");

  const sources = chunks.map(c => ({
    article: c.article,
    section: c.section,
  }));

  return { result, sources };
}
