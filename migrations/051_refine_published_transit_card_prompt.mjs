import { applyReviewedRevisions } from "./049_reviewed_practice_prompt_refinements.mjs";

export function up(db) {
  return applyReviewedRevisions(db);
}
