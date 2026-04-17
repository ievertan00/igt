import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import initializeLLMProviders, { configLoader } from "../lib/llm-init.mjs";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

// Initialize LLM providers
const llmManager = initializeLLMProviders();

// Parse command line arguments
const args = process.argv.slice(2);
const daysArg = args.find(a => a.startsWith("--days="));
const days = daysArg ? parseInt(daysArg.split("=")[1]) : 30; // Default: last 30 days
const incrementalArg = args.find(a => a === "--incremental" || a === "-i");
const incremental = incrementalArg !== undefined;
const clearCacheArg = args.find(a => a === "--clear-cache" || a === "-c");
const cacheStatsArg = args.find(a => a === "--cache-stats");

// Handle cache management commands
if (clearCacheArg) {
  console.log("🗑️  Clearing LLM rule cache...");
  const cacheDir = path.join(projectRoot, ".cache");
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir);
    let deleted = 0;
    for (const file of files) {
      if (file.startsWith("rule_") && file.endsWith(".json")) {
        fs.unlinkSync(path.join(cacheDir, file));
        deleted++;
      }
    }
    console.log(`✅ Cleared ${deleted} cached rules`);
  } else {
    console.log("ℹ️  No cache directory found. Nothing to clear.");
  }
  process.exit(0);
}

if (cacheStatsArg) {
  console.log("📊 Cache Statistics:");
  const cacheDir = path.join(projectRoot, ".cache");
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir).filter(f => f.startsWith("rule_") && f.endsWith(".json"));
    console.log(`  Cached rules: ${files.length}`);
    
    let totalSize = 0;
    for (const file of files) {
      const filePath = path.join(cacheDir, file);
      const stat = fs.statSync(filePath);
      totalSize += stat.size;
      
      const cacheData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const errorType = cacheData.errorType || file;
      const generatedAt = cacheData.generatedAt || "Unknown";
      console.log(`    - ${errorType}: ${generatedAt}`);
    }
    console.log(`  Total cache size: ${(totalSize / 1024).toFixed(2)} KB`);
  } else {
    console.log("  No cache directory found.");
  }
  process.exit(0);
}

// Load config via unified config loader
const config = configLoader.load();
const dbPath = config.DbPath || "igt_data.db";
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.join(projectRoot, dbPath);

if (!fs.existsSync(resolvedDbPath)) {
  console.error("Error: Database file not found. Run IGT first to collect data.");
  process.exit(1);
}

const db = new Database(resolvedDbPath, { readonly: true });

// Get date filter
const dateFilter = days > 0 ? `AND i.timestamp >= datetime('now', '-${days} days')` : "";

// Cache management for incremental updates
function getCacheDir() {
  const cacheDir = path.join(projectRoot, ".cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

function getCacheFilePath(errorType) {
  const safeName = errorType.replace(/[^a-zA-Z0-9]/g, "_");
  return path.join(getCacheDir(), `rule_${safeName}.json`);
}

function loadCachedRule(errorType) {
  try {
    const cacheFile = getCacheFilePath(errorType);
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      return cached;
    }
  } catch (error) {
    console.warn(`Warning: Failed to load cache for ${errorType}:`, error.message);
  }
  return null;
}

function saveCachedRule(errorType, hash, rule) {
  try {
    const cacheFile = getCacheFilePath(errorType);
    const cacheData = {
      errorType,
      hash,
      generatedAt: new Date().toISOString(),
      rule
    };
    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), "utf8");
  } catch (error) {
    console.warn(`Warning: Failed to save cache for ${errorType}:`, error.message);
  }
}

function computeExamplesHash(examples) {
  // Create a hash based on example content to detect changes
  const hashInput = examples.map(ex => 
    `${ex.original_text}|${ex.correction}|${ex.refine}|${ex.rule}|${ex.tip}`
  ).join("\n");
  
  return crypto.createHash("md5").update(hashInput).digest("hex");
}

function hasExamplesChanged(errorType, currentExamples) {
  const cached = loadCachedRule(errorType);
  if (!cached) return true; // No cache, needs regeneration
  
  const currentHash = computeExamplesHash(currentExamples);
  return cached.hash !== currentHash;
}

// 1. Get error type frequency
const errorFrequency = db.prepare(`
  SELECT
    d.error_type,
    COUNT(*) as count,
    d.severity,
    COUNT(CASE WHEN d.severity = 'Major' THEN 1 END) as major_count,
    COUNT(CASE WHEN d.severity = 'Moderate' THEN 1 END) as moderate_count,
    COUNT(CASE WHEN d.severity = 'Minor' THEN 1 END) as minor_count
  FROM diagnoses d
  JOIN inputs i ON d.input_id = i.id
  WHERE 1=1 ${dateFilter}
  GROUP BY d.error_type
  ORDER BY count DESC
`).all();

// 2. Get trend data (errors per week)
const trendData = db.prepare(`
  SELECT 
    strftime('%Y-%W', i.timestamp) as week,
    COUNT(*) as error_count
  FROM diagnoses d
  JOIN inputs i ON d.input_id = i.id
  WHERE 1=1 ${dateFilter}
  GROUP BY week
  ORDER BY week
`).all();

// 4. Generate LLM-tailored grammar rules
async function generateTailoredGrammarRule(errorType, examples) {
  if (examples.length === 0) return null;

  // Check if regeneration is needed (incremental mode)
  if (incremental && !hasExamplesChanged(errorType, examples)) {
    const cached = loadCachedRule(errorType);
    if (cached) {
      console.log(`⏭️  Skipping ${errorType} (cached, no changes)`);
      return cached.rule;
    }
  }

  // Prepare user examples for LLM
  const examplesText = examples.map((ex, i) => {
    let text = `Example ${i + 1}:\n`;
    text += `Original: "${ex.original_text}"\n`;
    if (ex.correction) text += `Corrected: "${ex.correction}"\n`;
    if (ex.refine) text += `Natural: "${ex.refine}"\n`;
    if (ex.explanation) text += `Explanation: "${ex.explanation}"\n`;
    if (ex.rule) text += `Rule: "${ex.rule}"\n`;
    if (ex.tip) text += `Tip: "${ex.tip}"\n`;
    return text;
  }).join("\n");

  // Load prompt from config or use default
  let prompt;
  if (config.Prompts && config.Prompts.HandbookGrammarRulePrompt) {
    prompt = config.Prompts.HandbookGrammarRulePrompt
      .replace("{{errorType}}", errorType)
      .replace("{{examplesText}}", examplesText);
  } else {
    // Fallback to inline prompt for backward compatibility
    prompt = `You are an expert English grammar tutor. Based on the user's error patterns and examples, create a detailed, personalized grammar rule explanation.

**Error Type**: ${errorType}

**User's Examples**:
${examplesText}

**Instructions**:
1. Explain the grammar rule clearly and concisely
2. Reference the user's specific errors and show what they did wrong
3. Provide the correct patterns with examples from the user's data
4. Give 2-3 additional common examples that the user might encounter
5. Include a \"Key Takeaway\" section with a memorable rule or tip
6. All explanations MUST be in English ONLY. Do NOT use Chinese.

**Format** (use markdown):
- Start with a brief overview of the rule- List specific patterns with ✅/❌ examples
- Explain why the user made these errors
- Provide clear rules to avoid these mistakes
- End with a concise "Key Takeaway" box

Keep the tone encouraging and educational. Focus on the patterns the user actually struggles with.`;
  }

  // Try generating with LLM using unified interface with smart retry and rate limiting
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    try {
      const content = await llmManager.generate(prompt, "", {
        taskType: "handbook",
        systemPrompt: "" // Empty since prompt already contains instructions
      });

      const rule = {
        title: `${errorType} (Personalized)`,
        content: content
      };

      // Cache the result with hash
      if (incremental) {
        const hash = computeExamplesHash(examples);
        saveCachedRule(errorType, hash, rule);
        console.log(`✅ Generated and cached ${errorType}`);
      } else {
        console.log(`✅ Generated ${errorType}`);
      }

      return rule;
    } catch (error) {
      // Check if it's a rate limit error (429)
      if (error.message && (error.message.includes("429") || error.message.toLowerCase().includes("rate"))) {
        // Try to extract retry delay from error message
        let retryDelay = 5; // Default 5 seconds
        const delayMatch = error.message.match(/retry in ([\d.]+)s/i);
        if (delayMatch) {
          retryDelay = parseFloat(delayMatch[1]) + 1; // Add 1s buffer
        } else if (retryCount > 0) {
          retryDelay = Math.pow(2, retryCount) * 5; // Exponential backoff
        }

        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`⏳ Rate limit hit. Waiting ${retryDelay.toFixed(1)}s before retry ${retryCount}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));
        } else {
          console.warn(`⚠️  Rate limit exceeded after ${maxRetries} retries.`);
          break;
        }
      } else {
        // Non-rate-limit error, try fallback
        console.warn(`LLM generation failed: ${error.message}`);
        break;
      }
    }
  }

  // Fallback to static rules
  console.warn("All LLM API keys failed. Using static rules.");
  return getStaticGrammarRule(errorType);
}

// Fallback: Static grammar rules (keep existing implementation)
function getStaticGrammarRule(errorType) {
  const rules = {
    "Grammar / Article Usage": {
      title: "Article Usage (冠词用法)",
      content: `Articles (a, an, the) are determiners that specify nouns. 

**Rules:**
- Use **a/an** for singular, countable nouns mentioned for the first time (indefinite).
  - *a* before consonant sounds: a book, a university
  - *an* before vowel sounds: an apple, an hour
- Use **the** for specific nouns already known to the reader (definite).
  - Second mention: I saw a dog. The dog was friendly.
  - Unique things: the sun, the internet
  - Superlatives: the best, the tallest
- Use **no article** (zero article) for:
  - Plural general nouns: Cats are cute. (NOT The cats are cute.)
  - Abstract nouns: Love is powerful.
  - Languages, sports, meals: I speak Chinese. Let's play basketball.

**Common Mistakes:**
- ❌ "I have a idea." → ✅ "I have an idea."
- ❌ "The life is beautiful." → ✅ "Life is beautiful."
- ❌ "She is best student." → ✅ "She is the best student."`
    },
    "Grammar / Verb Tense": {
      title: "Verb Tense (动词时态)",
      content: `Verb tenses indicate when an action occurs (past, present, future).

**12 English Tenses:**

**Present Tenses:**
- Simple Present: habits, facts (I write every day.)
- Present Continuous: ongoing actions (I am writing now.)
- Present Perfect: past actions with present relevance (I have written three pages.)
- Present Perfect Continuous: ongoing duration (I have been writing for two hours.)

**Past Tenses:**
- Simple Past: completed actions (I wrote yesterday.)
- Past Continuous: interrupted actions (I was writing when you called.)
- Past Perfect: earlier past action (I had written before dinner.)
- Past Perfect Continuous: ongoing past duration (I had been writing for an hour when...)

**Future Tenses:**
- Simple Future: predictions, decisions (I will write tomorrow.)
- Future Continuous: ongoing future actions (I will be writing at 8 PM.)
- Future Perfect: completed by future time (I will have written by Friday.)
- Future Perfect Continuous: duration by future time (I will have been writing for 3 hours.)

**Common Mistakes:**
- ❌ "I have seen him yesterday." → ✅ "I saw him yesterday." (specific past time = simple past)
- ❌ "I am knowing the answer." → ✅ "I know the answer." (stative verbs don't use continuous)
- ❌ "She has 25 when she married." → ✅ "She was 25 when she married." (age in past = was)`
    },
    "Grammar / Subject-Verb Agreement": {
      title: "Subject-Verb Agreement (主谓一致)",
      content: `The verb must agree with its subject in number (singular/plural).

**Rules:**
- Singular subject → singular verb (ends in -s): She writes. The cat sleeps.
- Plural subject → plural verb (no -s): They write. The cats sleep.
- Compound subjects with "and" → plural: Tom and Jerry are friends.
- Compound subjects with "or/nor" → agrees with nearest: Neither the students nor the teacher is here.
- Indefinite pronouns (everyone, somebody, each) → singular: Everyone is ready.
- Collective nouns (team, family, group) → context-dependent:
  - As a unit → singular: The team wins.
  - As individuals → plural: The team are arguing.
- Phrases between subject and verb don't change agreement:
  - The book on the table is mine. (NOT are mine)

**Common Mistakes:**
- ❌ "The list of items are long." → ✅ "The list of items is long."
- ❌ "Everyone have their opinion." → ✅ "Everyone has their opinion."
- ❌ "Neither my brother nor my sisters likes it." → ✅ "Neither my brother nor my sisters like it."`
    },
    "Grammar / Pronoun Usage": {
      title: "Pronoun Usage (代词用法)",
      content: `Pronouns replace nouns to avoid repetition.

**Types of Pronouns:**
- Subject: I, you, he, she, it, we, they
- Object: me, you, him, her, it, us, them
- Possessive: mine, yours, his, hers, its, ours, theirs
- Reflexive: myself, yourself, himself, herself, itself, ourselves, themselves

**Rules:**
- Use subject pronouns as the subject: She went to the store. (NOT Her went...)
- Use object pronouns after verbs/prepositions: Give it to me. (NOT ...to I)
- Possessive pronouns show ownership: This book is mine.
- Reflexive pronouns: when subject and object are the same: I taught myself.
- Pronoun must have a clear antecedent (the noun it replaces).

**Common Mistakes:**
- ❌ "Me and John went out." → ✅ "John and I went out."
- ❌ "Between you and I..." → ✅ "Between you and me..." (after preposition = object)
- ❌ "Each student should bring their book." → ✅ "Each student should bring his or her book." (formal)
- ❌ "The dog wagged it's tail." → ✅ "The dog wagged its tail." (possessive, NOT contraction)`
    },
    "Grammar / Preposition Usage": {
      title: "Preposition Usage (介词用法)",
      content: `Prepositions show relationships between nouns and other words.

**Common Prepositions:**
- Time: at (specific), on (days), in (months/years/seasons)
  - at 5 PM, on Monday, in April, in 2024, in summer
- Place: at (point), on (surface), in (enclosed space)
  - at the door, on the table, in the room
- Movement: to, into, onto, toward, through
- Others: of, for, with, by, about, between, among

**Fixed Preposition Combinations:**
- interested in, good at, afraid of, depend on, listen to
- wait for, look at, think about, worry about, believe in

**Common Mistakes:**
- ❌ "I'm good in English." → ✅ "I'm good at English."
- ❌ "She arrived to the station." → ✅ "She arrived at the station."
- ❌ "We discussed about the problem." → ✅ "We discussed the problem." (discuss = no preposition)
- ❌ "I've been here since 3 years." → ✅ "I've been here for 3 years." (duration = for)`
    },
    "Grammar / Conjunction/Connector": {
      title: "Conjunction/Connector (连词/连接词)",
      content: `Conjunctions connect words, phrases, or clauses.

**Types:**
- Coordinating (FANBOYS): for, and, nor, but, or, yet, so
  - Connect equal elements: I like tea and coffee.
- Subordinating: because, although, if, when, while, since, unless
  - Introduce dependent clauses: I stayed home because it rained.
- Conjunctive Adverbs: however, therefore, moreover, nevertheless, consequently
  - Connect independent clauses with semicolon: It rained; however, we went out.

**Rules:**
- Use coordinating conjunctions to join equal structures.
- Use subordinating conjunctions to show cause, time, condition, contrast.
- Punctuation:
  - Independent + Independent (with FANBOYS) → comma before: I studied, but I failed.
  - Dependent + Independent → comma after: Because it rained, we stayed home.
  - Independent + Dependent → no comma: We stayed home because it rained.

**Common Mistakes:**
- ❌ "I was tired, so I went to bed, but I couldn't sleep." → ✅ Split into two sentences.
- ❌ "Although it was raining, but we went out." → ✅ "Although it was raining, we went out." (don't use both)
- ❌ "I like apples, however I don't like oranges." → ✅ "I like apples; however, I don't like oranges."`
    },
    "Grammar / Modifier Placement": {
      title: "Modifier Placement (修饰语位置)",
      content: `Modifiers describe other words and must be placed close to what they modify.

**Types of Modifiers:**
- Adjectives: describe nouns (a beautiful flower)
- Adverbs: describe verbs, adjectives, other adverbs (run quickly, very tall)
- Phrases/Clauses: which/that clauses, participial phrases

**Rules:**
- Place modifiers immediately before/after the word they modify.
- Avoid dangling modifiers: the modifier must logically connect to the subject.
- Avoid misplaced modifiers: don't place between verb and object.

**Common Mistakes:**
- ❌ "I almost drove for 6 hours." → ✅ "I drove for almost 6 hours."
- ❌ "Running down the street, the dog chased me." → ✅ "Running down the street, I saw the dog chase me." (dangling)
- ❌ "She gave a bone to the dog with a red collar." → ✅ "She gave a bone to the dog that had a red collar." (ambiguous)`
    },
    "Grammar / Sentence Structure": {
      title: "Sentence Structure (句子结构)",
      content: `English sentences follow a specific word order and structural rules.

**Basic Word Order:** Subject + Verb + Object (SVO)
- I (S) eat (V) apples (O).

**Sentence Types:**
- Simple: one independent clause (I write.)
- Compound: two+ independent clauses (I write, and she reads.)
- Complex: independent + dependent (I write when I'm inspired.)
- Compound-Complex: 2+ independent + 1+ dependent (I write when inspired, and she reads always.)

**Common Structural Errors:**
- Run-on sentences: two independent clauses without proper punctuation
  - ❌ "I love writing it is fun." → ✅ "I love writing. It is fun."
- Comma splice: joining independent clauses with only a comma
  - ❌ "I love writing, it is fun." → ✅ "I love writing; it is fun." or "I love writing because it is fun."
- Fragments: incomplete sentences missing subject or verb
  - ❌ "Because I love writing." → ✅ "I write because I love writing."

**Common Mistakes:**
- ❌ "The book that I bought yesterday which was expensive." → ✅ "The book that I bought yesterday was expensive."
- ❌ "She asked me where was the station." → ✅ "She asked me where the station was." (indirect question order)`
    },
    "Vocabulary / Word Choice": {
      title: "Word Choice (词汇选择)",
      content: `Choosing the right word depends on context, register, and precise meaning.

**Common Confusions:**
- affect (verb) vs. effect (noun): The rain affected our plans. The effect was disappointing.
- than (comparison) vs. then (time/sequence): She is taller than me. We ate, then we left.
- its (possessive) vs. it's (it is): The dog wagged its tail. It's raining.
- their (possessive) vs. they're (they are) vs. there (place): Their house is there. They're happy.
- who (subject) vs. whom (object): Who called? Whom did you call?
- fewer (countable) vs. less (uncountable): fewer books, less water
- farther (physical distance) vs. further (abstract): I ran farther. Let's discuss further.

**Common Mistakes:**
- ❌ "The weather will effect our plans." → ✅ "The weather will affect our plans."
- ❌ "I have less books than you." → ✅ "I have fewer books than you."
- ❌ "She is more taller than me." → ✅ "She is taller than me." (comparative already has -er)`
    },
    "Vocabulary / Idiomatic Expression": {
      title: "Idiomatic Expression (习语表达)",
      content: `Idioms are fixed expressions whose meanings cannot be deduced from individual words.

**Types:**
- Phrasal Verbs: verb + particle (give up, look into, put off)
  - I gave up smoking. (quit)
  - Let's put off the meeting. (postpone)
- Collocations: words that naturally go together
  - make a decision (NOT do a decision)
  - do homework (NOT make homework)
  - strong coffee (NOT powerful coffee)
- Fixed Expressions: by heart, on purpose, in a nutshell

**Common Mistakes:**
- ❌ "I did a mistake." → ✅ "I made a mistake."
- ❌ "Can you say me the time?" → ✅ "Can you tell me the time?"
- ❌ "I'm agree with you." → ✅ "I agree with you."
- ❌ "He suggested me to go." → ✅ "He suggested that I go." or "He suggested going."`
    },
    "Vocabulary / Redundancy": {
      title: "Redundancy (冗余)",
      content: `Redundancy occurs when the same idea is expressed multiple times unnecessarily.

**Common Redundancies:**
- ❌ "free gift" → ✅ "gift" (gifts are free by definition)
- ❌ "past history" → ✅ "history"
- ❌ "end result" → ✅ "result"
- ❌ "unexpected surprise" → ✅ "surprise"
- ❌ "return back" → ✅ "return"
- ❌ "repeat again" → ✅ "repeat"
- ❌ "advance planning" → ✅ "planning"
- ❌ "combine together" → ✅ "combine"

**Common Mistakes:**
- ❌ "I personally think that in my opinion..." → ✅ "I think..." (choose one)
- ❌ "The final outcome at the end of the day..." → ✅ "The outcome..."
- ❌ "She nodded her head." → ✅ "She nodded." (nodding implies the head)`
    },
    "Clarity / Sentence Fragment": {
      title: "Sentence Fragment (句子片段)",
      content: `A sentence fragment is an incomplete sentence that lacks a subject, verb, or complete thought.

**Types of Fragments:**
- Missing subject: ❌ "Went to the store." → ✅ "I went to the store."
- Missing verb: ❌ "The dog in the yard." → ✅ "The dog is in the yard."
- Dependent clause alone: ❌ "Because I was tired." → ✅ "I left because I was tired."
- Phrase alone: ❌ "Such as cats, dogs, and birds." → ✅ "I like pets, such as cats, dogs, and birds."

**How to Fix:**
1. Identify what's missing (subject, verb, or complete thought)
2. Attach the fragment to a nearby sentence, or
3. Add the missing elements to make it complete.

**Common Mistakes:**
- ❌ "Although it was raining. We went out." → ✅ "Although it was raining, we went out."
- ❌ "For example, cats and dogs." → ✅ "I like pets, for example, cats and dogs."`
    },
    "Clarity / Ambiguity": {
      title: "Ambiguity (歧义)",
      content: `Ambiguity occurs when a sentence can be interpreted in multiple ways.

**Types of Ambiguity:**
- Pronoun ambiguity: unclear what a pronoun refers to
  - ❌ "Tom told Jerry that he made a mistake." (Who made the mistake?)
  - ✅ "Tom told Jerry, 'I made a mistake.'"
- Modifier ambiguity: unclear what a modifier describes
  - ❌ "I saw a man with a telescope on the hill." (Who has the telescope?)
  - ✅ "Using a telescope, I saw a man on the hill."
- Structural ambiguity: unclear sentence structure
  - ❌ "Flying planes can be dangerous." (Are planes flying, or is someone flying planes?)
  - ✅ "Planes that are flying can be dangerous." or "Flying planes can be dangerous for pilots."

**How to Fix:**
1. Identify the unclear reference
2. Restructure to make the meaning explicit
3. Replace ambiguous pronouns with specific nouns

**Common Mistakes:**
- ❌ "When the boy arrived at the park, his father called and he was upset." → ✅ Split into two sentences.
- ❌ "She said she loved him yesterday." → ✅ "Yesterday, she said she loved him." or "She said she loved him the day before."`
    },
    "Clarity / Incomplete Thought": {
      title: "Incomplete Thought (不完整思路)",
      content: `An incomplete thought is a sentence that starts an idea but doesn't finish it.

**Common Patterns:**
- Unfinished comparisons: ❌ "This book is better than..." → ✅ "This book is better than the last one."
- Incomplete conditions: ❌ "If you study hard..." → ✅ "If you study hard, you will pass."
- Unfinished lists: ❌ "I need to buy apples, bananas, and..." → ✅ Complete the list.
- Abandoned structures: ❌ "The reason why I came is because..." → ✅ "The reason why I came is to help."

**How to Fix:**
1. Identify the incomplete structure
2. Complete the thought with the missing information
3. If the idea is unclear, consider rewriting entirely.

**Common Mistakes:**
- ❌ "Not only did she win, but also..." → ✅ "Not only did she win, but she also broke the record."
- ❌ "Whether you like it or not..." → ✅ "Whether you like it or not, we must go."`
    },
    "Mechanics / Punctuation": {
      title: "Punctuation (标点符号)",
      content: `Punctuation marks organize writing and clarify meaning.

**Common Marks:**
- Period (.): ends declarative sentences
- Comma (,): separates elements, indicates pauses
  - Lists: I bought apples, bananas, and oranges.
  - After introductory elements: However, I disagree.
  - Before FANBOYS joining independent clauses: I tried, but I failed.
  - Around non-essential info: My brother, who lives in London, is visiting.
- Semicolon (;): joins related independent clauses
  - I have a big test tomorrow; I can't go out.
- Colon (:): introduces lists, explanations, quotes
  - I need three things: time, money, and patience.
- Apostrophe ('): shows possession or contractions
  - Sarah's book (possession)
  - don't = do not (contraction)
- Quotation marks (" "): direct speech, titles
  - She said, "I'll be there."

**Common Mistakes:**
- ❌ "I love cooking, my family and my pets." → ✅ "I love cooking, my family, and my pets." (Oxford comma)
- ❌ "Its a beautiful day." → ✅ "It's a beautiful day."
- ❌ "The cat sat on the mat, it was soft." → ✅ "The cat sat on the mat; it was soft." (comma splice)`
    },
    "Mechanics / Capitalization": {
      title: "Capitalization (大写)",
      content: `Capital letters signal importance and mark sentence beginnings.

**Capitalize:**
- First word of every sentence
- Proper nouns: names, places, organizations
  - China, Beijing, John Smith, Microsoft
- Days, months, holidays: Monday, April, Christmas
- Titles before names: Dr. Smith, President Lincoln
- The pronoun "I"
- Languages, nationalities, religions: English, Chinese, Buddhism
- Title case: major words in titles (A Tale of Two Cities)

**Don't Capitalize:**
- Seasons (unless personified): spring, summer
- Subjects (unless languages): math, science (but English)
- After colons (unless proper noun or full sentence): I need: eggs, milk, and bread.
- Directions (unless regions): Drive north. (direction) vs. I live in the North. (region)

**Common Mistakes:**
- ❌ "i love chinese food." → ✅ "I love Chinese food."
- ❌ "She studies english Literature." → ✅ "She studies English literature."
- ❌ "The President visited the east coast." → ✅ "The President visited the East Coast." (specific region)`
    },
    "Mechanics / Spelling": {
      title: "Spelling (拼写)",
      content: `Correct spelling is essential for clear communication.

**Common Spelling Challenges:**
- Homophones (same sound, different spelling/meaning):
  - their/there/they're, your/you're, to/too/two
  - affect/effect, accept/except, principle/principal
- Silent letters: knowledge, psychology, island, knight
- Double letters: accommodate, commitment, occurrence
- -ie vs. -ei: believe, receive (i before e, except after c)
- British vs. American: colour/color, realise/realize

**Common Mistakes:**
- ❌ "definately" → ✅ "definitely"
- ❌ "seperate" → ✅ "separate"
- ❌ "occured" → ✅ "occurred"
- ❌ "untill" → ✅ "until"
- ❌ "wich" → ✅ "which"

**Tips:**
1. Use spell-check tools, but don't rely on them entirely.
2. Read extensively to internalize correct spellings.
3. Practice tricky words regularly.`
    },
    "Style / Phrasing": {
      title: "Phrasing (措辞)",
      content: `Natural phrasing makes your writing sound more fluent and idiomatic.

**Unnatural vs. Natural:**
- ❌ "I very like it." → ✅ "I like it very much." or "I really like it."
- ❌ "I have 20 years old." → ✅ "I am 20 years old."
- ❌ "I'm boring." → ✅ "I'm bored." (boring = causes boredom; bored = feeling boredom)
- ❌ "Open the light." → ✅ "Turn on the light."
- ❌ "I'm agree." → ✅ "I agree."

**Improving Phrasing:**
1. Read extensively in English to absorb natural patterns.
2. Avoid literal translation from your native language.
3. Use collocations dictionaries for word combinations.
4. Practice paraphasing sentences in different ways.

**Common Mistakes:**
- ❌ "Do a photo" → ✅ "Take a photo"
- ❌ "Make a party" → ✅ "Have/throw a party"
- ❌ "Say the truth" → ✅ "Tell the truth"`
    },
    "Style / Conciseness": {
      title: "Conciseness (简洁)",
      content: `Concise writing expresses ideas clearly without unnecessary words.

**Wordy vs. Concise:**
- ❌ "Due to the fact that" → ✅ "Because"
- ❌ "In spite of the fact that" → ✅ "Although"
- ❌ "At this point in time" → ✅ "Now"
- ❌ "In the near future" → ✅ "Soon"
- ❌ "Make an improvement" → ✅ "Improve"
- ❌ "Give consideration to" → ✅ "Consider"
- ❌ "There is a need for" → ✅ "We need"

**How to Improve Conciseness:**
1. Remove filler words: very, really, quite, actually
2. Use active voice instead of passive: "The team completed the project" (not "The project was completed by the team")
3. Avoid redundant phrases (see Redundancy section)
4. Replace weak verb + noun with strong verbs: "make a decision" → "decide"

**Common Mistakes:**
- ❌ "In my personal opinion, I think that..." → ✅ "I think..."
- ❌ "The reason why is because..." → ✅ "The reason is..." or "Because..."`
    },
    "Style / Tone & Register": {
      title: "Tone & Register (语气与语域)",
      content: `Tone is the writer's attitude; register is the formality level appropriate to the context.

**Register Levels:**
- Formal: academic writing, business letters, official documents
  - "I would like to inquire about..."
  - Avoid contractions, slang, colloquialisms
- Neutral: everyday communication, emails, reports
  - "I'm writing to ask about..."
  - Standard vocabulary, some contractions OK
- Informal: friends, social media, personal notes
  - "Hey, what's up?"
  - Slang, idioms, contractions acceptable

**Tone Indicators:**
- Polite: "Could you please...", "I would appreciate..."
- Direct: "Do this.", "I need..."
- Tentative: "It seems that...", "Perhaps..."
- Confident: "Clearly...", "Undoubtedly..."

**Common Mistakes:**
- ❌ Using slang in academic writing: "The results were kinda weird."
  → ✅ "The results were somewhat unusual."
- ❌ Too formal in casual email: "I hereby request..."
  → ✅ "I'd like to ask..."
- ❌ "I want the report ASAP." (too direct for supervisor)
  → ✅ "Could you please send the report at your earliest convenience?"`
    }
  };

  return rules[errorType] || null;
}

// 5. Get example sentences for each error type
function getExamples(errorType, limit = 3) {
  return db.prepare(`
    SELECT
      i.original_text,
      i.correction,
      i.refine,
      d.explanation,
      a.rule,
      a.tip
    FROM inputs i
    JOIN diagnoses d ON i.id = d.input_id
    LEFT JOIN advice a ON i.id = a.input_id
    WHERE d.error_type = ?
    ORDER BY i.timestamp DESC
    LIMIT ?
  `).all(errorType, limit);
}

// 4. Get total statistics
const stats = db.prepare(`
  SELECT 
    COUNT(DISTINCT i.id) as total_inputs,
    COUNT(d.id) as total_diagnoses
  FROM inputs i
  LEFT JOIN diagnoses d ON i.id = d.input_id
  WHERE 1=1 ${dateFilter}
`).get();

// Generate Obsidian Dashboard report
async function generateReport() {
  const date = new Date().toISOString().split("T")[0];
  const provider = llmManager.getCurrentProviderName();
  const config = llmManager.config;

  // Get the correct handbook model based on current provider
  let handbookModel;
  if (provider === "qwen") {
    handbookModel = config.QwenProModel || "qwen3-max";
  } else if (provider === "deepseek") {
    handbookModel = config.DeepseekProModel || "deepseek-reasoner";
  } else {
    handbookModel = config.GeminiProModel || "gemini-3.0-pro";
  }

  let md = `# 📘 Personal English Error Handbook\n\n`;
  md += `> [!INFO] Generated with: **${provider.toUpperCase()}** (${handbookModel}) on ${date}\n\n`;

  // 1. Overview Section (Abstract Callout)
  const topError = errorFrequency.length > 0 ? errorFrequency[0].error_type : "N/A";
  md += `> [!ABSTRACT] 📊 Performance Summary (Date: ${date})\n`;
  md += `> - **Period**: Last ${days} days\n`;
  md += `> - **Inputs Analyzed**: ${stats.total_inputs}\n`;
  md += `> - **Total Diagnoses**: ${stats.total_diagnoses}\n`;
  md += `> - **Unique Errors**: ${errorFrequency.length}\n`;
  md += `> - **Critical Priority**: ${topError}\n\n`;

  // 2. Frequency Ranking (Markdown Table)
  if (errorFrequency.length > 0) {
    md += `\n## 🎯 Error Frequency Ranking\n\n`;
    md += `| Error Type | Freq | Severity |\n`;
    md += `| :--- | :--- | :--- |\n`;

    for (const err of errorFrequency) {
      const severity = err.major_count > 0 ? "🔴 Major" : err.moderate_count > 0 ? "🟡 Moderate" : "🟢 Minor";
      md += `| ${err.error_type} | ${err.count} | ${severity} |\n`;
    }
    md += `\n`;
  }

  // 3. Trend Analysis (Table)
  if (trendData.length >= 2) {
    md += `\n## 📈 Weekly Trend\n\n`;
    md += `| Week | Errors |\n`;
    md += `| :--- | :--- |\n`;

    for (const week of trendData.slice(-8)) {
      const bar = "▓".repeat(Math.min(week.error_count, 20));
      md += `| ${week.week} | ${bar} ${week.error_count} |\n`;
    }
    md += `\n`;

    // Trend direction
    if (trendData.length >= 4) {
      const recent = trendData.slice(-2).reduce((sum, t) => sum + t.error_count, 0);
      const older = trendData.slice(-4, -2).reduce((sum, t) => sum + t.error_count, 0);
      const change = ((recent - older) / Math.max(older, 1) * 100).toFixed(1);

      if (change < 0) {
        md += `> [!SUCCESS] ✅ Good news! Your errors decreased by **${Math.abs(change)}%** in recent weeks.\n\n`;
      } else if (change > 0) {
        md += `> [!CAUTION] ⚠️ Errors increased by **${change}%** in recent weeks. Keep practicing!\n\n`;
      } else {
        md += `> [!NOTE] ➡️ Your error rate remained stable in recent weeks.\n\n`;
      }
    }
  }

  // 4. Detailed Error Analysis (Collapsible Callouts)
  if (errorFrequency.length > 0) {
    md += `\n## 🔍 Detailed Error Analysis\n\n`;

    for (const err of errorFrequency) {
      const severityIcon = err.major_count > 0 ? "🔴" : err.moderate_count > 0 ? "🟡" : "🟢";
      md += `> [!CAUTION]- ${severityIcon} ${err.error_type} (${err.count} Occurrences)\n`;
      md += `>\n`;

      const examples = getExamples(err.error_type);
      if (examples.length > 0) {
        for (let i = 0; i < examples.length; i++) {
          const ex = examples[i];

          // Original (Failure)
          md += `> ### 📝 Example ${i + 1}\n`;
          md += `> \n`;
          md += `> > [!FAILURE] Original (❌)\n`;
          md += `> > \`${escapeCallout(ex.original_text)}\`\n`;
          md += `> \n`;

          // Corrected (Success)
          if (ex.correction) {
            md += `> > [!SUCCESS] Corrected (✅)\n`;
            md += `> > \`${escapeCallout(ex.correction)}\`\n`;
            md += `> \n`;
          }

          // Natural Phrasing (Tip)
          if (ex.refine) {
            md += `> > [!TIP] Natural Phrasing (✨)\n`;
            md += `> > \`${escapeCallout(ex.refine)}\`\n`;
            md += `> \n`;
          }

          // Logic & Rules (Info)
          md += `> > [!INFO] Logic & Rules\n`;
          if (ex.explanation) {
            md += `> > **Why**: ${escapeCallout(ex.explanation)}\n`;
          }
          if (ex.rule) {
            md += `> > **Rule**: ${escapeCallout(ex.rule).replace(/\n/g, "<br>")}\n`;
          }
          if (ex.tip) {
            md += `> > **Pro Tip**: ${escapeCallout(ex.tip).replace(/\n/g, "<br>")}\n`;
          }
          md += `> \n`;

          // Separator between examples
          if (i < examples.length - 1) {
            md += `> ---\n>\n`;
          }
        }
      }

      md += `> ---\n\n`;
    }
  }

  // 5. Grammar Rules Reference (LLM-Tailored)
  if (errorFrequency.length > 0) {
    md += `\n## 📚 Grammar Rules Reference (AI-Powered)\n\n`;
    md += `> [!INFO] 📖 Personalized Grammar Explanations\n`;
    md += `> This section provides **AI-generated**, customized grammar rules based on your actual errors and examples.\n\n`;

    // Group errors by category
    const categories = {};
    for (const err of errorFrequency) {
      const category = err.error_type.split(" / ")[0];
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(err);
    }

    // Collect all LLM generation promises for parallel execution
    const allRules = new Map(); // error_type → rule
    const pendingCalls = [];

    for (const [category, errors] of Object.entries(categories)) {
      for (const err of errors) {
        const examples = getExamples(err.error_type, 5);
        pendingCalls.push(
          generateTailoredGrammarRule(err.error_type, examples)
            .then(rule => ({ errorType: err.error_type, category, rule }))
            .catch(error => {
              console.warn(`⚠️  Failed to generate rule for ${err.error_type}: ${error.message}`);
              return { errorType: err.error_type, category, rule: getStaticGrammarRule(err.error_type) };
            })
        );
      }
    }

    // Execute all LLM calls in parallel
    console.log(`\n🤖 Generating ${pendingCalls.length} grammar rules with ${provider.toUpperCase()} (${handbookModel})...`);
    const results = await Promise.allSettled(pendingCalls);

    // Collect results
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        allRules.set(result.value.errorType, result.value);
      }
    }

    // Build markdown from results (maintain category order)
    for (const [category, errors] of Object.entries(categories)) {
      md += `### ${getCategoryIcon(category)} ${category}\n\n`;

      for (const err of errors) {
        const ruleData = allRules.get(err.error_type);
        const rule = ruleData ? ruleData.rule : null;

        if (rule && rule.content) {
          md += `> [!NOTE]- ${rule.title}\n`;
          md += `> \n`;
          const lines = rule.content.split("\n");
          for (const line of lines) {
            if (line.trim() === "") {
              md += `> \n`;
            } else {
              let cleanedLine = line.replace(/^>\s*/, "");
              cleanedLine = cleanedLine.replace(/\|/g, "\\|");
              md += `> ${cleanedLine}\n`;
            }
          }
          md += `\n\n`;
        }
      }
    }
  }

  // 6. Top 3 Priorities
  if (errorFrequency.length > 0) {
    md += `\n## 🎯 Top 3 Priorities\n\n`;
    md += `> [!EXAMPLE] 💡 Focus on these to see the biggest improvement\n`;
    md += `> \n`;

    const top3 = errorFrequency.slice(0, 3);
    for (let i = 0; i < top3.length; i++) {
      md += `> ${i + 1}. **${top3[i].error_type}** - ${top3[i].count} occurrences\n`;
    }
    md += `\n`;
  }

  md += `---\n\n`;
  md += `*Generated by IGT (Interactive Grammar Tool) with AI-powered customization*\n`;

  return md;
}

// Escape special characters that could break callout syntax
function escapeCallout(str) {
  if (!str) return "";
  // Escape characters that could interfere with callout parsing
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Get category icon
function getCategoryIcon(category) {
  const icons = {
    "Grammar": "🔧",
    "Vocabulary": "📝",
    "Mechanics": "⚙️",
    "Style": "🎨",
    "Clarity": "💡"
  };
  return icons[category] || "📌";
}

const report = await generateReport();

// Save to file with LLM provider in filename
const dateStr = new Date().toISOString().split("T")[0];
const provider = llmManager.getCurrentProviderName();

// Use ReportPath from config if available
let outputPath;
const baseFilename = `handbook_${dateStr}_${provider}.md`;

if (config.ReportPath) {
  const reportDir = path.isAbsolute(config.ReportPath) ? config.ReportPath : path.join(projectRoot, config.ReportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  outputPath = path.join(reportDir, baseFilename);
} else {
  outputPath = path.join(projectRoot, `docs`, baseFilename);
  const docsDir = path.join(projectRoot, `docs`);
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }
}

fs.writeFileSync(outputPath, report, "utf8");

console.log(`\n✅ Personal Error Handbook generated: ${outputPath}`);
console.log(`📊 Analyzed ${stats.total_inputs} inputs with ${stats.total_diagnoses} diagnoses`);
console.log(`🎯 Found ${errorFrequency.length} unique error types`);

if (incremental) {
  const cacheDir = path.join(projectRoot, ".cache");
  if (fs.existsSync(cacheDir)) {
    const cachedFiles = fs.readdirSync(cacheDir).filter(f => f.startsWith("rule_") && f.endsWith(".json"));
    console.log(`⚡ Incremental mode: ${cachedFiles.length} rules cached`);
  }
}

console.log(`\n💡 Tip: Use --incremental flag to reduce API calls by 60-80%`);

db.close();
