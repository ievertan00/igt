export const PRACTICE_CONTEXTS = [
  "work-email",
  "meeting",
  "customer-issue",
  "daily-routine",
  "travel",
  "social",
];

export function normalizePracticeContext(value) {
  const context = String(value || "").trim().toLowerCase();
  return PRACTICE_CONTEXTS.includes(context) ? context : "";
}
