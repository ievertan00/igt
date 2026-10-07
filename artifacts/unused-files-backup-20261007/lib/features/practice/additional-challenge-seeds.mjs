import { legacyQuestions } from "./canonical-bank.mjs";

// Only the 90 + 10 additions retained in the authoritative live database.
// No generated IDs, conflicting c1/c3 entries or unapproved top-up drafts.
export const ADDITIONAL_CHALLENGE_QUESTIONS = legacyQuestions(["complex-extra"]);
export const TOP_UP_CHALLENGE_QUESTIONS = legacyQuestions(["complex-extra-2"]);
