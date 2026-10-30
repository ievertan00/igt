import { getCoachPatterns, explainCoachPattern } from "../../application/grammar-coach.mjs";
import { getLearningOverview } from "../../application/learning-overview.mjs";
import configLoader from "../../shared/config-loader.mjs";

const clean = value => String(value ?? "").replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
const help = {
  coach: 'Usage: /coach [--days 0..3650] [--type "Mistake type"] [--refresh]\nLists recurring mistakes in saved Grammar checks. --type requests an explanation; --refresh regenerates it. No plans or tasks are created.\n',
  stats: 'Usage: /stats [--days 0..3650] [--limit 1..100] [--offset 0]\nShows recorded learning activity by type, then recent activity. Default window: 30 days.\n',
};
export function parseLearningArgs(args, command) {
  const options = {};
  const allowed = command === "coach" ? ["days", "type", "refresh", "help"] : ["days", "limit", "offset", "help"];
  for (let index = 0; index < args.length; index++) {
    const [name, ...parts] = args[index].replace(/^--/, "").split("=");
    if (!args[index].startsWith("--") || !allowed.includes(name)) throw new Error(`Unsupported /${command} option: ${args[index]}. Use /${command} --help. Old report/plan options have been removed.`);
    if (Object.hasOwn(options, name)) throw new Error(`Duplicate option: --${name}.`);
    if (["help", "refresh"].includes(name)) {
      if (parts.length) throw new Error(`--${name} does not take a value.`);
      options[name] = true; continue;
    }
    const value = parts.join("=") || args[++index];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${name}.`);
    if (name !== "type" && !/^\d+$/.test(value)) throw new Error(`--${name} requires an integer.`);
    options[name] = name === "type" ? value : Number(value);
  }
  if (options.refresh && !options.type) throw new Error("Choose --type before requesting --refresh.");
  return options;
}

export async function runCoach(args, { list = getCoachPatterns, explain = explainCoachPattern, getLLMManager = async () => (await import("../../server/llm/init.mjs")).default(), write = value => process.stdout.write(value), writeError = value => process.stderr.write(value) } = {}) {
  try {
    const options = parseLearningArgs(args, "coach");
    if (options.help) { write(help.coach); return 0; }
    const data = await list({ days: options.days ?? 90 });
    const lines = ["Coach · Recurring Grammar mistakes", data.days ? `Last ${data.days} days` : "All history", `${data.checks} saved Grammar check(s).`];
    if (data.coverage.unclassified) lines.push(`${data.coverage.unclassified} record(s) have unclassified origins and are excluded.`);
    if (!options.type) {
      for (const pattern of data.patterns) lines.push(`${pattern.errorType}: ${pattern.checks} affected checks · ${pattern.observations} observations`);
      if (!data.patterns.length) lines.push("No recurring patterns yet. A pattern needs at least two distinct saved Grammar checks.");
      else lines.push('Use /coach --type "Mistake type" with the same --days window to request an explanation.');
    } else {
      const pattern = data.patterns.find(item => item.errorType === options.type);
      if (!pattern) throw new Error("Choose a recurring mistake type from /coach in the same date window.");
      const detail = await explain({ days: data.days, errorType: options.type, version: pattern.version, refresh: Boolean(options.refresh) }, { getLLMManager });
      const explanation = detail.explanation;
      lines.push("", explanation.observedPattern, "", "Possible causes (hypotheses):");
      for (const cause of explanation.possibleCauses) lines.push(`- ${cause.hypothesis} [${cause.evidenceIds.join(", ")}]`);
      lines.push("", "Grammar principle:", explanation.principle, "", "Context and exceptions:", explanation.qualifications, "", "Saved examples:");
      for (const example of explanation.examples) {
        const evidence = detail.evidence.find(item => item.entryId === example.entryId);
        lines.push(`[${example.entryId}] ${evidence.original}`, `Correction: ${evidence.correction || "No correction saved"}`, example.explanation);
      }
      if (detail.sampled) lines.push("The explanation uses a sample of this pattern's saved checks.");
    }
    lines.push("These records do not establish mastery or confirmed psychological causes.");
    write(lines.map(clean).join("\n") + "\n"); return 0;
  } catch (error) { writeError(`Coach: ${clean(error.message)}\n`); return 1; }
}

export async function runOverview(args, { load = options => getLearningOverview(options, { config: configLoader.load() }), write = value => process.stdout.write(value), writeError = value => process.stderr.write(value) } = {}) {
  try {
    const options = parseLearningArgs(args, "stats");
    if (options.help) { write(help.stats); return 0; }
    const data = await load({ days: options.days ?? 30, limit: options.limit ?? 10, offset: options.offset ?? 0 });
    const lines = ["Overview · Recorded learning activity", data.days ? `Last ${data.days} days` : "All history"];
    for (const item of data.summary) lines.push(`${item.label}: ${item.count}`);
    if (!data.summary.length) lines.push("No dated activity recorded in this window.");
    lines.push("", "Recent activity:");
    for (const event of data.events) lines.push(`${event.timestamp} · ${event.type} · ${String(event.title).slice(0, 160)}${event.score != null ? ` · Score ${event.score}` : ""}`);
    if (data.pagination.hasMore) lines.push(`Next page: repeat the same window with --offset ${data.pagination.offset + data.pagination.limit}`);
    for (const pattern of data.patterns) lines.push(`Grammar focus: ${pattern.errorType} (${pattern.checks} checks) — /coach --days ${data.days}`);
    lines.push("", "History coverage:");
    for (const source of data.coverage) lines.push(`${source.source}: ${source.status}${source.count != null ? ` (${source.count})` : ""}. ${source.note}`);
    if (data.undated) lines.push(`${data.undated} undated record(s) are not placed in the timeline.`);
    write(lines.map(clean).join("\n") + "\n"); return 0;
  } catch (error) { writeError(`Overview: ${clean(error.message)}\n`); return 1; }
}
