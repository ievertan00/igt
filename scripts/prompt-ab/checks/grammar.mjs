// Deterministic contract checks for Grammar output. "hard" failures mean the
// production contract is broken; "soft" findings are quality signals for trends.
const norm = value => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

function lineCoverage(input, correction) {
  const lines = String(input).split(/\r?\n/).map(line => line.trim()).filter(line => line.length >= 4);
  if (!lines.length) return 1;
  const target = norm(correction);
  let covered = 0;
  for (const line of lines) {
    const words = norm(line).split(" ").filter(word => word.length >= 3);
    if (!words.length) { covered++; continue; }
    const hit = words.filter(word => target.includes(word)).length / words.length;
    if (hit >= 0.6) covered++;
  }
  return covered / lines.length;
}

export function checkGrammar({ input, output, expectations = {} }) {
  const checks = [];
  const add = (id, level, pass, detail = "") => checks.push({ id, level, pass, detail });
  const correction = output.correction || "";
  const refine = output.refine || "";
  const diagnoses = Array.isArray(output.diagnoses) ? output.diagnoses : [];

  add("refine_nonempty", "hard", refine.trim().length > 0 && !/no alternative wording/i.test(refine),
    refine ? "" : "refine is empty or a placeholder");

  const identical = norm(correction) === norm(input);
  add("correction_not_echo", "hard", !correction.trim() || !identical,
    identical ? "correction repeats the input verbatim" : "");

  if (correction.trim()) {
    const coverage = lineCoverage(input, correction);
    add("correction_complete", "hard", coverage >= 0.9, `line coverage ${(coverage * 100).toFixed(0)}%`);
  }

  const cleanExpected = expectations.clean === true;
  if (cleanExpected) {
    add("clean_input_no_correction", "hard", !correction.trim(), correction ? `correction: ${correction.slice(0, 120)}` : "");
  }

  add("diagnoses_valid", "hard",
    diagnoses.every(item => item.error_type && ["Minor", "Moderate", "Major"].includes(item.severity) && item.explanation),
    diagnoses.some(item => !item.error_type || !item.explanation) ? "diagnosis missing error_type/explanation" : "");

  if (correction.trim() && !identical) {
    add("why_present", "soft", diagnoses.length > 0, "correction differs from input but diagnoses is empty");
  }

  if (expectations.mustFix && expectations.mustFix.length) {
    // mustFix lists erroneous fragments that must NOT survive into the correction.
    const surviving = expectations.mustFix.filter(fragment => norm(correction).includes(norm(fragment)));
    add("expected_errors_fixed", "hard", surviving.length === 0, surviving.length ? `still present: ${surviving.join("; ")}` : "");
  }

  if (expectations.mustKeep && expectations.mustKeep.length) {
    const missing = expectations.mustKeep.filter(fragment => !norm(correction || input).includes(norm(fragment)));
    add("facts_preserved", "hard", missing.length === 0, missing.length ? `lost from correction: ${missing.join("; ")}` : "");
  }

  const remember = Array.isArray(output.remember) ? output.remember.join(" ") : String(output.remember || "");
  add("tip_present", "soft", remember.trim().length > 0, "");

  return checks;
}