/**
 * MECE Error Type Classification System
 *
 * Maps LLM free-text diagnoses to a predefined, mutually exclusive set of
 * error types. Ensures consistent tracking and eliminates redundancy.
 */

const CATEGORIES = {
  GRAMMAR: "Grammar",
  VOCAB: "Vocabulary",
  MECHANICS: "Mechanics",
  STYLE: "Style",
  CLARITY: "Clarity",
};

export const ERROR_TYPES = {
  // === GRAMMAR (structural rules) ===
  GRAMMAR_ARTICLE: "Article Usage",
  GRAMMAR_TENSE: "Verb Tense",           // covers tense, aspect, participle, gerund/infinitive
  GRAMMAR_SUBJECT_VERB: "Subject-Verb Agreement",
  GRAMMAR_PRONOUN: "Pronoun Usage",
  GRAMMAR_PREPOSITION: "Preposition Usage",
  GRAMMAR_CONJUNCTION: "Conjunction/Connector",
  GRAMMAR_MODIFIER: "Modifier Placement",
  GRAMMAR_SENTENCE_STRUCTURE: "Sentence Structure",
  GRAMMAR_PARALLELISM: "Parallel Structure",
  GRAMMAR_WORD_FORM: "Word Form",
  GRAMMAR_COMPARISON: "Comparison",
  GRAMMAR_NEGATION: "Negation",

  // === VOCABULARY (word choice) ===
  VOCAB_WORD_CHOICE: "Word Choice",
  VOCAB_COLLOCATION: "Collocation",
  VOCAB_IDIOM: "Idiomatic Expression",
  VOCAB_REDUNDANCY: "Redundancy",

  // === MECHANICS (surface errors) ===
  MECHANICS_SPELLING: "Spelling",
  MECHANICS_PUNCTUATION: "Punctuation",
  MECHANICS_CAPITALIZATION: "Capitalization",
  MECHANICS_SPACING: "Spacing & Formatting",

  // === STYLE (readability & flow) ===
  STYLE_PHRASING: "Phrasing",
  STYLE_CONCISENESS: "Conciseness",
  STYLE_TONE: "Tone & Register",
  STYLE_REPETITION: "Repetition",
  STYLE_VOICE: "Voice (Active/Passive)",

  // === CLARITY (meaning & understanding) ===
  CLARITY_AMBIGUITY: "Ambiguity",
  CLARITY_REFERENCE: "Unclear Reference",
  CLARITY_LOGIC: "Logical Inconsistency",
};

export const ERROR_TYPE_PATHS = {
  [ERROR_TYPES.GRAMMAR_ARTICLE]:            `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_ARTICLE}`,
  [ERROR_TYPES.GRAMMAR_TENSE]:              `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_TENSE}`,
  [ERROR_TYPES.GRAMMAR_SUBJECT_VERB]:       `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_SUBJECT_VERB}`,
  [ERROR_TYPES.GRAMMAR_PRONOUN]:            `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_PRONOUN}`,
  [ERROR_TYPES.GRAMMAR_PREPOSITION]:        `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_PREPOSITION}`,
  [ERROR_TYPES.GRAMMAR_CONJUNCTION]:        `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_CONJUNCTION}`,
  [ERROR_TYPES.GRAMMAR_MODIFIER]:           `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_MODIFIER}`,
  [ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE]: `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE}`,
  [ERROR_TYPES.GRAMMAR_PARALLELISM]:        `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_PARALLELISM}`,
  [ERROR_TYPES.GRAMMAR_WORD_FORM]:          `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_WORD_FORM}`,
  [ERROR_TYPES.GRAMMAR_COMPARISON]:         `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_COMPARISON}`,
  [ERROR_TYPES.GRAMMAR_NEGATION]:           `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_NEGATION}`,

  [ERROR_TYPES.VOCAB_WORD_CHOICE]:  `${CATEGORIES.VOCAB} / ${ERROR_TYPES.VOCAB_WORD_CHOICE}`,
  [ERROR_TYPES.VOCAB_COLLOCATION]:  `${CATEGORIES.VOCAB} / ${ERROR_TYPES.VOCAB_COLLOCATION}`,
  [ERROR_TYPES.VOCAB_IDIOM]:        `${CATEGORIES.VOCAB} / ${ERROR_TYPES.VOCAB_IDIOM}`,
  [ERROR_TYPES.VOCAB_REDUNDANCY]:   `${CATEGORIES.VOCAB} / ${ERROR_TYPES.VOCAB_REDUNDANCY}`,

  [ERROR_TYPES.MECHANICS_SPELLING]:       `${CATEGORIES.MECHANICS} / ${ERROR_TYPES.MECHANICS_SPELLING}`,
  [ERROR_TYPES.MECHANICS_PUNCTUATION]:    `${CATEGORIES.MECHANICS} / ${ERROR_TYPES.MECHANICS_PUNCTUATION}`,
  [ERROR_TYPES.MECHANICS_CAPITALIZATION]: `${CATEGORIES.MECHANICS} / ${ERROR_TYPES.MECHANICS_CAPITALIZATION}`,
  [ERROR_TYPES.MECHANICS_SPACING]:        `${CATEGORIES.MECHANICS} / ${ERROR_TYPES.MECHANICS_SPACING}`,

  [ERROR_TYPES.STYLE_PHRASING]:    `${CATEGORIES.STYLE} / ${ERROR_TYPES.STYLE_PHRASING}`,
  [ERROR_TYPES.STYLE_CONCISENESS]: `${CATEGORIES.STYLE} / ${ERROR_TYPES.STYLE_CONCISENESS}`,
  [ERROR_TYPES.STYLE_TONE]:        `${CATEGORIES.STYLE} / ${ERROR_TYPES.STYLE_TONE}`,
  [ERROR_TYPES.STYLE_REPETITION]:  `${CATEGORIES.STYLE} / ${ERROR_TYPES.STYLE_REPETITION}`,
  [ERROR_TYPES.STYLE_VOICE]:       `${CATEGORIES.STYLE} / ${ERROR_TYPES.STYLE_VOICE}`,

  [ERROR_TYPES.CLARITY_AMBIGUITY]: `${CATEGORIES.CLARITY} / ${ERROR_TYPES.CLARITY_AMBIGUITY}`,
  [ERROR_TYPES.CLARITY_REFERENCE]: `${CATEGORIES.CLARITY} / ${ERROR_TYPES.CLARITY_REFERENCE}`,
  [ERROR_TYPES.CLARITY_LOGIC]:     `${CATEGORIES.CLARITY} / ${ERROR_TYPES.CLARITY_LOGIC}`,
};

export function getErrorTypePath(errorType) {
  return ERROR_TYPE_PATHS[errorType] || errorType;
}

export function getErrorTypeName(errorType) {
  return errorType;
}

export function getErrorTypeCategory(errorType) {
  for (const [key, value] of Object.entries(ERROR_TYPES)) {
    if (value === errorType) {
      if (key.startsWith("GRAMMAR_"))   return CATEGORIES.GRAMMAR;
      if (key.startsWith("VOCAB_"))     return CATEGORIES.VOCAB;
      if (key.startsWith("MECHANICS_")) return CATEGORIES.MECHANICS;
      if (key.startsWith("STYLE_"))     return CATEGORIES.STYLE;
      if (key.startsWith("CLARITY_"))   return CATEGORIES.CLARITY;
    }
  }
  return "Other";
}

// Keyword → canonical error type. Longer keys matched first (most specific wins).
export const ERROR_TYPE_MAPPING = {
  // Article Usage
  "article":    ERROR_TYPES.GRAMMAR_ARTICLE,
  "a/an":       ERROR_TYPES.GRAMMAR_ARTICLE,
  "determiner": ERROR_TYPES.GRAMMAR_ARTICLE,

  // Verb Tense (covers tense, aspect, participle, gerund/infinitive patterns)
  "verb tense":    ERROR_TYPES.GRAMMAR_TENSE,
  "past tense":    ERROR_TYPES.GRAMMAR_TENSE,
  "present tense": ERROR_TYPES.GRAMMAR_TENSE,
  "future tense":  ERROR_TYPES.GRAMMAR_TENSE,
  "perfect tense": ERROR_TYPES.GRAMMAR_TENSE,
  "verb pattern":  ERROR_TYPES.GRAMMAR_TENSE,
  "verb form":     ERROR_TYPES.GRAMMAR_TENSE,
  "verb usage":    ERROR_TYPES.GRAMMAR_TENSE,
  "tense":         ERROR_TYPES.GRAMMAR_TENSE,
  "aspect":        ERROR_TYPES.GRAMMAR_TENSE,
  "participle":    ERROR_TYPES.GRAMMAR_TENSE,
  "gerund":        ERROR_TYPES.GRAMMAR_TENSE,
  "infinitive":    ERROR_TYPES.GRAMMAR_TENSE,
  "subjunctive":   ERROR_TYPES.GRAMMAR_TENSE,
  "mood":          ERROR_TYPES.GRAMMAR_TENSE,

  // Subject-Verb Agreement
  "subject-verb agreement": ERROR_TYPES.GRAMMAR_SUBJECT_VERB,
  "verb agreement":         ERROR_TYPES.GRAMMAR_SUBJECT_VERB,
  "agreement":              ERROR_TYPES.GRAMMAR_SUBJECT_VERB,
  "conjugation":            ERROR_TYPES.GRAMMAR_SUBJECT_VERB,

  // Pronoun Usage
  "pronoun":    ERROR_TYPES.GRAMMAR_PRONOUN,
  "antecedent": ERROR_TYPES.GRAMMAR_PRONOUN,
  "reflexive":  ERROR_TYPES.GRAMMAR_PRONOUN,

  // Preposition Usage
  "preposition":   ERROR_TYPES.GRAMMAR_PREPOSITION,
  "prepositional": ERROR_TYPES.GRAMMAR_PREPOSITION,

  // Conjunction/Connector
  "conjunction": ERROR_TYPES.GRAMMAR_CONJUNCTION,
  "connector":   ERROR_TYPES.GRAMMAR_CONJUNCTION,
  "transition":  ERROR_TYPES.GRAMMAR_CONJUNCTION,

  // Modifier Placement
  "adverb placement": ERROR_TYPES.GRAMMAR_MODIFIER,
  "modifier":         ERROR_TYPES.GRAMMAR_MODIFIER,
  "dangling":         ERROR_TYPES.GRAMMAR_MODIFIER,
  "misplaced":        ERROR_TYPES.GRAMMAR_MODIFIER,

  // Sentence Structure
  "sentence structure":  ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  "incomplete sentence": ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  "word order":          ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  "syntax":              ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  "run-on":              ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  "clause":              ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  "fragment":            ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,

  // Parallel Structure
  "parallel structure": ERROR_TYPES.GRAMMAR_PARALLELISM,
  "parallelism":        ERROR_TYPES.GRAMMAR_PARALLELISM,
  "parallel":           ERROR_TYPES.GRAMMAR_PARALLELISM,

  // Word Form
  "word form":  ERROR_TYPES.GRAMMAR_WORD_FORM,
  "morphology": ERROR_TYPES.GRAMMAR_WORD_FORM,
  "derivation": ERROR_TYPES.GRAMMAR_WORD_FORM,
  "suffix":     ERROR_TYPES.GRAMMAR_WORD_FORM,
  "prefix":     ERROR_TYPES.GRAMMAR_WORD_FORM,

  // Comparison
  "comparison":  ERROR_TYPES.GRAMMAR_COMPARISON,
  "comparative": ERROR_TYPES.GRAMMAR_COMPARISON,
  "superlative": ERROR_TYPES.GRAMMAR_COMPARISON,

  // Negation
  "double negative": ERROR_TYPES.GRAMMAR_NEGATION,
  "negation":        ERROR_TYPES.GRAMMAR_NEGATION,

  // Word Choice
  "word choice":   ERROR_TYPES.VOCAB_WORD_CHOICE,
  "wrong word":    ERROR_TYPES.VOCAB_WORD_CHOICE,
  "unnaturalness": ERROR_TYPES.VOCAB_WORD_CHOICE,
  "unnatural":     ERROR_TYPES.VOCAB_WORD_CHOICE,
  "vocabulary":    ERROR_TYPES.VOCAB_WORD_CHOICE,
  "lexical":       ERROR_TYPES.VOCAB_WORD_CHOICE,

  // Collocation
  "fixed expression": ERROR_TYPES.VOCAB_COLLOCATION,
  "phrasal verb":     ERROR_TYPES.VOCAB_COLLOCATION,
  "collocation":      ERROR_TYPES.VOCAB_COLLOCATION,

  // Idiomatic Expression
  "idiomatic expression": ERROR_TYPES.VOCAB_IDIOM,
  "idiomatic":            ERROR_TYPES.VOCAB_IDIOM,
  "idiom":                ERROR_TYPES.VOCAB_IDIOM,

  // Redundancy
  "redundan":  ERROR_TYPES.VOCAB_REDUNDANCY,
  "tautology": ERROR_TYPES.VOCAB_REDUNDANCY,

  // Spelling
  "misspelling": ERROR_TYPES.MECHANICS_SPELLING,
  "spelling":    ERROR_TYPES.MECHANICS_SPELLING,
  "typo":        ERROR_TYPES.MECHANICS_SPELLING,

  // Punctuation
  "punctuation": ERROR_TYPES.MECHANICS_PUNCTUATION,
  "apostrophe":  ERROR_TYPES.MECHANICS_PUNCTUATION,
  "semicolon":   ERROR_TYPES.MECHANICS_PUNCTUATION,
  "quotation":   ERROR_TYPES.MECHANICS_PUNCTUATION,
  "hyphen":      ERROR_TYPES.MECHANICS_PUNCTUATION,
  "comma":       ERROR_TYPES.MECHANICS_PUNCTUATION,

  // Capitalization
  "capitalization": ERROR_TYPES.MECHANICS_CAPITALIZATION,
  "uppercase":      ERROR_TYPES.MECHANICS_CAPITALIZATION,
  "lowercase":      ERROR_TYPES.MECHANICS_CAPITALIZATION,
  "capital":        ERROR_TYPES.MECHANICS_CAPITALIZATION,

  // Spacing & Formatting
  "indentation": ERROR_TYPES.MECHANICS_SPACING,
  "formatting":  ERROR_TYPES.MECHANICS_SPACING,
  "spacing":     ERROR_TYPES.MECHANICS_SPACING,

  // Phrasing
  "phrasing": ERROR_TYPES.STYLE_PHRASING,
  "awkward":  ERROR_TYPES.STYLE_PHRASING,
  "fluency":  ERROR_TYPES.STYLE_PHRASING,
  "phrase":   ERROR_TYPES.STYLE_PHRASING,
  "natural":  ERROR_TYPES.STYLE_PHRASING,
  "flow":     ERROR_TYPES.STYLE_PHRASING,

  // Conciseness
  "unnecessary": ERROR_TYPES.STYLE_CONCISENESS,
  "verbose":     ERROR_TYPES.STYLE_CONCISENESS,
  "concise":     ERROR_TYPES.STYLE_CONCISENESS,
  "wordy":       ERROR_TYPES.STYLE_CONCISENESS,

  // Tone & Register
  "formality": ERROR_TYPES.STYLE_TONE,
  "register":  ERROR_TYPES.STYLE_TONE,
  "informal":  ERROR_TYPES.STYLE_TONE,
  "polite":    ERROR_TYPES.STYLE_TONE,
  "formal":    ERROR_TYPES.STYLE_TONE,
  "tone":      ERROR_TYPES.STYLE_TONE,

  // Repetition
  "repetitive": ERROR_TYPES.STYLE_REPETITION,
  "repetition": ERROR_TYPES.STYLE_REPETITION,

  // Voice (Active/Passive)
  "active voice":  ERROR_TYPES.STYLE_VOICE,
  "passive voice": ERROR_TYPES.STYLE_VOICE,
  "voice":         ERROR_TYPES.STYLE_VOICE,

  // Ambiguity
  "question formation": ERROR_TYPES.CLARITY_AMBIGUITY,
  "ambiguit":           ERROR_TYPES.CLARITY_AMBIGUITY,
  "vague":              ERROR_TYPES.CLARITY_AMBIGUITY,

  // Unclear Reference
  "unclear reference": ERROR_TYPES.CLARITY_REFERENCE,
  "incompleteness":    ERROR_TYPES.CLARITY_REFERENCE,
  "incomplete":        ERROR_TYPES.CLARITY_REFERENCE,
  "reference":         ERROR_TYPES.CLARITY_REFERENCE,
  "lack of":           ERROR_TYPES.CLARITY_REFERENCE,
  "unclear":           ERROR_TYPES.CLARITY_REFERENCE,

  // Logical Inconsistency
  "logical inconsistency": ERROR_TYPES.CLARITY_LOGIC,
  "contradiction":         ERROR_TYPES.CLARITY_LOGIC,
  "inconsistent":          ERROR_TYPES.CLARITY_LOGIC,
  "illogical":             ERROR_TYPES.CLARITY_LOGIC,
};

/**
 * Classify a free-text diagnosis into a predefined error type.
 * Longer keywords are matched first (most-specific wins).
 */
export function classifyErrorType(diagnosisText) {
  if (!diagnosisText) return null;

  const lower = diagnosisText.toLowerCase();
  const sortedKeys = Object.keys(ERROR_TYPE_MAPPING).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeys) {
    if (lower.includes(keyword)) {
      return ERROR_TYPE_MAPPING[keyword];
    }
  }

  return diagnosisText.trim().replace(/^-+\s*/, "");
}

export function getErrorTypesByCategory() {
  const categories = {
    "Grammar": [],
    "Vocabulary": [],
    "Mechanics": [],
    "Style": [],
    "Clarity": []
  };

  for (const [key, value] of Object.entries(ERROR_TYPES)) {
    if (key.startsWith("GRAMMAR_"))        categories["Grammar"].push(value);
    else if (key.startsWith("VOCAB_"))     categories["Vocabulary"].push(value);
    else if (key.startsWith("MECHANICS_")) categories["Mechanics"].push(value);
    else if (key.startsWith("STYLE_"))     categories["Style"].push(value);
    else if (key.startsWith("CLARITY_"))   categories["Clarity"].push(value);
  }

  return categories;
}
