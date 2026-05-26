/**
 * scripts/index-wikipedia.mjs — Grammar DB indexer.
 *
 * Builds grammar_ref.db from two sources:
 *
 *   1. Wikipedia grammar articles
 *      • 42-article seed list (verified good content)
 *      • Auto-discovered articles from 4 Wikipedia grammar categories
 *
 *   2. EGP — English Grammar Profile (Cambridge, 1,222 grammar points)
 *      • Reads "assets/English Grammar Profile Online.xlsx"
 *        or the path given by --egp=<path>
 *
 * Usage:
 *   node scripts/index-wikipedia.mjs
 *   node scripts/index-wikipedia.mjs --egp=C:\path\to\file.xlsx
 *   node scripts/index-wikipedia.mjs --dry-run
 *
 * After running, restart the IGT server to activate grammar grounding.
 */

import https   from "node:https";
import fs      from "node:fs";
import path    from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import configLoader from "../lib/shared/config-loader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

// ── CLI args ──────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const egpArg = args.find(a => a.startsWith("--egp="))?.split("=")[1];

const config        = configLoader.load();
const booksDbRaw    = config.GrammarRefDbPath || "grammar_ref.db";
const booksDbPath   = path.isAbsolute(booksDbRaw)
  ? booksDbRaw : path.join(projectRoot, booksDbRaw);

const defaultEgpPath = path.join(projectRoot, "assets", "English Grammar Profile Online.xlsx");
const egpPath = egpArg
  ? (path.isAbsolute(egpArg) ? egpArg : path.join(process.cwd(), egpArg))
  : (fs.existsSync(defaultEgpPath) ? defaultEgpPath : null);

// ── Wikipedia seed list (42 curated articles) ─────────────────────────────────

const SEEDS = [
  // Verb forms & tenses
  { page: "English_verbs",                    book: "English verbs" },
  { page: "Present_tense",                    book: "Present tense" },
  { page: "Past_tense",                       book: "Past tense" },
  { page: "Future_tense",                     book: "Future tense" },
  { page: "Perfect_aspect",                   book: "Perfect aspect" },
  { page: "Progressive_aspect",               book: "Progressive aspect" },
  { page: "English_modal_verbs",              book: "English modal verbs" },
  { page: "Passive_voice",                    book: "Passive voice" },
  { page: "Infinitive",                       book: "Infinitive" },
  { page: "Gerund",                           book: "Gerund" },
  { page: "Participle",                       book: "Participle" },
  { page: "Subject%E2%80%93verb_agreement",   book: "Subject–verb agreement" },
  // Articles & determiners
  { page: "English_articles",                 book: "English articles" },
  { page: "Determiner_(linguistics)",         book: "Determiner" },
  // Nouns & pronouns
  { page: "English_nouns",                    book: "English nouns" },
  { page: "English_pronouns",                 book: "English pronouns" },
  { page: "Mass_noun",                        book: "Mass noun (uncountable)" },
  // Adjectives & adverbs
  { page: "English_adjectives",               book: "English adjectives" },
  { page: "Adverb",                           book: "Adverb" },
  { page: "Comparison_(grammar)",             book: "Comparison (grammar)" },
  // Prepositions
  { page: "English_prepositions",             book: "English prepositions" },
  { page: "Preposition_and_postposition",     book: "Prepositions" },
  // Sentence structure
  { page: "English_clause_syntax",            book: "English clause syntax" },
  { page: "Relative_clause",                  book: "Relative clause" },
  { page: "English_conditional_sentences",    book: "English conditionals" },
  { page: "Indirect_speech",                  book: "Indirect speech" },
  { page: "Cleft_sentence",                   book: "Cleft sentence" },
  // Coordination & conjunctions
  { page: "Conjunction_(grammar)",            book: "Conjunction" },
  { page: "Coordination_(linguistics)",       book: "Coordination" },
  // Punctuation & mechanics
  { page: "Apostrophe_(mark)",                book: "Apostrophe" },
  { page: "Comma",                            book: "Comma" },
  { page: "English_punctuation",              book: "English punctuation" },
  // Word choice & style
  { page: "Collocation",                      book: "Collocation" },
  { page: "Register_(sociolinguistics)",      book: "Register (sociolinguistics)" },
  { page: "False_friend",                     book: "False friend" },
  { page: "Pleonasm",                         book: "Pleonasm" },
  // Phrasal & idiomatic
  { page: "Phrasal_verb",                     book: "Phrasal verb" },
  { page: "Quantifier_(linguistics)",         book: "Quantifier" },
  // Reference & cohesion
  { page: "Anaphora_(linguistics)",           book: "Anaphora" },
  { page: "Ellipsis_(linguistics)",           book: "Ellipsis" },
  // Sentence-level
  { page: "Sentence_clause_structure",        book: "Sentence structure" },
  { page: "Phrase",                           book: "Phrase" },
];

// ── Wikipedia category discovery ──────────────────────────────────────────────

// Categories to crawl for additional articles beyond the seed list.
const DISCOVERY_CATEGORIES = [
  "English_grammar",
  "English_syntax",
  "English_verbs",
  "English_punctuation",
];

// Titles matching any of these patterns are excluded from discovery results.
// Specific discovered articles that are clearly off-topic for grammar learning
const BLOCKED_TITLES = new Set([
  "Word Crimes",
  "Joseph Priestley and education",
  "Thou",
  "Hair's breadth",
  "Longest English sentence",
  "... Not!",
  "Tautophrase",
  "Penthouse principle",
  "Nominative absolute",
  "Substitution table",
  "Reed–Kellogg sentence diagram",
]);

function isBlocked(title) {
  if (BLOCKED_TITLES.has(title)) return true;
  return (
    /\(disambiguation\)$/i.test(title) ||
    /^List of /i.test(title)           ||
    /^Index of /i.test(title)          ||
    /history of /i.test(title)         ||
    /^Timeline/i.test(title)           ||
    /^Wikipedia:/i.test(title)         ||
    /^Template:/i.test(title)          ||
    /^Help:/i.test(title)
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const API_USER_AGENT =
  "IGT-Grammar-Indexer/2.0 (educational; mailto:ievertan00@gmail.com)";

/** HTTP GET → parsed JSON. Retries up to 3× on network errors. */
async function getJSON(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": API_USER_AGENT } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(getJSON(res.headers.location, attempt));
      }
      const parts = [];
      res.on("data", c => parts.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(parts).toString())); }
        catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Request timed out")); });
  }).catch(async (err) => {
    const transient =
      err.message.includes("ECONNRESET") || err.message.includes("ETIMEDOUT") ||
      err.message.includes("socket disconnected") || err.message.includes("timed out");
    if (transient && attempt < 3) {
      await sleep((attempt + 1) * 800);
      return getJSON(url, attempt + 1);
    }
    throw err;
  });
}

// ── Wikipedia article fetching ────────────────────────────────────────────────

const MIN_CHUNK = 200; // chars — drop sections shorter than this

async function fetchArticle(page) {
  const url =
    "https://en.wikipedia.org/w/api.php" +
    "?action=query" +
    `&titles=${page}` +
    "&prop=extracts" +
    "&explaintext=1" +
    "&exsectionformat=wiki" +
    "&redirects=1" +
    "&format=json";
  const data = await getJSON(url);
  const pages = data?.query?.pages ?? {};
  const found = Object.values(pages)[0];
  if (!found || "missing" in found) return null;
  return { title: found.title, extract: found.extract ?? "" };
}

function splitSections(extract) {
  const HEADING = /\n+(={2,4})\s*(.+?)\s*\1\n+/g;
  const chunks = [];
  let lastIndex = 0;
  let currentSection = "Introduction";
  let sectionIndex = 0;

  for (const m of extract.matchAll(HEADING)) {
    const text = extract.slice(lastIndex, m.index).trim();
    if (text.length >= MIN_CHUNK) {
      chunks.push({ section: currentSection, content: text });
    }
    currentSection = m[2].trim();
    lastIndex = m.index + m[0].length;
    sectionIndex++;
  }

  const tail = extract.slice(lastIndex).trim();
  if (tail.length >= MIN_CHUNK) {
    chunks.push({ section: currentSection, content: tail });
  }
  return chunks;
}

/** Fetch all page titles in a Wikipedia category (type=page only). */
async function fetchCategoryMembers(category) {
  const url =
    "https://en.wikipedia.org/w/api.php" +
    "?action=query" +
    "&list=categorymembers" +
    `&cmtitle=Category:${encodeURIComponent(category)}` +
    "&cmtype=page" +
    "&cmlimit=500" +
    "&format=json";
  const data = await getJSON(url);
  return (data?.query?.categorymembers ?? []).map(m => m.title);
}

/**
 * Build the full article queue:
 *   seeds + category-discovered articles (deduped, blocklist-filtered).
 */
async function buildArticleQueue() {
  // Seed pages keyed by normalised title for dedup
  const seen = new Set(SEEDS.map(s => s.page.toLowerCase()));
  const queue = [...SEEDS];

  console.log("  🔍 Discovering articles from Wikipedia categories…");

  for (const cat of DISCOVERY_CATEGORIES) {
    let titles;
    try {
      titles = await fetchCategoryMembers(cat);
    } catch (err) {
      console.log(`     ⚠️  Category:${cat} — ${err.message}`);
      await sleep(200);
      continue;
    }

    let added = 0;
    for (const title of titles) {
      if (isBlocked(title)) continue;
      const pageKey = title.replace(/ /g, "_").toLowerCase();
      if (seen.has(pageKey)) continue;
      seen.add(pageKey);
      queue.push({ page: title.replace(/ /g, "_"), book: title });
      added++;
    }
    console.log(`     Category:${cat} → ${titles.length} found, ${added} new`);
    await sleep(150);
  }

  console.log(`  📋 Total articles to index: ${queue.length}\n`);
  return queue;
}

// ── EGP (English Grammar Profile) ────────────────────────────────────────────

/**
 * Read the EGP Excel file and return grammar_chunks rows.
 * Columns: id, SuperCategory, SubCategory, Level, Lexical Range,
 *          Guideword, Can-do statement, Example
 */
async function readEGP(xlsxPath) {
  const { read, utils } = await import("xlsx");
  const wb   = read(fs.readFileSync(xlsxPath));
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = utils.sheet_to_json(ws, { header: 1 });

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => String(h).toLowerCase().trim());
  const col = name => headers.findIndex(h => h.includes(name));

  const superIdx  = col("supercategory");
  const subIdx    = col("subcategory");
  const levelIdx  = col("level");
  const guideIdx  = col("guideword");
  const stmtIdx   = col("can-do");
  const exIdx     = col("example");

  if (levelIdx < 0 || stmtIdx < 0) {
    throw new Error("EGP: cannot locate required columns (level, can-do statement)");
  }

  const chunks = [];

  for (let i = 1; i < rows.length; i++) {
    const r         = rows[i];
    const level     = String(r[levelIdx] ?? "").trim();
    const superCat  = superIdx  >= 0 ? String(r[superIdx]  ?? "").trim() : "";
    const subCat    = subIdx    >= 0 ? String(r[subIdx]    ?? "").trim() : "";
    const guide     = guideIdx  >= 0 ? String(r[guideIdx]  ?? "").trim() : "";
    const statement = String(r[stmtIdx] ?? "").trim();
    const rawEx     = exIdx >= 0 ? String(r[exIdx] ?? "").trim() : "";

    if (!level || !statement) continue;

    // Strip corpus annotations — "(A2 WAYSTAGE; 2009; Polish; Pass)" etc.
    const examples = rawEx
      .split(/\n+/)
      .map(l => l.replace(/\s*\([^)]+\)\s*$/, "").trim())
      .filter(l => l.length > 5);

    const section = [level, superCat, guide].filter(Boolean).join(" — ");

    const contentParts = [
      `[${level}]${superCat ? " " + superCat : ""}${subCat ? " > " + subCat : ""}`,
      "",
      statement,
    ];
    if (examples.length) {
      contentParts.push("", "Examples:");
      for (const ex of examples) contentParts.push(`  • ${ex}`);
    }
    const content = contentParts.join("\n").trim();
    if (content.length < 20) continue;

    chunks.push({ section, content });
  }

  return chunks;
}

// ── DB schema ─────────────────────────────────────────────────────────────────

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

async function main() {
  console.log("\n🌐 IGT Grammar DB Indexer");
  console.log("═".repeat(52));
  console.log(`   Target : ${dryRun ? "(dry run — no DB write)" : booksDbPath}`);
  console.log(`   EGP    : ${egpPath ? path.basename(egpPath) : "not found — skipping"}`);
  console.log("");

  // ── Setup DB ────────────────────────────────────────────────────────────────
  let db = null;
  let insertStmt = null;
  let insertMany = null;

  if (!dryRun) {
    if (fs.existsSync(booksDbPath)) fs.unlinkSync(booksDbPath);
    ["grammar_ref.db-wal", "grammar_ref.db-shm"].forEach(f => {
      const p = path.join(path.dirname(booksDbPath), f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    db = new Database(booksDbPath);
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA_SQL);
    insertStmt = db.prepare(
      "INSERT INTO grammar_chunks (article, section, content) VALUES (@article, @section, @content)"
    );
    insertMany = db.transaction(rows => { for (const r of rows) insertStmt.run(r); });
  }

  let wikiChunks = 0;
  let wikiArticles = 0;
  let egpChunks = 0;

  // ── Source 1: Wikipedia ─────────────────────────────────────────────────────
  console.log("📖 Source 1: Wikipedia");
  console.log("─".repeat(52));

  const queue = await buildArticleQueue();

  for (const article of queue) {
    const label = article.book.length > 36
      ? article.book.slice(0, 34) + "…"
      : article.book;
    process.stdout.write(`  📄 ${label.padEnd(36)}`);

    try {
      const fetched = await fetchArticle(article.page);
      if (!fetched) { console.log("⚠️  not found"); await sleep(120); continue; }

      const chunks = splitSections(fetched.extract);
      if (chunks.length === 0) { console.log("⚠️  0 chunks"); await sleep(120); continue; }

      console.log(`${chunks.length} chunks`);

      if (!dryRun) {
        insertMany(chunks.map(c => ({
          article: article.book,
          section: c.section,
          content: c.content,
        })));
      }

      wikiChunks += chunks.length;
      wikiArticles++;
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }

    await sleep(120);
  }

  // ── Source 2: EGP ──────────────────────────────────────────────────────────
  console.log("\n📖 Source 2: English Grammar Profile (EGP)");
  console.log("─".repeat(52));

  if (!egpPath) {
    console.log("  ⚠️  EGP file not found. To include it:");
    console.log("     1. Register free at https://www.englishgrammarprofile.com/");
    console.log("     2. Download the dataset (Excel)");
    console.log(`     3. Place it at: assets/English Grammar Profile Online.xlsx`);
    console.log("     4. Re-run this script.\n");
  } else {
    process.stdout.write(`  📊 Reading ${path.basename(egpPath)}… `);
    try {
      const chunks = await readEGP(egpPath);
      console.log(`${chunks.length} grammar points`);
      if (!dryRun && chunks.length > 0) {
        insertMany(chunks.map(c => ({
          article: "English Grammar Profile",
          section: c.section,
          content: c.content,
        })));
      }
      egpChunks = chunks.length;
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  // ── Finish ──────────────────────────────────────────────────────────────────
  if (!dryRun && db) {
    console.log("\n🔧 Rebuilding FTS index for BM25 ranking…");
    db.exec("INSERT INTO grammar_chunks_fts(grammar_chunks_fts) VALUES ('rebuild')");
    db.close();
  }

  const total = wikiChunks + egpChunks;
  console.log("\n" + "═".repeat(52));
  console.log(`✅ Wikipedia : ${wikiArticles} articles → ${wikiChunks} chunks`);
  if (egpChunks) console.log(`✅ EGP       : ${egpChunks} grammar points`);
  console.log(`📦 Total     : ${total} chunks`);
  if (!dryRun) {
    console.log(`💾 Saved to  : ${booksDbPath}`);
    console.log("\n💡 Restart the IGT server to activate grammar grounding.");
  }
  console.log("");
}

main().catch(err => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
