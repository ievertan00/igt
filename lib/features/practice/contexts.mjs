// Storage and filters use concise one-word context labels. Historical labels are
// accepted at input boundaries and normalized before they are stored or queried.
export const PRACTICE_CONTEXTS = [
  "home", "dining", "shopping", "entertainment", "social",
  "health", "work", "transit", "travel", "services",
];

const aliases = new Map([
  ["home-routines", "home"], ["daily-routine", "home"],
  ["restaurants-cafes", "dining"],
  ["supermarkets-shopping", "shopping"],
  ["cinema-entertainment", "entertainment"],
  ["friends-social", "social"], ["health-pharmacy", "health"],
  ["work-study", "work"], ["work-email", "work"], ["meeting", "work"],
  ["customer-issue", "work"], ["commuting-transit", "transit"],
  ["travel-accommodation", "travel"],
  ["appointments-services", "services"], ["everyday", "home"],
]);

export function normalizePracticeContext(value) {
  const context = String(value || "").trim().toLowerCase();
  if (PRACTICE_CONTEXTS.includes(context)) return context;
  return aliases.get(context) || "";
}
