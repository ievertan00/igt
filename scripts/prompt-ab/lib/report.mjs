import { dimensionBreakdown } from "./aggregate.mjs";
import { RUBRICS } from "./judge.mjs";

const fmtP = value => (value <= 0.001 ? "<0.001" : value.toFixed(3));
const clip = (text, limit = 6000) => {
  const value = String(text ?? "");
  return value.length > limit ? `${value.slice(0, limit)}\n…[truncated — full output in outputs/ directory]` : value;
};

function hardFailures(result) {
  if (!result) return ["(missing)"];
  if (!result.ok) return [`call failed: ${result.error}`];
  return result.checks.filter(check => check.level === "hard" && !check.pass).map(check => `${check.id}${check.detail ? ` (${check.detail})` : ""}`);
}

function softFindings(result) {
  if (!result?.ok) return [];
  return result.checks.filter(check => check.level === "soft" && !check.pass).map(check => check.id);
}

function caseTable(pair) {
  const rows = ["| Case | Winner | Source | Repeat verdicts | Hard failures (A → B) |", "|---|---|---|---|---|"];
  for (const item of pair.summary.cases) {
    const repeats = item.repeats.map(repeat => repeat.winner).join(", ");
    const last = item.repeats.at(-1);
    const fails = last ? `${last.hardFailA.length} → ${last.hardFailB.length}` : "-";
    rows.push(`| ${item.caseId} | ${item.winner === "tie" ? "tie" : item.winner === "a" ? pair.a : pair.b} | ${item.source} | ${repeats} | ${fails} |`);
  }
  return rows.join("\n");
}

function dimensionTable(target, pair) {
  const tally = dimensionBreakdown(pair.allJudgments);
  const rows = ["| Dimension | baseline wins | candidate wins | tie |", "|---|---|---|---|"];
  for (const [name] of RUBRICS[target]) {
    const entry = tally[name] || { a: 0, b: 0, tie: 0 };
    rows.push(`| ${name} | ${entry.a} | ${entry.b} | ${entry.tie} |`);
  }
  return rows.join("\n");
}

export function buildReport(run) {
  const lines = [];
  lines.push(`# Prompt A/B Report — ${run.id}`);
  lines.push("");
  lines.push(`- Started: ${run.startedAt}`);
  lines.push(`- Generation provider: ${run.models.provider} (grammar: ${run.models.grammar}, ask: ${run.models.ask}, coach: ${run.models.coach})`);
  lines.push(`- Judge: ${run.judge ? `${run.judge.provider} / ${run.judge.model}` : "disabled (--no-judge)"}`);
  lines.push(`- Repeats per case: ${run.repeat}`);
  lines.push("");
  lines.push("Variant prompt hashes (sha256-16) are in manifest.json; identical hashes mean identical prompts.");
  lines.push("");

  for (const [target, targetRun] of Object.entries(run.targets)) {
    lines.push(`## ${target}`);
    lines.push("");
    if (!targetRun.pairs.length) {
      lines.push("_No pairs evaluated._");
      continue;
    }
    for (const pair of targetRun.pairs) {
      const { summary } = pair;
      lines.push(`### ${pair.a} (A) vs ${pair.b} (B)`);
      lines.push("");
      lines.push(`**Verdict: ${summary.recommendation}**`);
      lines.push("");
      lines.push(`- Case wins: A ${summary.losses} / B ${summary.wins} / tie ${summary.ties} (decisive ${summary.decisive})`);
      lines.push(`- Sign test p-value: ${fmtP(summary.pValue)}`);
      lines.push(`- Hard-contract failure delta (B − A, last repeat): ${summary.hardFailDelta}`);
      const avg = side => {
        const values = Object.values(pair.caseResults).flatMap(repeats => repeats.map(item => item[side]?.ms).filter(Number.isFinite));
        return values.length ? Math.round(values.reduce((total, value) => total + value, 0) / values.length) : null;
      };
      lines.push(`- Mean latency: A ${avg("a") ?? "-"} ms, B ${avg("b") ?? "-"} ms`);
      lines.push("");
      lines.push(caseTable(pair));
      lines.push("");
      if (run.judge) {
        lines.push("Dimension breakdown (both presentation orders counted):");
        lines.push("");
        lines.push(dimensionTable(target, pair));
        lines.push("");
      }
      const failDetails = [];
      for (const [caseId, repeats] of Object.entries(pair.caseResults)) {
        const last = repeats.at(-1);
        for (const [side, label] of [["a", pair.a], ["b", pair.b]]) {
          const failures = hardFailures(last?.[side]);
          if (failures.length) failDetails.push(`- ${caseId} / ${label}: ${failures.join("; ")}`);
          const soft = softFindings(last?.[side]);
          if (soft.length) failDetails.push(`- ${caseId} / ${label} (soft): ${soft.join(", ")}`);
        }
      }
      if (failDetails.length) {
        lines.push("Contract findings (last repeat):");
        lines.push("");
        lines.push(failDetails.join("\n"));
        lines.push("");
      }
      lines.push("<details><summary>Side-by-side outputs (first repeat, for human review)</summary>");
      lines.push("");
      for (const [caseId, repeats] of Object.entries(pair.caseResults)) {
        const first = repeats[0];
        lines.push(`#### ${caseId}`);
        lines.push("");
        lines.push(`**A (${pair.a}):**`);
        lines.push("");
        lines.push("```");
        lines.push(clip(targetRun.renderOutput(first?.a)));
        lines.push("```");
        lines.push("");
        lines.push(`**B (${pair.b}):**`);
        lines.push("");
        lines.push("```");
        lines.push(clip(targetRun.renderOutput(first?.b)));
        lines.push("```");
        lines.push("");
        if (first?.judgment?.judgments) {
          for (const order of first.judgment.judgments) {
            lines.push(`Judge (${order.order}, overall ${order.overall}, ${order.confidence}): ${order.dimensions.map(dimension => `${dimension.name}=${dimension.winner}`).join(", ")}`);
          }
          lines.push("");
        }
      }
      lines.push("</details>");
      lines.push("");
    }
  }

  lines.push("## Next steps");
  lines.push("");
  lines.push("1. Spot-check the side-by-side outputs above; record disagreements in human-verdicts.json, then re-run with --report-only.");
  lines.push("2. If the candidate wins: copy its prompt into production (config Prompts / coach SYSTEM), run the regular test suites, and keep the variant directory as the new baseline reference.");
  lines.push("3. If results are ambiguous: add repeats (--repeat) or cases before deciding.");
  lines.push("");
  return lines.join("\n");
}