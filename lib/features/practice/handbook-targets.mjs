// Explicit learning opportunities from the bank's metadata, never sentence-text guesses.
const points = (...values) => ({ field: "grammar_point", values: values.flatMap((value) => [value, `${value} (complex)`]).map((value) => value.toLowerCase()) });
const targets = [
  { names: ["Grammar / Article Usage", "Article Usage", "Articles"], label: "Article choices", rules: [points("Articles", "Indefinite article with zero article choice", "Indefinite articles for first mention")] },
  { names: ["Grammar / Verb Tense", "Verb Tense", "Tense"], label: "Tense and aspect", rules: [{ field: "tense_aspect", values: null }] },
  { names: ["Grammar / Subject-Verb Agreement", "Subject-Verb Agreement"], label: "Subject–verb agreement", rules: [points("Subject-verb agreement", "Subject–verb agreement")] },
  { names: ["Grammar / Pronoun Usage", "Pronoun Usage"], label: "Pronoun reference", rules: [points("Pronoun reference")] },
  { names: ["Grammar / Preposition Usage", "Preposition Usage"], label: "Preposition choices", rules: [points("Dependent prepositions", "Verb + preposition", "Prepositions followed by -ing forms", "Prepositional directions", "Prepositional phrase for location", "Prepositional phrase for purpose")] },
  { names: ["Grammar / Conjunction/Connector", "Conjunction/Connector"], label: "Connecting ideas", rules: [{ field: "conjunction_type", values: null }] },
  { names: ["Grammar / Modifier Placement", "Modifier Placement"], label: "Modifier placement", rules: [points("Modifier position")] },
  { names: ["Grammar / Sentence Structure", "Sentence Structure"], label: "Sentence structures", rules: [{ field: "sentence_structure", values: null }] },
  { names: ["Grammar / Parallel Structure", "Parallel Structure"], label: "Parallel structures", rules: [points("Parallelism", "Parallel alternatives")] },
  { names: ["Grammar / Word Form", "Word Form"], label: "Word forms", rules: [points("Word formation", "Adjective/adverb choice")] },
  { names: ["Grammar / Comparison", "Comparison"], label: "Comparisons", rules: [points("Comparative/superlative", "Equal comparison", "Comparison clauses", "Comparative adjectives")] },
  { names: ["Grammar / Negation", "Negation"], label: "Negative scope", rules: [points("Negative scope")] },
  { names: ["Vocabulary / Word Choice", "Word Choice"], label: "Word choices", rules: [points("Word choice")] },
  { names: ["Vocabulary / Collocation", "Collocation"], label: "Collocations", rules: [points("Collocation")] },
  { names: ["Style / Voice (Active/Passive)", "Voice (Active/Passive)"], label: "Active and passive voice", rules: [{ field: "voice", values: ["passive"] }, points("Active/passive choice")] },
];

export function getHandbookPracticeTarget(errorType) {
  if (typeof errorType !== "string") return null;
  const name = errorType.trim().toLowerCase();
  return targets.find((target) => target.names.some((candidate) => candidate.toLowerCase() === name)) || null;
}

export function matchesHandbookTarget(question, errorType) {
  const target = getHandbookPracticeTarget(errorType);
  return Boolean(target?.rules.some(({ field, values }) => {
    const actual = question.practice_fields?.[field];
    return Array.isArray(actual) && actual.some((value) => typeof value === "string" && (!values || values.includes(value.toLowerCase())));
  }));
}

export function handbookTargetSql(errorType) {
  const target = getHandbookPracticeTarget(errorType);
  if (!target) return { sql: "0", params: [] };
  const params = [];
  const clauses = target.rules.map(({ field, values }) => {
    params.push(`$.${field}`);
    if (!values) return "EXISTS (SELECT 1 FROM json_each(practice_fields_json, ?) WHERE type = 'text')";
    params.push(...values);
    return `EXISTS (SELECT 1 FROM json_each(practice_fields_json, ?) WHERE type = 'text' AND lower(value) IN (${values.map(() => "?").join(",")}))`;
  });
  return { sql: `(${clauses.join(" OR ")})`, params };
}
