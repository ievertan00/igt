import { getGrammarHistory } from "../../application/grammar-history.mjs";

export const HANDBOOK_HELP = `Usage: /handbook [options]
Browse saved Grammar checks, newest first. No reports are generated.
  --days 0..3650       Date window (default: 90; 0: all history)
  --search "text"     Search saved text and feedback
  --type "Articles"   Filter by exact mistake type
  --diagnosis all|with|none
                       All checks, with diagnoses, or no diagnosed mistakes
  --limit 1..100       Checks per page (default: 10)
  --offset 0          Skip matching checks
  --help              Show this help
Examples:
  /handbook --diagnosis none
  /handbook --days 0 --search "a book" --limit 5
No diagnosed mistakes describes saved feedback; it does not establish mastery.
`;

const removed = new Set(["--incremental", "-i", "--format", "--cache-stats", "--clear-cache", "-c"]);
const names = new Map([["--days", "days"], ["--search", "search"], ["--type", "errorType"], ["--diagnosis", "diagnosis"], ["--limit", "limit"], ["--offset", "offset"]]);

export function parseHandbookArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    const equals = argument.indexOf("=");
    const name = equals < 0 ? argument : argument.slice(0, equals);
    if (removed.has(name)) throw new Error(`${name} was removed. /handbook now browses saved Grammar checks. Use /handbook --help.`);
    if (name === "--help" && equals < 0) { options.help = true; continue; }
    const key = names.get(name);
    if (!key) throw new Error(`Unknown Handbook option: ${name}. Use /handbook --help.`);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option: ${name}.`);
    // The interactive dispatcher splits --search="two words" into --search= and its quoted value.
    let value = equals < 0 ? undefined : argument.slice(equals + 1);
    if (!value) {
      value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}.`);
    }
    if (["days", "limit", "offset"].includes(key) && !/^\d+$/.test(value)) throw new Error(`${name} requires a non-negative integer.`);
    options[key] = value;
  }
  return options;
}

function printable(value) {
  return String(value ?? "").replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
}

export function renderHandbookHistory(result) {
  const { pagination: page, coverage } = result;
  const lines = ["Handbook · Saved Grammar checks", result.days ? `Window: last ${result.days} days` : "Window: all history"];
  if (result.search) lines.push(`Search: ${result.search}`);
  if (result.errorType) lines.push(`Mistake type: ${result.errorType}`);
  if (result.diagnosis !== "all") lines.push(`Diagnoses: ${result.diagnosis === "none" ? "No diagnosed mistakes" : "With diagnoses"}`);
  lines.push(`${page.total} matching check(s).`);
  if (coverage.unclassified) lines.push(`${coverage.unclassified} record(s) have unclassified origins and are excluded. Existing records are preserved.`);
  if (coverage.undated && result.days) lines.push(`${coverage.undated} undated record(s) cannot be placed in this date window.`);
  if (!result.entries.length) lines.push(coverage.grammar ? "No checks match this page. Try fewer filters or --offset 0." : "No source-identified saved Grammar checks in this window. Save a Grammar result or try --days 0.");
  for (const entry of result.entries) {
    lines.push("", `--- ${entry.timestamp || "Date unknown"} · ${entry.entryId} ---`, "Original:", entry.userInput || entry.original_text || "");
    for (const [label, value] of [["Correction", entry.correction], ["More natural", entry.refine], ["Evaluation", entry.evaluate]]) {
      if (value) lines.push(`${label}:`, value);
    }
    if (!entry.diagnoses?.length) lines.push("No diagnosed mistakes in saved feedback.");
    for (const item of entry.diagnoses || []) {
      lines.push(`${item.error_type}${item.severity ? ` (${item.severity})` : ""}: ${item.explanation || ""}`);
      if (item.evidence) lines.push(`Evidence: ${item.evidence}`);
      if (item.suggestion) lines.push(`Suggestion: ${item.suggestion}`);
    }
    if (entry.remember) lines.push("Remember:", Array.isArray(entry.remember) ? entry.remember.join("\n") : entry.remember);
  }
  if (result.entries.length) lines.push("", `Showing ${page.offset + 1}–${page.offset + result.entries.length} of ${page.total}.`);
  if (page.hasMore) lines.push(`Next page: repeat the same filters with --offset ${page.offset + page.limit}`);
  return lines.map(printable).join("\n") + "\n";
}

export function runHandbook(args, { loadHistory = getGrammarHistory, write = (value) => process.stdout.write(value), writeError = (value) => process.stderr.write(value) } = {}) {
  try {
    const options = parseHandbookArgs(args);
    if (options.help) { write(HANDBOOK_HELP); return 0; }
    write(renderHandbookHistory(loadHistory(options)));
    return 0;
  } catch (error) {
    writeError(`Handbook: ${printable(error.message)}\n`);
    return 1;
  }
}
