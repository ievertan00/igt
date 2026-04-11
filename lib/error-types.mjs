/**
 * MECE Error Type Classification System
 * 
 * Maps Gemini's free-text diagnoses to a predefined, mutually exclusive set of error types.
 * This ensures consistent tracking and eliminates redundancy.
 */

// Category definitions
const CATEGORIES = {
  GRAMMAR: "Grammar",
  VOCAB: "Vocabulary",
  MECHANICS: "Mechanics",
  STYLE: "Style",
  CLARITY: "Clarity",
};

// Predefined error types organized by category
export const ERROR_TYPES = {
  // === GRAMMAR (structural rules) ===
  GRAMMAR_ARTICLE: "Article Usage",
  GRAMMAR_TENSE: "Verb Tense",
  GRAMMAR_SUBJECT_VERB: "Subject-Verb Agreement",
  GRAMMAR_PRONOUN: "Pronoun Usage",
  GRAMMAR_PREPOSITION: "Preposition Usage",
  GRAMMAR_CONJUNCTION: "Conjunction/Connector",
  GRAMMAR_MODIFIER: "Modifier Placement",
  GRAMMAR_SENTENCE_STRUCTURE: "Sentence Structure",
  
  // === VOCABULARY (word choice) ===
  VOCAB_WORD_CHOICE: "Word Choice",
  VOCAB_IDIOM: "Idiomatic Expression",
  VOCAB_REDUNDANCY: "Redundancy",
  
  // === MECHANICS (surface errors) ===
  MECHANICS_SPELLING: "Spelling",
  MECHANICS_PUNCTUATION: "Punctuation",
  MECHANICS_CAPITALIZATION: "Capitalization",
  
  // === STYLE (readability & flow) ===
  STYLE_PHRASING: "Phrasing",
  STYLE_CONCISENESS: "Conciseness",
  STYLE_TONE: "Tone & Register",
  
  // === CLARITY ===
  CLARITY_FRAGMENT: "Sentence Fragment",
  CLARITY_INCOMPLETENESS: "Incomplete Thought",
  CLARITY_AMBIGUITY: "Ambiguity",
};

// Map each error type constant to its display path (Category / Type)
export const ERROR_TYPE_PATHS = {
  [ERROR_TYPES.GRAMMAR_ARTICLE]: `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_ARTICLE}`,
  [ERROR_TYPES.GRAMMAR_TENSE]: `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_TENSE}`,
  [ERROR_TYPES.GRAMMAR_SUBJECT_VERB]: `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_SUBJECT_VERB}`,
  [ERROR_TYPES.GRAMMAR_PRONOUN]: `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_PRONOUN}`,
  [ERROR_TYPES.GRAMMAR_PREPOSITION]: `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_PREPOSITION}`,
  [ERROR_TYPES.GRAMMAR_CONJUNCTION]: `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_CONJUNCTION}`,
  [ERROR_TYPES.GRAMMAR_MODIFIER]: `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_MODIFIER}`,
  [ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE]: `${CATEGORIES.GRAMMAR} / ${ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE}`,
  
  [ERROR_TYPES.VOCAB_WORD_CHOICE]: `${CATEGORIES.VOCAB} / ${ERROR_TYPES.VOCAB_WORD_CHOICE}`,
  [ERROR_TYPES.VOCAB_IDIOM]: `${CATEGORIES.VOCAB} / ${ERROR_TYPES.VOCAB_IDIOM}`,
  [ERROR_TYPES.VOCAB_REDUNDANCY]: `${CATEGORIES.VOCAB} / ${ERROR_TYPES.VOCAB_REDUNDANCY}`,
  
  [ERROR_TYPES.MECHANICS_SPELLING]: `${CATEGORIES.MECHANICS} / ${ERROR_TYPES.MECHANICS_SPELLING}`,
  [ERROR_TYPES.MECHANICS_PUNCTUATION]: `${CATEGORIES.MECHANICS} / ${ERROR_TYPES.MECHANICS_PUNCTUATION}`,
  [ERROR_TYPES.MECHANICS_CAPITALIZATION]: `${CATEGORIES.MECHANICS} / ${ERROR_TYPES.MECHANICS_CAPITALIZATION}`,
  
  [ERROR_TYPES.STYLE_PHRASING]: `${CATEGORIES.STYLE} / ${ERROR_TYPES.STYLE_PHRASING}`,
  [ERROR_TYPES.STYLE_CONCISENESS]: `${CATEGORIES.STYLE} / ${ERROR_TYPES.STYLE_CONCISENESS}`,
  [ERROR_TYPES.STYLE_TONE]: `${CATEGORIES.STYLE} / ${ERROR_TYPES.STYLE_TONE}`,
  
  [ERROR_TYPES.CLARITY_FRAGMENT]: `${CATEGORIES.CLARITY} / ${ERROR_TYPES.CLARITY_FRAGMENT}`,
  [ERROR_TYPES.CLARITY_INCOMPLETENESS]: `${CATEGORIES.CLARITY} / ${ERROR_TYPES.CLARITY_INCOMPLETENESS}`,
  [ERROR_TYPES.CLARITY_AMBIGUITY]: `${CATEGORIES.CLARITY} / ${ERROR_TYPES.CLARITY_AMBIGUITY}`,
};

/**
 * Get the display path for an error type (e.g., "Grammar / Verb Tense").
 * @param {string} errorType - A value from ERROR_TYPES
 * @returns {string} - Formatted path like "Grammar / Verb Tense"
 */
export function getErrorTypePath(errorType) {
  return ERROR_TYPE_PATHS[errorType] || errorType;
}

/**
 * Get the short name for an error type (e.g., "Verb Tense").
 * @param {string} errorType - A value from ERROR_TYPES
 * @returns {string} - Short name
 */
export function getErrorTypeName(errorType) {
  return errorType;
}

/**
 * Get the category for an error type (e.g., "Grammar").
 * @param {string} errorType - A value from ERROR_TYPES
 * @returns {string} - Category name
 */
export function getErrorTypeCategory(errorType) {
  for (const [key, value] of Object.entries(ERROR_TYPES)) {
    if (value === errorType) {
      if (key.startsWith("GRAMMAR_")) return CATEGORIES.GRAMMAR;
      if (key.startsWith("VOCAB_")) return CATEGORIES.VOCAB;
      if (key.startsWith("MECHANICS_")) return CATEGORIES.MECHANICS;
      if (key.startsWith("STYLE_")) return CATEGORIES.STYLE;
      if (key.startsWith("CLARITY_")) return CATEGORIES.CLARITY;
    }
  }
  return "Other";
}

// Keyword-based mapping from Gemini's free-text diagnosis to predefined types
export const ERROR_TYPE_MAPPING = {
  // Article Usage
  "article": ERROR_TYPES.GRAMMAR_ARTICLE,
  "a/an": ERROR_TYPES.GRAMMAR_ARTICLE,
  "the": ERROR_TYPES.GRAMMAR_ARTICLE,
  "determiner": ERROR_TYPES.GRAMMAR_ARTICLE,
  
  // Verb Tense
  "tense": ERROR_TYPES.GRAMMAR_TENSE,
  "verb tense": ERROR_TYPES.GRAMMAR_TENSE,
  "past tense": ERROR_TYPES.GRAMMAR_TENSE,
  "present tense": ERROR_TYPES.GRAMMAR_TENSE,
  "future tense": ERROR_TYPES.GRAMMAR_TENSE,
  "perfect tense": ERROR_TYPES.GRAMMAR_TENSE,
  "aspect": ERROR_TYPES.GRAMMAR_TENSE,
  "verb form": ERROR_TYPES.GRAMMAR_TENSE,
  "gerund": ERROR_TYPES.GRAMMAR_TENSE,
  "infinitive": ERROR_TYPES.GRAMMAR_TENSE,
  "participle": ERROR_TYPES.GRAMMAR_TENSE,
  "mood": ERROR_TYPES.GRAMMAR_TENSE,
  "subjunctive": ERROR_TYPES.GRAMMAR_TENSE,
  "negation": ERROR_TYPES.GRAMMAR_TENSE,
  "verb usage": ERROR_TYPES.GRAMMAR_TENSE,
  
  // Subject-Verb Agreement
  "subject-verb agreement": ERROR_TYPES.GRAMMAR_SUBJECT_VERB,
  "verb agreement": ERROR_TYPES.GRAMMAR_SUBJECT_VERB,
  "agreement": ERROR_TYPES.GRAMMAR_SUBJECT_VERB,
  "conjugation": ERROR_TYPES.GRAMMAR_SUBJECT_VERB,
  
  // Pronoun Usage
  "pronoun": ERROR_TYPES.GRAMMAR_PRONOUN,
  "antecedent": ERROR_TYPES.GRAMMAR_PRONOUN,
  "gender pronoun": ERROR_TYPES.GRAMMAR_PRONOUN,
  "reflexive": ERROR_TYPES.GRAMMAR_PRONOUN,
  
  // Preposition Usage
  "preposition": ERROR_TYPES.GRAMMAR_PREPOSITION,
  "prepositional": ERROR_TYPES.GRAMMAR_PREPOSITION,
  
  // Conjunction/Connector
  "conjunction": ERROR_TYPES.GRAMMAR_CONJUNCTION,
  "connector": ERROR_TYPES.GRAMMAR_CONJUNCTION,
  "transition": ERROR_TYPES.GRAMMAR_CONJUNCTION,
  
  // Modifier Placement
  "modifier": ERROR_TYPES.GRAMMAR_MODIFIER,
  "dangling": ERROR_TYPES.GRAMMAR_MODIFIER,
  "misplaced": ERROR_TYPES.GRAMMAR_MODIFIER,
  "adverb placement": ERROR_TYPES.GRAMMAR_MODIFIER,
  
  // Sentence Structure
  "sentence structure": ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  "syntax": ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  "word order": ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  "clause": ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  "run-on": ERROR_TYPES.GRAMMAR_SENTENCE_STRUCTURE,
  
  // Word Choice
  "word choice": ERROR_TYPES.VOCAB_WORD_CHOICE,
  "lexical": ERROR_TYPES.VOCAB_WORD_CHOICE,
  "vocabulary": ERROR_TYPES.VOCAB_WORD_CHOICE,
  "unnatural": ERROR_TYPES.VOCAB_WORD_CHOICE,
  "wrong word": ERROR_TYPES.VOCAB_WORD_CHOICE,
  "unnaturalness": ERROR_TYPES.VOCAB_WORD_CHOICE,
  
  // Idiomatic Expression
  "idiom": ERROR_TYPES.VOCAB_IDIOM,
  "idiomatic": ERROR_TYPES.VOCAB_IDIOM,
  "collocation": ERROR_TYPES.VOCAB_IDIOM,
  "fixed expression": ERROR_TYPES.VOCAB_IDIOM,
  "phrasal verb": ERROR_TYPES.VOCAB_IDIOM,
  
  // Redundancy
  "redundan": ERROR_TYPES.VOCAB_REDUNDANCY,
  "repetitive": ERROR_TYPES.VOCAB_REDUNDANCY,
  "repetition": ERROR_TYPES.VOCAB_REDUNDANCY,
  "tautology": ERROR_TYPES.VOCAB_REDUNDANCY,
  
  // Spelling
  "spelling": ERROR_TYPES.MECHANICS_SPELLING,
  "typo": ERROR_TYPES.MECHANICS_SPELLING,
  "misspelling": ERROR_TYPES.MECHANICS_SPELLING,
  
  // Punctuation
  "punctuation": ERROR_TYPES.MECHANICS_PUNCTUATION,
  "comma": ERROR_TYPES.MECHANICS_PUNCTUATION,
  "semicolon": ERROR_TYPES.MECHANICS_PUNCTUATION,
  "apostrophe": ERROR_TYPES.MECHANICS_PUNCTUATION,
  "quotation": ERROR_TYPES.MECHANICS_PUNCTUATION,
  "hyphen": ERROR_TYPES.MECHANICS_PUNCTUATION,
  
  // Capitalization
  "capitalization": ERROR_TYPES.MECHANICS_CAPITALIZATION,
  "capital": ERROR_TYPES.MECHANICS_CAPITALIZATION,
  "uppercase": ERROR_TYPES.MECHANICS_CAPITALIZATION,
  "lowercase": ERROR_TYPES.MECHANICS_CAPITALIZATION,
  
  // Phrasing
  "phrasing": ERROR_TYPES.STYLE_PHRASING,
  "phrase": ERROR_TYPES.STYLE_PHRASING,
  "awkward": ERROR_TYPES.STYLE_PHRASING,
  "natural": ERROR_TYPES.STYLE_PHRASING,
  "fluency": ERROR_TYPES.STYLE_PHRASING,
  "flow": ERROR_TYPES.STYLE_PHRASING,
  
  // Conciseness
  "concise": ERROR_TYPES.STYLE_CONCISENESS,
  "wordy": ERROR_TYPES.STYLE_CONCISENESS,
  "verbose": ERROR_TYPES.STYLE_CONCISENESS,
  "unnecessary": ERROR_TYPES.STYLE_CONCISENESS,
  
  // Tone & Register
  "tone": ERROR_TYPES.STYLE_TONE,
  "register": ERROR_TYPES.STYLE_TONE,
  "formality": ERROR_TYPES.STYLE_TONE,
  "polite": ERROR_TYPES.STYLE_TONE,
  "informal": ERROR_TYPES.STYLE_TONE,
  "formal": ERROR_TYPES.STYLE_TONE,
  
  // Sentence Fragment
  "fragment": ERROR_TYPES.CLARITY_FRAGMENT,
  "incomplete sentence": ERROR_TYPES.CLARITY_FRAGMENT,
  
  // Incomplete Thought
  "incomplete": ERROR_TYPES.CLARITY_INCOMPLETENESS,
  "incompleteness": ERROR_TYPES.CLARITY_INCOMPLETENESS,
  
  // Ambiguity
  "ambiguit": ERROR_TYPES.CLARITY_AMBIGUITY,
  "unclear": ERROR_TYPES.CLARITY_AMBIGUITY,
  "vague": ERROR_TYPES.CLARITY_AMBIGUITY,
  "lack of": ERROR_TYPES.CLARITY_AMBIGUITY,
  "question formation": ERROR_TYPES.CLARITY_AMBIGUITY,
};

/**
 * Classify a free-text diagnosis into a predefined error type.
 * @param {string} diagnosisText - The raw diagnosis text from Gemini
 * @returns {string} - A predefined error type from ERROR_TYPES
 */
export function classifyErrorType(diagnosisText) {
  if (!diagnosisText) return null;
  
  const lower = diagnosisText.toLowerCase();
  
  // Try multi-word keywords first (more specific)
  // Sort by length descending to match longest first
  const sortedKeys = Object.keys(ERROR_TYPE_MAPPING).sort((a, b) => b.length - a.length);
  
  for (const keyword of sortedKeys) {
    if (lower.includes(keyword)) {
      return ERROR_TYPE_MAPPING[keyword];
    }
  }
  
  // Fallback: if no match found, return the original text (cleaned)
  return diagnosisText.trim().replace(/^-+\s*/, "");
}

/**
 * Get a list of all predefined error types grouped by category.
 * @returns {Object} - { category: [errorType, ...] }
 */
export function getErrorTypesByCategory() {
  const categories = {
    "Grammar": [],
    "Vocabulary": [],
    "Mechanics": [],
    "Style": [],
    "Clarity": []
  };
  
  for (const [key, value] of Object.entries(ERROR_TYPES)) {
    if (key.startsWith("GRAMMAR_")) categories["Grammar"].push(value);
    else if (key.startsWith("VOCAB_")) categories["Vocabulary"].push(value);
    else if (key.startsWith("MECHANICS_")) categories["Mechanics"].push(value);
    else if (key.startsWith("STYLE_")) categories["Style"].push(value);
    else if (key.startsWith("CLARITY_")) categories["Clarity"].push(value);
  }
  
  return categories;
}
