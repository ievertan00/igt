export const VOCABULARY_EXAMPLE_GUIDANCE = "Each example must demonstrate the word's actual meaning in a specific, plausible situation. Vary sentence structure, subjects, and relevant contexts across the three examples; use natural collocations and inflections. For specialist terms, stay within appropriate domains. Do not merely quote the word or say that people used, discussed, or learned it. Never fill example slots with reusable word-substitution templates or generic statements about context. For grammar terms or prefixes, show a concrete construction or derived word. If a useful example is unavailable, leave that field empty.";

export function hasUsableVocabularyExamples(values) {
  const examples = values.filter(value => typeof value === "string" && value.trim());
  const normalized = examples.map(value => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim());
  return new Set(normalized).size === normalized.length
    && !examples.some(value => /in a practical context,?\s+the team used\b/i.test(value)
      || /the discussion gave learners another useful context for understanding\b/i.test(value));
}
