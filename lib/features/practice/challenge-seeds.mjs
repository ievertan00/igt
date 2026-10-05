import { legacyQuestions } from "./canonical-bank.mjs";

// Compatibility view for migration 024; never regenerate IDs from focus counts.
export const CHALLENGE_PRACTICE_QUESTIONS = legacyQuestions(["complex"]);
