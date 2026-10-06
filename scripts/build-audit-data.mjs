// Builds comprehensive audit fix data
// 1. Difficulty recalibration for 200 questions (100 unknown + 100 Space Bunny)
// 2. Progressively writes files for the migration

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "..", "igt_data.db");
const artifactsDir = path.resolve(__dirname, "..", "artifacts");

const db = new Database(dbPath);

// ---- Difficulty rules ----
// Based on: clause count, vocabulary complexity, passive voice, conditional/subjunctive mood,
// register level, prompt length
function classifyDifficulty(id, promptZh, refAnswer, gp) {
  const ref = refAnswer;
  const promptLen = promptZh.length;
  const refLen = ref.length;
  
  // Count clauses by key structural markers
  const coordMarkers = (ref.match(/,?\s+(and|but|or|yet|so)\s+/gi) || []).length;
  const subordMarkers = (ref.match(/\b(that|which|who|whom|when|where|because|if|although|though|while|since|unless|until|after|before|once|as|whether|even though|as soon as|provided that|as long as)\b/gi) || []).length;
  const clauseCount = 1 + coordMarkers + subordMarkers;
  
  const hasPassive = /\b(is|are|was|were|be|been|has been|have been|had been)\s+\w+(ed|en)\b/i.test(ref);
  const hasSubjunctive = /\b(if\s+\w+\s+were|would have|should have|could have|might have|had\s+\w+\s+would)\b/i.test(ref);
  const hasInversion = /^(not until|never|hardly|scarcely|no sooner|only|nor|neither)\b/i.test(ref.trim());
  const longWords = (ref.match(/\b\w{11,}\b/g) || []).length;
  const hasHadPP = /\bhad\s+been\b|\bhad\s+\w+ed\b/i.test(ref);
  
  // Simplicity signals
  const isVeryShort = promptLen < 12 && clauseCount <= 2;
  const isConversation = /\b(I|you|we|my|your|our|me)\b/i.test(promptZh.match(/[你我]/) ? ref : '');
  const basicVocab = longWords === 0 && refLen < 60;
  
  let score = 0;
  score += Math.max(0, clauseCount - 1) * 1.5;
  if (hasPassive) score += 0.5;
  if (hasSubjunctive || hasHadPP) score += 2;
  if (hasInversion) score += 1;
  if (longWords >= 2) score += 1;
  if (longWords >= 5) score += 1;
  
  if (isVeryShort && basicVocab) score -= 2;
  
  if (score <= 1) return "easy";
  if (score <= 3.5) return "standard";
  return "challenge";
}

// ---- Hint generation for unknown questions ----
function generateHints(id, promptZh, refAnswer, gp, difficulty) {
  const grammarPoints = {
    "Possibility": {
      simple: (p) => "要表达的是\"不一定\"或\"有可能\"的意思，不是确定的。",
      intermediate: (p) => `这句里有一个不确定的判断——如果条件变了，结论也可能是另一种。用 may、might 或 could 来表达这种不确定性。`,
      complete: (p) => {
        const words = refAnswer.split(" ");
        const firstMay = words.findIndex(w => /^(may|might|could)$/i.test(w));
        if (firstMay >= 0) {
          return `${words.slice(0, firstMay + 1).join(" ")} _____`;
        }
        return "试着用 may/might/could 中的一个来翻译\"可能/也许\"。";
      },
    },
    "Deduction": {
      simple: (p) => "需要一个表示\"一定是\"或\"想必是\"的表达，因为前面已经给出了推理的依据。",
      intermediate: (p) => "用 must have + 过去分词来表达\"从证据推出过去肯定发生了某事\"。如果推理是当前状态，用 must be。",
      complete: (p) => {
        if (refAnswer.includes("must have been")) return "用 must have been + 过去分词来表达\"一定是被……\"。";
        if (refAnswer.includes("must have")) return "用 must have + 过去分词来表达\"一定是做了……\"。";
        return "用 must + 动词原形来表达\"必须是……\"。";
      },
    },
    "Counterfactual past": {
      simple: (p) => "要表达\"要是当初……就不会……\"这种与过去事实相反的情况。",
      intermediate: (p) => "if 从句用 had + 过去分词 (过去完成时)，主句用 would/could/might + have + 过去分词。",
      complete: (p) => "If + [主语] + had (not) + 过去分词..., [主语] + would/could + have + 过去分词...",
    },
    "Modal passive": {
      simple: (p) => "主语是动作的承受者，不是执行者——要说明\"可以被……\"或\"必须被……\"。",
      intermediate: (p) => "用 must/should/can/may + be + 过去分词来表达\"必须/应该/可以/可能被……\"。",
      complete: (p) => {
        const modalMatch = refAnswer.match(/\b(must|should|can|could|may|might|has to|have to|need to)\b/i);
        if (modalMatch) return `${modalMatch[0]} be + 过去分词 + ...`;
        return "must/should/can + be + 过去分词来表达被动。";
      },
    },
    "Content clauses": {
      simple: (p) => "从句本身是一个完整的信息——谁做了什么、什么时候、去哪里等等——被嵌在一个更大的句子里。",
      intermediate: (p) => "用陈述语序转述问句：疑问词后接主语再接谓语，不要再倒装。记住间接引语中不能用 do/does/did。",
      complete: (p) => {
        if (refAnswer.includes("what ")) return "疑问词 what 后直接接主语和谓语，保持陈述语序。";
        if (refAnswer.includes("how ")) return "疑问词 how 后直接接主语和谓语，保持陈述语序。";
        if (refAnswer.includes("whether ")) return "whether 后直接接主语和谓语，保持陈述语序。";
        return "疑问词 + 主语 + 谓语 (陈述语序，不要倒装)。";
      },
    },
    "Concession": {
      simple: (p) => "前半句说一个事实，后半句说\"尽管如此，结果还是不同\"。",
      intermediate: (p) => "用 although/even though 开头或 though/although 在中间来表达\"虽然……但是……\"。",
      complete: (p) => {
        if (refAnswer.startsWith("Although")) return "Although [让步内容], [主句结果]。";
        if (refAnswer.startsWith("Even though")) return "Even though [让步内容], [主句结果]。";
        return "[让步从句], but/yet [主句结果]。";
      },
    },
    "Pattern changes meaning": {
      simple: (p) => "注意动词后面接 -ing 还是 to do 意思不同。这里是\"记得做过\"还是\"记得要做\"、\"尝试做某事\"还是\"试图去做\"？",
      intermediate: (p) => "remember/forget + to do = 记得/忘记要去做(未做)；remember/forget + doing = 记得/忘记做过(已做)。try + to do = 试图去做；try + doing = 试试看。",
      complete: (p) => {
        if (refAnswer.includes("remember to")) return "remember + to + 动词原形 = 记得去做(还没做)。";
        if (refAnswer.includes("remember")) return "remember + V-ing = 记得做过(已做)。";
        if (refAnswer.includes("forget to")) return "forget + to + 动词原形 = 忘记去做。";
        if (refAnswer.includes("tried") && refAnswer.includes("ing")) return "try + V-ing = 尝试用……方式。";
        return "注意动词后面是 to do (未做) 还是 doing (已做/方式)。";
      },
    },
    "Quantifiers": {
      simple: (p) => "要表达数量的多少——\"一点\"\"几个\"\"几乎没有\"\"很多\"，注意可数和不可数名词的区别。",
      intermediate: (p) => "a few + 可数名词 (几个)；a little + 不可数名词 (一点)；hardly any + 可数或不可数 (几乎没有)；a great many + 可数 (大量)。",
      complete: (p) => {
        if (refAnswer.includes("a little")) return "a little + 不可数名词 = 一点……。";
        if (refAnswer.includes("a few")) return "a few + 可数名词复数 = 几个……。";
        if (refAnswer.includes("hardly any")) return "hardly any + 名词 = 几乎没有。";
        if (refAnswer.includes("very few")) return "very few + 可数名词复数 = 极少。";
        if (refAnswer.includes("a great many")) return "a great many + 可数名词复数 = 大量。";
        return "注意数量词 + 名词的搭配（可数/不可数）。";
      },
    },
    "Dependent prepositions": {
      simple: (p) => "这句话里有些动词或形容词后面必须跟特定的介词，不能乱搭配。",
      intermediate: (p) => "常见的固定搭配：depend on、rely on、lead to、be used to、be good at、be worried about、insist on、base on。",
      complete: (p) => {
        const patterns = refAnswer.match(/\b(\w+(ed|ing|s)?)\s+(on|to|about|with|at|for|from|of|in)\b/gi) || [];
        if (patterns.length > 0) return `注意动词/形容词后的固定介词搭配：${patterns[0]}。`;
        return "注意动词后面的固定介词搭配。";
      },
    },
    "Parallelism": {
      simple: (p) => "这段话里有多件事或描述，它们在结构上应该保持平行——开头相同、词性一致。",
      intermediate: (p) => "并列的动作都用相同的动词形式（都是原形、都是 -ing、都是过去式、或者都是 to + 动词原形）。",
      complete: (p) => "确保并列的三项在形式上一一平行：都是同样的动词形态或名词短语。",
    },
  };
  
  const templates = grammarPoints[gp];
  if (!templates) {
    return {
      simple: "先理解中文要表达的核心意思，思考英文如何用对应的结构来表达。",
      intermediate: "确定主句的谓语结构，注意从句的逻辑关系和语序。",
      complete: "检查主谓一致和时态，确保从句保持正确的语序。",
    };
  }
  
  return {
    simple: typeof templates.simple === "function" ? templates.simple(promptZh) : templates.simple,
    intermediate: typeof templates.intermediate === "function" ? templates.intermediate(promptZh) : templates.intermediate,
    complete: typeof templates.complete === "function" ? templates.complete(promptZh) : templates.complete,
  };
}

// ---- Main ----
function main() {
  // 1. Get unknown questions
  const unknownQuestions = db.prepare(`
    SELECT id, prompt_zh, reference_answer, difficulty, 
           json_extract(practice_fields_json, '$.grammar_point[0]') as grammar_point
    FROM practice_questions WHERE generated_by = 'unknown'
    ORDER BY id
  `).all();
  
  // 2. Get Space Bunny questions
  const spaceBunnyQuestions = db.prepare(`
    SELECT id, prompt_zh, reference_answer, difficulty,
           json_extract(practice_fields_json, '$.grammar_point[0]') as grammar_point
    FROM practice_questions WHERE generated_by = 'Space Bunny'
    ORDER BY id
  `).all();
  
  // 3. Build difficulty recalibration
  const difficultyChanges = {};
  const hintChanges = {};
  
  for (const q of unknownQuestions) {
    const newDifficulty = classifyDifficulty(q.id, q.prompt_zh, q.reference_answer, q.grammar_point);
    if (newDifficulty !== q.difficulty) {
      difficultyChanges[q.id] = newDifficulty;
    }
    const newHints = generateHints(q.id, q.prompt_zh, q.reference_answer, q.grammar_point, newDifficulty);
    hintChanges[q.id] = newHints;
  }
  
  for (const q of spaceBunnyQuestions) {
    const newDifficulty = classifyDifficulty(q.id, q.prompt_zh, q.reference_answer, q.grammar_point);
    if (newDifficulty !== q.difficulty) {
      difficultyChanges[q.id] = newDifficulty;
    }
  }
  
  // 4. Write data files
  fs.writeFileSync(
    path.resolve(artifactsDir, "audit-difficulty.json"),
    JSON.stringify(difficultyChanges, null, 2)
  );
  fs.writeFileSync(
    path.resolve(artifactsDir, "audit-hints.json"),
    JSON.stringify(hintChanges, null, 2)
  );
  
  // 5. Summary
  const uqDiff = Object.entries(difficultyChanges).filter(([k]) => k.startsWith("language-g"));
  const sbDiff = Object.entries(difficultyChanges).filter(([k]) => k.startsWith("language-g"));
  
  console.log(`Difficulty changes: ${Object.keys(difficultyChanges).length}`);
  console.log(`  Unknown: ${uqDiff.length} changed`);
  const uqDist = {};
  for (const q of unknownQuestions) {
    const d = difficultyChanges[q.id] || q.difficulty;
    uqDist[d] = (uqDist[d] || 0) + 1;
  }
  console.log(`  Unknown new distribution: ${JSON.stringify(uqDist)}`);
  
  const sbDist = {};
  for (const q of spaceBunnyQuestions) {
    const d = difficultyChanges[q.id] || q.difficulty;
    sbDist[d] = (sbDist[d] || 0) + 1;
  }
  console.log(`  Space Bunny new distribution: ${JSON.stringify(sbDist)}`);
  
  console.log(`Hint changes: ${Object.keys(hintChanges).length}`);
  
  db.close();
}

main();