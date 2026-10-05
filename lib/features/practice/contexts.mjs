export const PRACTICE_CONTEXTS = [
  "work-email",
  "meeting",
  "customer-issue",
  "daily-routine",
  "travel",
  "social",
  "everyday",
  "work",
  "home-routines",
  "restaurants-cafes",
  "supermarkets-shopping",
  "cinema-entertainment",
  "friends-social",
  "health-pharmacy",
  "work-study",
  "commuting-transit",
  "travel-accommodation",
  "appointments-services",
];

export function normalizePracticeContext(value) {
  const context = String(value || "").trim().toLowerCase();
  return PRACTICE_CONTEXTS.includes(context) ? context : "";
}
