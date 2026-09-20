const RULES = [
  {
    match: /^Grammar \/ Article Usage$/i,
    title: "Articles: a, an, and the",
    content: "Use a/an for a singular countable noun introduced as one of many; use the when the listener can identify the specific noun. Do not add an article before most uncountable or plural nouns when speaking generally.",
  },
  {
    match: /Verb Tense|Aspect/i,
    title: "Verb tense and time reference",
    content: "Choose the tense from the time reference and whether the event is finished, ongoing, or connected to the present. A finished time such as yesterday or in 2020 normally calls for the simple past.",
  },
  {
    match: /Preposition|Conjunction/i,
    title: "Prepositions and connectors",
    content: "Learn prepositions and connectors as part of the phrase they introduce. Check whether the relationship is time, place, direction, cause, contrast, or addition before choosing the word.",
  },
  {
    match: /Agreement/i,
    title: "Subject–verb agreement",
    content: "Find the head of the subject before choosing the verb form. Ignore intervening prepositional phrases and relative clauses when checking singular and plural agreement.",
  },
  {
    match: /Word Form/i,
    title: "Word forms",
    content: "Use the grammatical role in the sentence to choose the form: noun, verb, adjective, or adverb. Check common suffixes and the words that normally occur before or after the blank.",
  },
];

export function getStaticGrammarRule(errorType) {
  const value = String(errorType || "").trim();
  const rule = RULES.find((candidate) => candidate.match.test(value));
  return rule ? { title: rule.title, content: rule.content } : null;
}

export function listStaticGrammarRules() {
  return RULES.map(({ match, ...rule }) => ({ ...rule }));
}
