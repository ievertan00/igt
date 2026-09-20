const CONTEXT_RULES = [
  ["work-email", /\b(email|subject line|attachment|attach|reply|follow[- ]?up|deadline|inbox)\b/i],
  ["meeting", /\b(meeting|agenda|minutes|schedule|attendee|presentation|stand[- ]?up)\b/i],
  ["customer-issue", /\b(customer|client|ticket|complaint|bug|support request|issue)\b/i],
  ["daily-routine", /\b(breakfast|commute|morning|usually|every day|dinner|wake up|go to work|at home)\b/i],
  ["travel", /\b(flight|airport|hotel|passport|luggage|train|trip|vacation|travel)\b/i],
  ["social", /\b(friend|party|invite|invitation|hang out|weekend plans|birthday)\b/i],
];

export function inferLearningContext(text) {
  const source = String(text || "").trim();
  const matches = CONTEXT_RULES.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
  if (matches.length !== 1) {
    return {
      label: null,
      confidence: matches.length > 1 ? "ambiguous" : "none",
      source: "heuristic",
      evidence: matches,
    };
  }
  return { label: matches[0], confidence: "high", source: "heuristic", evidence: matches };
}
