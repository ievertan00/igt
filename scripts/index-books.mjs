/**
 * scripts/index-books.mjs — One-time PDF indexer for grammar book grounding.
 *
 * Reads PDF files from the assets/ directory (or --dir=<path>),
 * splits them into unit/section chunks, and writes them into grammar_ref.db
 * using an FTS5 virtual table for fast full-text search.
 *
 * Usage:
 *   node scripts/index-books.mjs
 *   node scripts/index-books.mjs --dir=C:\path\to\pdfs
 *   node scripts/index-books.mjs --dry-run   (show chunk counts, skip DB write)
 *
 * After running, restart the IGT server to activate book grounding.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { PDFParse } from "pdf-parse";
import configLoader from "../lib/shared/config-loader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

// ── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dirArg = args.find(a => a.startsWith("--dir="))?.split("=")[1];
const dryRun = args.includes("--dry-run");
const assetsDir = dirArg
  ? (path.isAbsolute(dirArg) ? dirArg : path.join(process.cwd(), dirArg))
  : path.join(projectRoot, "assets");

// ── Config ───────────────────────────────────────────────────────────────────

const config = configLoader.load();
const booksDbPathRaw = config.GrammarRefDbPath || "grammar_ref.db";
const booksDbPath = path.isAbsolute(booksDbPathRaw)
  ? booksDbPathRaw
  : path.join(projectRoot, booksDbPathRaw);

// ── Book registry ─────────────────────────────────────────────────────────────

/**
 * Each entry describes one reference book.
 * `pattern` is matched case-insensitively against filenames in assetsDir.
 * `strategy` selects the chunking function.
 */
const BOOKS = [
  {
    pattern: /english.grammar.in.use/i,
    code: "EGIU",
    title: "English Grammar in Use (Murphy)",
    strategy: "murphy",
  },
  {
    pattern: /practical.english.usage/i,
    code: "PEU",
    title: "Practical English Usage (Swan)",
    strategy: "swan",
  },
  {
    pattern: /longman.student.grammar/i,
    code: "LSGE",
    title: "Longman Student Grammar of Spoken and Written English",
    strategy: "longman",
  },
];

// ── PDF extraction ────────────────────────────────────────────────────────────

async function extractPdfPages(filePath) {
  console.log(`  📄 Extracting text from ${path.basename(filePath)}…`);
  const buffer = fs.readFileSync(filePath);
  // pdf-parse v2: class-based API
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();

  const pages = (result.pages || []).map(p => {
    let text = p.text || "";
    // Fix hyphenated line-breaks
    text = text.replace(/(\w+)-\n(\w+)/g, "$1$2");
    // Collapse runs of 3+ blank lines
    text = text.replace(/\n{3,}/g, "\n\n");
    return text.trim();
  });

  // Check if this is a scanned PDF (no extractable text)
  const totalChars = pages.reduce((n, p) => n + p.length, 0);
  return { pages, totalChars };
}

// ── Chunking strategies (page-based) ─────────────────────────────────────────

/**
 * Murphy "English Grammar in Use".
 *
 * Each unit spans 2 pages: a theory page and an exercises page.
 * Both pages reference "Unit {N}" somewhere near the top.
 * Theory pages have the unit title on a line before "Unit".
 *
 * Strategy: scan each page for "Unit\n{N}" within the first 200 chars.
 * Group consecutive pages with the same unit number into one chunk.
 * Take the title from the line immediately before "Unit" (filtering section letters).
 */
function chunkByMurphy(pages) {
  /**
   * Look for "Unit\n{N}" within the first 200 chars.
   * Return { unitNum, title } or null.
   */
  function detectUnit(pageText) {
    // Search within first 200 chars to avoid cross-references later in page
    const head = pageText.slice(0, 200);

    // Pattern: "Unit\n{N}" (newline-separated, most common)
    const m = head.match(/Unit\n(\d+[A-Z]?)\b/);
    if (m) {
      const unitNum = m[1];
      // Extract title: take lines before "Unit", filter out single-char section labels
      const before = head.slice(0, head.indexOf("Unit\n" + unitNum));
      const lines = before.split("\n").map(l => l.trim()).filter(Boolean);
      const title = lines.reverse().find(l => l.length > 3 && !/^\d+$/.test(l)) || null;
      return { unitNum, title };
    }

    // Pattern: "Unit {N}" on same line (e.g. "Exercises Unit 3")
    const m2 = head.match(/Unit\s+(\d+[A-Z]?)\b/);
    if (m2) {
      return { unitNum: m2[1], title: null };
    }

    return null;
  }

  const unitMap = new Map(); // unitNum → { title, pages: [] }

  for (const pageText of pages) {
    if (!pageText) continue;
    const detected = detectUnit(pageText);
    if (!detected) continue;

    const { unitNum, title } = detected;
    if (!unitMap.has(unitNum)) {
      unitMap.set(unitNum, { title: title || `Unit ${unitNum}`, pages: [] });
    } else if (title && !unitMap.get(unitNum).title) {
      unitMap.get(unitNum).title = title;
    }
    unitMap.get(unitNum).pages.push(pageText);
  }

  const chunks = [];
  for (const [unitNum, { title, pages: unitPages }] of unitMap) {
    const text = unitPages.join("\n\n").trim();
    if (text.length >= 100) {
      chunks.push({ unit: `Unit ${unitNum}`, title, text });
    }
  }
  // Sort numerically
  chunks.sort((a, b) => {
    const na = parseInt(a.unit.replace("Unit ", ""));
    const nb = parseInt(b.unit.replace("Unit ", ""));
    return na - nb;
  });
  return chunks;
}

/**
 * Swan "Practical English Usage".
 *
 * Each entry starts a new page beginning with "{N} {title}" on the first line,
 * where N is the entry number (1–635) and the title starts with a lowercase letter.
 * Example first line: "24have (got): possession, relationships and other states"
 * or: "27 do: auxiliary verb"
 *
 * Strategy: for each page, check if the first non-empty line matches the entry pattern.
 * If yes, start a new chunk. Otherwise append to the current chunk.
 */
function chunkBySwan(pages) {
  // Entry header: digits + optional space + lowercase/description title
  // e.g. "24have (got)..." or "27 do: auxiliary verb" or "30 simple present: forms"
  const ENTRY_RE = /^(\d{1,3})\s*([a-z][\w\s:,/()'-]{3,80})/;

  const chunks = [];
  let current = null;

  for (const pageText of pages) {
    if (!pageText || pageText.length < 50) continue;
    const firstLine = pageText.split("\n").find(l => l.trim().length > 3)?.trim() || "";
    const m = firstLine.match(ENTRY_RE);

    if (m) {
      if (current) chunks.push(current);
      current = {
        unit: `Entry ${m[1]}`,
        title: `${m[1]} ${m[2].trim()}`,
        text: pageText,
      };
    } else if (current) {
      current.text += "\n\n" + pageText;
    }
  }
  if (current) chunks.push(current);

  // Filter minimum length
  return chunks.filter(c => c.text.trim().length >= 150);
}

/**
 * Longman "Student Grammar of Spoken and Written English".
 *
 * The book may be a scanned PDF with no extractable text.
 * If pages have sufficient text, chunk by chapter/section heading.
 * Otherwise return empty (graceful degradation).
 */
function chunkByLongman(pages) {
  const totalText = pages.join("\n");
  if (totalText.trim().length < 500) {
    console.log("  ⚠️  Longman: insufficient extractable text (possibly scanned PDF). Skipping.");
    return [];
  }

  // Section headings like "1.2 The grammar of conversation" or "CHAPTER 1 Overview"
  const SECTION_RE = /^(\d+\.\d+(?:\.\d+)?)\s+(.+)$/;
  const CHAPTER_RE = /^CHAPTER\s+(\d+)\s+(.+)$/i;

  const chunks = [];
  let current = null;

  for (const pageText of pages) {
    if (!pageText || pageText.length < 50) continue;
    const firstLine = pageText.split("\n").find(l => l.trim().length > 3)?.trim() || "";
    const sm = firstLine.match(SECTION_RE);
    const cm = firstLine.match(CHAPTER_RE);

    if (sm) {
      if (current) chunks.push(current);
      current = { unit: sm[1], title: `${sm[1]} ${sm[2].trim()}`, text: pageText };
    } else if (cm) {
      if (current) chunks.push(current);
      current = { unit: `Chapter ${cm[1]}`, title: cm[2].trim(), text: pageText };
    } else if (current) {
      current.text += "\n\n" + pageText;
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(c => c.text.trim().length >= 100);
}

const STRATEGIES = {
  murphy:  chunkByMurphy,
  swan:    chunkBySwan,
  longman: chunkByLongman,
};

// ── DB setup ──────────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS grammar_chunks (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  article TEXT NOT NULL,
  section TEXT NOT NULL,
  content TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS grammar_chunks_fts USING fts5(
  article  UNINDEXED,
  section,
  content,
  content='grammar_chunks',
  content_rowid='id',
  tokenize='porter ascii'
);

CREATE TRIGGER IF NOT EXISTS grammar_chunks_ai AFTER INSERT ON grammar_chunks BEGIN
  INSERT INTO grammar_chunks_fts(rowid, section, content)
    VALUES (new.id, new.section, new.content);
END;

CREATE TRIGGER IF NOT EXISTS grammar_chunks_ad AFTER DELETE ON grammar_chunks BEGIN
  INSERT INTO grammar_chunks_fts(grammar_chunks_fts, rowid, section, content)
    VALUES ('delete', old.id, old.section, old.content);
END;
`;

// ── Main ─────────────────────────────────────────────────────────────────────

async function indexBook(db, bookMeta, filePath) {
  const { pages, totalChars } = await extractPdfPages(filePath);
  if (totalChars < 500) {
    console.log(`  ⚠️  Skipping — extracted text too short (${totalChars} chars). Possibly a scanned PDF.`);
    return 0;
  }
  const chunker = STRATEGIES[bookMeta.strategy];
  const chunks = chunker(pages);

  console.log(`  ✂️  ${chunks.length} chunks extracted (strategy: ${bookMeta.strategy})`);

  if (dryRun) return chunks.length;

  const insert = db.prepare(
    "INSERT INTO grammar_chunks (article, section, content) VALUES (@article, @section, @content)"
  );
  const insertMany = db.transaction(rows => {
    for (const row of rows) insert.run(row);
  });

  insertMany(chunks.map(c => ({
    article: bookMeta.title,
    section: c.unit ? `${c.unit}: ${c.title}` : c.title,
    content: c.text,
  })));

  return chunks.length;
}

async function main() {
  console.log("\n📚 IGT Grammar Book Indexer");
  console.log("═".repeat(50));

  if (!fs.existsSync(assetsDir)) {
    console.error(`\n❌ Assets directory not found: ${assetsDir}`);
    console.error("   Place PDF files there or pass --dir=<path>.");
    process.exit(1);
  }

  // Find PDF files in assetsDir
  const pdfFiles = fs.readdirSync(assetsDir).filter(f => f.toLowerCase().endsWith(".pdf"));
  if (pdfFiles.length === 0) {
    console.error(`\n❌ No PDF files found in ${assetsDir}`);
    process.exit(1);
  }

  console.log(`\n📁 Source: ${assetsDir}`);
  console.log(`💾 Target: ${dryRun ? "(dry run — no DB write)" : booksDbPath}\n`);

  let db = null;
  if (!dryRun) {
    // Remove old DB to start fresh
    if (fs.existsSync(booksDbPath)) {
      fs.unlinkSync(booksDbPath);
      console.log("🗑️  Removed existing grammar_ref.db (rebuilding from scratch)");
    }
    db = new Database(booksDbPath);
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA_SQL);
  }

  let totalChunks = 0;
  let booksFound = 0;

  for (const bookMeta of BOOKS) {
    const match = pdfFiles.find(f => bookMeta.pattern.test(f));
    if (!match) {
      console.log(`⚠️  Skipping ${bookMeta.code} — no matching PDF found`);
      continue;
    }

    console.log(`\n📖 ${bookMeta.title}`);
    console.log(`   File: ${match}`);

    try {
      const count = await indexBook(db, bookMeta, path.join(assetsDir, match));
      totalChunks += count;
      booksFound++;
      console.log(`   ✅ Done`);
    } catch (err) {
      console.error(`   ❌ Failed: ${err.message}`);
    }
  }

  if (!dryRun && db) {
    // Rebuild FTS index for optimal BM25 statistics
    console.log("\n🔧 Rebuilding FTS index for BM25 ranking…");
    db.exec("INSERT INTO grammar_chunks_fts(grammar_chunks_fts) VALUES ('rebuild')");
    db.close();
  }

  console.log("\n" + "═".repeat(50));
  console.log(`✅ Indexed ${booksFound} book(s), ${totalChunks} total chunks`);

  if (!dryRun) {
    console.log(`💾 Saved to: ${booksDbPath}`);
    console.log("\n💡 Restart the IGT server to activate book grounding.");
  }
  console.log("");
}

main().catch(err => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
