import focuses from "./language-focuses.json" with { type: "json" };
import { legacyQuestions } from "./canonical-bank.mjs";

// Compatibility view for migration 022. Content comes from the live-DB export.
export const LANGUAGE_FOCUSES = focuses;
export const LANGUAGE_PRACTICE_QUESTIONS = legacyQuestions(["clear-cue", "contrast", "transfer"]);
