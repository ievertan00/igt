// CLI recall policy: case-insensitive; spaces and hyphens do not affect spelling.
export function normalizeVocabAnswer(value) {
  return String(value || "").toLowerCase().replace(/[\s-]/g, "");
}

export function isVocabularyRecallCorrect(answer, word) {
  return String(answer || "").trim().length > 0
    && normalizeVocabAnswer(answer) === normalizeVocabAnswer(word);
}
