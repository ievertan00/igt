// Analyzes reference_answer text to fill schema fields
// sentence_structure, clause_type, conjunction_type, tense_aspect, voice, mood, non_finite

import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "igt_data.db");

// Count verb phrases to estimate clause count
function countVerbPhrases(text) {
  const tokens = text.toLowerCase().split(/\s+/);
  const auxiliaries = new Set([
    "is", "am", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "having",
    "do", "does", "did",
    "will", "would", "shall", "should", "can", "could", "may", "might", "must",
    "need", "dare", "ought",
  ]);
  const pastForms = /\b\w+(ed|en|t)\b/; // simplified past/participle detection
  
  let clauseCount = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (auxiliaries.has(t)) {
      // Check next word is a verb form (simplistic)
      if (i + 1 < tokens.length && (pastForms.test(tokens[i + 1]) || tokens[i + 1].endsWith("ing"))) {
        clauseCount++;
      } else if (t === "be" || t === "been" || t === "being") {
        clauseCount++;
      }
    } else if (pastForms.test(t) && !auxiliaries.has(tokens[i - 1] || "")) {
      // Standalone past verb
      if (!tokens[i - 1] || !["to"].includes(tokens[i - 1])) {
        clauseCount++;
      }
    }
  }
  
  // Fallback: count "that", "which", "who", "when", "where", "if", "because", "although", "but", "and"
  const subordinators = /\b(that|which|who|whom|whose|when|where|why|how|if|because|since|although|though|while|whereas|unless|until|after|before|once|as|whether)\b/gi;
  const coordinatorCount = (text.match(/\band\b|\bbut\b|\bor\b|\byet\b|\bso\b/gi) || []).length;
  const subMatches = text.match(subordinators) || [];
  
  return Math.max(1, clauseCount + subMatches.length + coordinatorCount);
}

function analyzeSentenceStructure(text) {
  const clauseCount = countVerbPhrases(text);
  if (clauseCount <= 1) return "simple";
  if (clauseCount === 2) {
    // Check if joined by coordinating conjunction
    if (/\band\b|\bbut\b|\bor\b|\byet\b|\bso\b/i.test(text)) return "compound";
    return "complex";
  }
  // 3+ clauses: check for both coordination and subordination
  const hasCoord = /,?\s+(and|but|or|yet|so)\s+/i.test(text);
  const hasSubord = /\b(that|which|who|whom|when|where|because|if|although|though|while|since|unless|until|after|before|once|as|whether)\b/i.test(text);
  if (hasCoord && hasSubord) return "compound-complex";
  if (hasSubord) return "complex";
  return "compound";
}

function analyzeClauseType(text) {
  const types = [];
  if (/\b(that|which|who|whom|whose)\b/i.test(text)) types.push("relative");
  if (/\b(because|since|as)\b.*\b/i.test(text) && !/\b(much|many|long|well|far)\s+as\b/i.test(text)) types.push("adverbial reason");
  if (/\b(if|unless|provided that|as long as|once)\b/i.test(text)) types.push("conditional");
  if (/\b(although|though|even though|whereas|while)\b/i.test(text)) types.push("concessive");
  if (/\b(when|after|before|until|while|as soon as)\b/i.test(text)) types.push("temporal");
  if (/\b(whether|if)\b.*\b(know|decided|sure|remember|tell|ask|check|confirm|see|say)\b/i.test(text) ||
      /\b(know|decided|remember|tell|asked|check|confirm|see|say)\b.*\b(whether|if)\b/i.test(text))
    types.push("embedded yes-no question");
  if (/\b(know|decided|remember|tell|ask|check|confirm|see|say)\b.*\b(who|what|where|when|why|how|which)\b/i.test(text))
    types.push("embedded wh-question");
  if (/\bso\s+that\b|\bin order that\b/i.test(text)) types.push("purpose");
  if (/\b(so|such)\b.*\bthat\b/i.test(text)) types.push("result");
  if (/\b(than|as)\b.*\b(more|less|er|as)\b/i.test(text) || /\bthe\s+more\b.*\bthe\s+more\b/i.test(text))
    types.push("comparative");
  return types.length > 0 ? types : null;
}

function analyzeTenseAspect(text) {
  const lower = text.toLowerCase();
  const tenses = [];
  
  // Present simple
  if (/\b(is|am|are)\b/.test(lower) && !/\b(is|am|are)\s+\w+ing\b/i.test(lower) && !/\b(is|am|are)\s+\w+ed\b/i.test(lower))
    tenses.push("present simple");
  if (/\b\w+s\b(?!\w)/i.test(text) && !/\b(is|has|does|was)\b/i.test(lower)) tenses.push("present simple");
  
  // Present continuous
  if (/\b(is|am|are)\s+\w+ing\b/i.test(lower)) tenses.push("present continuous");
  
  // Present perfect
  if (/\b(have|has)\s+\w+(ed|en|t|own|ept|elt|ept)\b/i.test(lower) || /\b(have|has)\s+been\b/i.test(lower))
    tenses.push("present perfect");
  
  // Past simple
  if (/\b\w+ed\b/i.test(lower) && !/\bhave\s+\w+ed\b|\bhas\s+\w+ed\b/i.test(lower)) tenses.push("past simple");
  if (/\b(was|were|did|had|came|went|took|made|said|got|put|set|let|ran|saw|knew|thought|found|gave|told|left|kept|felt|sent|built|spent|bought|brought|caught|taught|sold|held|led|lost|paid|read|rose|sang|sat|spoke|stood|swam|threw|wore|wrote|drove|ate|flew|grew|hung|lay|rang|shook|shone|shot|shut|sank|slept|slid|spoke|stole|struck|swore|swept|swung|tore|woke|won|wound|drew|fell|forgot|froze|hid|rode|sprang|stuck|stung|struck|swore|tore|wore|withdrew|withstood)\b/i.test(lower))
    tenses.push("past simple");
  
  // Past perfect
  if (/\bhad\s+\w+(ed|en|t|own|ept|elt|ept)\b/i.test(lower) || /\bhad\s+been\b/i.test(lower))
    tenses.push("past perfect");
  
  // Future
  if (/\bwill\b|\bgoing to\b|\b'll\b/i.test(lower)) tenses.push("future");
  
  // Present perfect continuous
  if (/\b(have|has)\s+been\s+\w+ing\b/i.test(lower)) tenses.push("present perfect continuous");
  
  return [...new Set(tenses)].length > 0 ? [...new Set(tenses)] : null;
}

function analyzeVoice(text) {
  const lower = text.toLowerCase();
  // Passive: be + past participle
  const passivePattern = /\b(is|am|are|was|were|be|been|being|has been|have been|had been|will be|would be|can be|could be|may be|might be|must be|should be)\s+\w+(ed|en|t|own|ept|elt|ept|ade|ied|sed|zed)\b/gi;
  if (passivePattern.test(lower)) return "passive";
  return "active";
}

function analyzeMood(text) {
  const lower = text.toLowerCase();
  // Imperative: starts with verb, no subject
  if (/^(do|don't|please|remember|check|tell|put|take|go|come|make|let|keep|try|call|send|open|close|empty|wipe|collect|confirm|avoid)\b/i.test(text.trim()))
    return "imperative";
  // Subjunctive: suggest/recommend/insist that + base form, if I were, wish I were
  if (/\b(if\s+\w+\s+were|wish\s+\w+\s+were|suggest that|recommend that|insist that|it is \w+ that)\b/i.test(lower))
    return "subjunctive";
  if (/\bwould\b|\bcould\b.*\bif\b|\bif\b.*\bwould\b/i.test(lower)) return "conditional-mood";
  return "indicative";
}

function analyzeNonFinite(text) {
  const forms = [];
  // Infinitive
  if (/\bto\s+\w+\b(?!\w*ing)/i.test(text)) forms.push("infinitive");
  // Gerund
  if (/\b\w+ing\b(?!\s+(is|am|are|was|were|has|have|had|will|would|can|could|may|might|must|should))/i.test(text) &&
      /\b\w+ing\b/.test(text)) forms.push("gerund");
  // Present participle
  if (/\b\w+ing\b/i.test(text) && /\b(is|am|are|was|were)\s+\w+ing\b/i.test(text))
    forms.push("participle-present");
  // Past participle (passive context already detected)
  if (/\b(has|have|had|is|are|was|were|been)\s+\w+(ed|en|t|own)\b/i.test(text))
    forms.push("participle-past");
  return [...new Set(forms)].length > 0 ? [...new Set(forms)] : null;
}

function analyzeConjunctionType(text) {
  const types = [];
  if (/,?\s+(and|but|or|yet|so)\s+/i.test(text)) types.push("coordinating");
  if (/\b(because|if|when|although|though|since|while|whereas|unless|until|after|before|once|as|provided that|as long as|so that|in order that|even though|as soon as|as though|as if|where|whether)\b/i.test(text))
    types.push("subordinating");
  if (/\b(neither|either)\b.*\b(nor|or)\b/i.test(text) || /\bnot only\b.*\bbut also\b/i.test(text) || /\bboth\b.*\band\b/i.test(text))
    types.push("correlative");
  if (/\b(therefore|however|moreover|furthermore|nevertheless|meanwhile|consequently|accordingly|then|instead|otherwise|thus|hence|indeed|still|rather)\b/i.test(text))
    types.push("conjunctive-adverb");
  return types.length > 0 ? [...new Set(types)] : null;
}

// Difficulty recalibration rules
function recalibrateDifficulty(id, promptZh, reference, currentDifficulty, generatedBy) {
  // Count complexity signals
  const answerClauses = countVerbPhrases(reference);
  const promptLen = promptZh.length;
  const refLen = reference.length;
  const hasPassive = /\b(is|are|was|were|be|been|has been|have been|had been)\s+\w+(ed|en)\b/i.test(reference);
  const hasSubjunctive = /\b(if\s+\w+\s+were|would have|should have|could have|might have)\b/i.test(reference);
  const hasInversion = /^(not until|never|hardly|scarcely|no sooner|only|nor|neither)\b/i.test(reference);
  const complexWords = (reference.match(/\b\w{10,}\b/g) || []).length;
  const hasMultipleTenses = (reference.match(/\b(have|has|had|will|would|could|might|may|can|should|must)\b/gi) || []).length >= 2;
  
  let score = 0;
  if (answerClauses >= 4) score += 3;
  else if (answerClauses >= 3) score += 2;
  else if (answerClauses >= 2) score += 1;
  
  if (hasPassive) score += 1;
  if (hasSubjunctive) score += 2;
  if (hasInversion) score += 1;
  if (complexWords >= 3) score += 2;
  else if (complexWords >= 1) score += 1;
  if (hasMultipleTenses) score += 1;
  if (refLen > 120) score += 1;
  if (promptLen < 15 && answerClauses <= 1) score -= 2;
  
  if (score <= 1) return "easy";
  if (score <= 3) return "standard";
  return "challenge";
}

function main() {
  const db = new Database(dbPath);
  
  // Get all questions that need schema field analysis
  const questions = db.prepare(`
    SELECT id, reference_answer FROM practice_questions 
    WHERE json_extract(practice_fields_json, '$.sentence_structure') IS NULL
  `).all();
  
  const results = {};
  for (const q of questions) {
    results[q.id] = {
      sentence_structure: analyzeSentenceStructure(q.reference_answer),
      clause_type: analyzeClauseType(q.reference_answer),
      conjunction_type: analyzeConjunctionType(q.reference_answer),
      tense_aspect: analyzeTenseAspect(q.reference_answer),
      voice: analyzeVoice(q.reference_answer),
      mood: analyzeMood(q.reference_answer),
      non_finite: analyzeNonFinite(q.reference_answer),
    };
  }
  
  console.log(JSON.stringify(results, null, 2));
  
  db.close();
}

main();