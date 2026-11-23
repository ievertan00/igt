// Deterministic checks for Coach reports. Structural validity (five sections,
// eight subsections, citation integrity) is already enforced inside
// generateCoachReport — a failed call surfaces as call_succeeded=false. These
// checks add the boundary rules the validator does not cover.
const hanCount = text => (String(text).match(/\p{Script=Han}/gu) || []).length;
const stripCode = text => String(text).replace(/```[\s\S]*?```/g, "").replace(/`[^`]*`/g, "");

function section(markdown, number) {
  const match = markdown.match(new RegExp(`^##\\s+${number}\\.\\s+[^\\n]*\\n([\\s\\S]*?)(?=^##\\s+\\d+\\.|$)`, "m"));
  return match ? match[1] : "";
}

export function checkCoach({ markdown, language, evidence = [], expectations = {} }) {
  const checks = [];
  const add = (id, level, pass, detail = "") => checks.push({ id, level, pass, detail });

  add("report_nonempty", "hard", typeof markdown === "string" && markdown.trim().length > 0, "");

  const prose = stripCode(markdown);
  if (language === "zh-CN") {
    add("language_zh", "hard", hanCount(prose) >= 100, `only ${hanCount(prose)} Han characters in prose`);
  }

  const recommendations = section(markdown, 5);
  const planPattern = /学习计划|学习日程|阶段目标|每日任务|study plan|weekly schedule|daily task|phase goal|practice schedule/i;
  add("no_study_plan", "hard", !planPattern.test(recommendations), "section 5 contains plan/schedule language");

  const scope = section(markdown, 2);
  const statsPattern = /\b\d+\s*(records|checks|entries|samples|条记录|次检查|条样本)|\d+%|completeness|覆盖率|duplicate[- ]input count/i;
  add("scope_no_pipeline_stats", "soft", !statsPattern.test(scope), "section 2 mentions pipeline statistics");

  const cited = new Set([...markdown.matchAll(/\[(S\d+(?:[–—-]S?\d+)?)\]/g)].map(match => match[1]));
  add("citations_present", "hard", cited.size > 0, "");
  const labels = new Set(evidence.map((_, index) => `S${index + 1}`));
  const invented = [...cited].filter(label => !labels.has(label) && !/^S\d+[–—-]S?\d+$/.test(label));
  add("citations_valid", "hard", invented.length === 0, invented.length ? `unknown labels: ${invented.join(", ")}` : "");

  if (expectations.mustMention && expectations.mustMention.length) {
    const lower = markdown.toLowerCase();
    const missing = expectations.mustMention.filter(fragment => !lower.includes(String(fragment).toLowerCase()));
    add("expected_content", "soft", missing.length === 0, missing.length ? `not mentioned: ${missing.join("; ")}` : "");
  }

  return checks;
}