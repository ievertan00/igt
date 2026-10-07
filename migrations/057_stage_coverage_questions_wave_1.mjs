// First small review batch for the underrepresented Practice contexts.
// These questions remain inactive until a human reviews and approves them.
import { practiceQuestionId } from "../lib/features/practice/question-ids.mjs";
import { normalizePracticeContext } from "../lib/features/practice/contexts.mjs";

const QUESTIONS = [
  {
    id: "practice-202610-0005", prompt_zh: "我第一次吃这种抗过敏药，服药后还能开车吗？",
    reference_answer: "It's my first time taking this antihistamine. Is it safe to drive after taking it?",
    difficulty: "easy", context: "health-pharmacy", generated_by: "codex-review-draft",
    primary_target: "ask-medication-safety", learning_goal: "Ask whether a medicine affects a planned activity.",
    learning_rationale: "The learner links a first dose with a practical safety question.", register: "neutral",
    grammar_point: ["Is it safe to + verb?", "Present participle as modifier"],
    hints: { simple: "说明是第一次服用，再询问服药后能否开车。", intermediate: "用 Is it safe to…? 询问安全性；antihistamine 指抗组胺药。", complete: "It's my first time taking this _____. Is it safe to _____ after taking it?" },
  },
  {
    id: "practice-202610-0006", prompt_zh: "如果我今晚忘了服药，明早要补两片吗？",
    reference_answer: "If I forget to take a dose tonight, should I take two tablets tomorrow morning?",
    difficulty: "standard", context: "health-pharmacy", generated_by: "codex-review-draft",
    primary_target: "ask-about-missed-dose", learning_goal: "Ask what to do after missing a dose.",
    learning_rationale: "The conditional makes the missed dose hypothetical and the question asks for specific advice.", register: "neutral",
    grammar_point: ["First conditional", "Should for advice"],
    hints: { simple: "把今晚漏服作为假设，询问明早该怎么办。", intermediate: "if 从句用一般现在时；主句用 should 询问建议。", complete: "If I _____ to take a dose tonight, should I _____ two tablets tomorrow morning?" },
  },
  {
    id: "practice-202610-0007", prompt_zh: "这道汤里有花生吗？我对花生过敏。",
    reference_answer: "Does this soup contain peanuts? I'm allergic to them.",
    difficulty: "easy", context: "restaurants-cafes", generated_by: "codex-review-draft",
    primary_target: "ask-about-food-allergen", learning_goal: "Check whether a dish contains an allergen and explain why.",
    learning_rationale: "The learner asks about an ingredient before ordering and gives the relevant reason.", register: "neutral",
    grammar_point: ["Does + subject + base verb?", "Allergy expressions"],
    hints: { simple: "先问汤里有没有花生，再说明过敏。", intermediate: "一般现在时疑问句用 Does…contain…?；be allergic to 表示对……过敏。", complete: "Does this soup _____ peanuts? I'm _____ to them." },
  },
  {
    id: "practice-202610-0008", prompt_zh: "我们点的蛋糕还没上，可以帮忙查一下吗？",
    reference_answer: "Our cake hasn't arrived yet. Could you check on it for us?",
    difficulty: "standard", context: "restaurants-cafes", generated_by: "codex-review-draft",
    primary_target: "request-order-status-check", learning_goal: "Politely ask staff to check on a missing item.",
    learning_rationale: "Present perfect describes an expected item that has not arrived by now; could softens the request.", register: "neutral",
    grammar_point: ["Present perfect with yet", "Could you…? polite request"],
    hints: { simple: "说明蛋糕到现在还没来，并礼貌请服务员查看。", intermediate: "用 hasn't arrived yet 表示截至现在仍未送到；用 Could you…? 提请求。", complete: "Our cake _____ yet. Could you _____ on it for us?" },
  },
  {
    id: "practice-202610-0001", prompt_zh: "这场电影有英文字幕吗？",
    reference_answer: "Does this screening have English subtitles?",
    difficulty: "easy", context: "cinema-entertainment", generated_by: "codex-review-draft",
    primary_target: "ask-screening-accessibility", learning_goal: "Ask whether a screening includes subtitles in a chosen language.",
    learning_rationale: "The learner uses a direct present-simple question about a specific screening feature.", register: "neutral",
    grammar_point: ["Does + subject + base verb?", "Have for included features"],
    hints: { simple: "询问这一场放映是否配有英文字幕。", intermediate: "用 Does this screening have…? 询问场次配置。", complete: "Does this screening have _____ subtitles?" },
  },
  {
    id: "practice-202610-0002", prompt_zh: "我们买错了日期，票可以改到周六吗？",
    reference_answer: "We bought tickets for the wrong date. Can we change them to Saturday?",
    difficulty: "standard", context: "cinema-entertainment", generated_by: "codex-review-draft",
    primary_target: "request-ticket-date-change", learning_goal: "Explain a ticket-date mistake and ask to change it.",
    learning_rationale: "The learner connects a completed mistake with a practical request about the tickets.", register: "neutral",
    grammar_point: ["Past simple", "Can for requests"],
    hints: { simple: "先说明买错日期，再问能否改到周六。", intermediate: "已完成的购买用过去时；change tickets to Saturday 表示改签日期。", complete: "We _____ tickets for the wrong date. Can we _____ them to Saturday?" },
  },
  {
    id: "practice-202610-0003", prompt_zh: "谢谢你邀请我，不过我那天已经有安排了。",
    reference_answer: "Thanks for inviting me, but I already have plans that day.",
    difficulty: "easy", context: "friends-social", generated_by: "codex-review-draft",
    primary_target: "decline-invitation-politely", learning_goal: "Decline an invitation politely and give a brief reason.",
    learning_rationale: "The learner acknowledges the invitation before stating a prior commitment.", register: "informal",
    grammar_point: ["Thanks for + gerund", "Have plans"],
    hints: { simple: "先感谢邀请，再说那天已有安排。", intermediate: "thanks for 后接动名词；have plans 表示已有安排。", complete: "Thanks for _____ me, but I already have _____ that day." },
  },
  {
    id: "practice-202610-0004", prompt_zh: "我到得晚了，害你等了这么久，真不好意思。",
    reference_answer: "I'm sorry I'm so late and kept you waiting for so long.",
    difficulty: "standard", context: "friends-social", generated_by: "codex-review-draft",
    primary_target: "apologize-for-keeping-someone-waiting", learning_goal: "Apologize for arriving late and making someone wait.",
    learning_rationale: "The sentence names both the delay and its effect on the other person.", register: "informal",
    grammar_point: ["Keep + object + gerund", "Apology expressions"],
    hints: { simple: "为迟到和让对方久等道歉。", intermediate: "用 keep + 人 + waiting 表达让某人一直等。", complete: "I'm sorry I'm so late and _____ you _____ for so long." },
  },
  {
    id: "practice-202610-0011", prompt_zh: "这盒鸡蛋的保质期是明天，能换一盒日期晚一点的吗？",
    reference_answer: "This carton of eggs expires tomorrow. Could I exchange it for one with a later date?",
    difficulty: "standard", context: "supermarkets-shopping", generated_by: "codex-review-draft",
    primary_target: "exchange-short-dated-groceries", learning_goal: "Explain that a grocery item is near its expiry date and request an exchange.",
    learning_rationale: "The learner gives a concrete reason before making a polite exchange request.", register: "neutral",
    grammar_point: ["Expire + time expression", "Could I…? request"],
    hints: { simple: "指出鸡蛋明天到期，再礼貌询问能否换日期晚些的。", intermediate: "expire tomorrow 表示明天到期；exchange A for B 表示用 A 换 B。", complete: "This carton of eggs _____ tomorrow. Could I _____ it for one with a later date?" },
  },
  {
    id: "practice-202610-0012", prompt_zh: "会员价只在结账时自动生效，还是需要先扫描会员码？",
    reference_answer: "Does the member price apply automatically at checkout, or do I need to scan my membership code first?",
    difficulty: "challenge", context: "supermarkets-shopping", generated_by: "codex-review-draft",
    primary_target: "ask-how-member-discount-applies", learning_goal: "Ask whether a discount is automatic or requires an action first.",
    learning_rationale: "The parallel alternatives distinguish automatic application from a required checkout step.", register: "neutral",
    grammar_point: ["Alternative question", "Need to + verb"],
    hints: { simple: "比较会员价自动生效和先扫码两种情况。", intermediate: "用 or 连接两个选择；第二部分用 do I need to…? 询问是否需要操作。", complete: "Does the member price apply _____, or do I need to _____ my membership code first?" },
  },
  {
    id: "practice-202610-0009", prompt_zh: "维修师傅说下午会来，但没有告诉我具体时间。",
    reference_answer: "The repair technician said they'd come this afternoon, but they didn't give me a specific time.",
    difficulty: "standard", context: "appointments-services", generated_by: "codex-review-draft",
    primary_target: "report-missing-service-time", learning_goal: "Report a service visit window and note that no exact time was given.",
    learning_rationale: "The contrast preserves the broad appointment window and the missing detail.", register: "neutral",
    grammar_point: ["Reported speech", "Past simple contrast"],
    hints: { simple: "说明师傅说下午来，但没有给出几点。", intermediate: "转述承诺可用 said they'd come；but 引出缺少的具体信息。", complete: "The repair technician said they'd come this afternoon, but they didn't give me a _____ time." },
  },
  {
    id: "practice-202610-0010", prompt_zh: "我上个月已经付过这笔费用了，可以帮我核对一下记录吗？",
    reference_answer: "I already paid this fee last month. Could you check the records for me?",
    difficulty: "easy", context: "appointments-services", generated_by: "codex-review-draft",
    primary_target: "request-payment-record-check", learning_goal: "State that a fee was paid and ask staff to check the records.",
    learning_rationale: "The learner gives the relevant payment history before making a service request.", register: "neutral",
    grammar_point: ["Past simple with finished time", "Could you…? request"],
    hints: { simple: "说明上个月已经付款，再请对方查记录。", intermediate: "last month 是已结束时间，用过去时 paid；请求用 Could you…?。", complete: "I already _____ this fee last month. Could you _____ the records for me?" },
  },
  {
    id: "practice-202610-0013", prompt_zh: "前面发生了事故，这趟列车要在下一站换乘吗？",
    reference_answer: "There's been an accident ahead. Do we need to change trains at the next station?",
    difficulty: "standard", context: "commuting-transit", generated_by: "codex-review-draft",
    primary_target: "ask-about-disruption-transfer", learning_goal: "Ask whether a disruption requires changing trains at the next stop.",
    learning_rationale: "The learner links a service disruption with a practical transfer question.", register: "neutral",
    grammar_point: ["Present perfect for a recent event", "Need to + verb"],
    hints: { simple: "先说明前方发生事故，再问下一站是否需要换车。", intermediate: "There's been… 报告刚发生且与现在有关的情况；change trains 表示换乘。", complete: "There's been an accident ahead. Do we need to _____ trains at the next station?" },
  },
  {
    id: "practice-202610-0014", prompt_zh: "我坐过站了，下一站下车后怎么回到市中心？",
    reference_answer: "I've gone past my stop. How can I get back to the city centre from the next station?",
    difficulty: "challenge", context: "commuting-transit", generated_by: "codex-review-draft",
    primary_target: "ask-route-after-missed-stop", learning_goal: "Explain that you missed your stop and ask how to return to a destination.",
    learning_rationale: "The present perfect connects the travel mistake to the current need for directions.", register: "neutral",
    grammar_point: ["Present perfect", "How can I…? information request"],
    hints: { simple: "说明已经坐过站，再询问从下一站如何返回市中心。", intermediate: "用 go past my stop 表达坐过站；How can I get back to…? 询问路线。", complete: "I've _____ past my stop. How can I get back to the city centre from the next station?" },
  },
];

const content = question => ({
  id: practiceQuestionId(question.id), prompt_zh: question.prompt_zh, reference_answer: question.reference_answer,
  difficulty: question.difficulty, context: normalizePracticeContext(question.context),
  practice_fields_json: JSON.stringify({
    primary_target: [question.primary_target], learning_goal: [question.learning_goal],
    learning_rationale: [question.learning_rationale], register: [question.register],
    grammar_point: question.grammar_point,
  }),
  hint_json: JSON.stringify(question.hints), generated_by: question.generated_by,
  active: 0,
});

export function up(db) {
  return db.transaction(() => {
    const get = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const insert = db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json, hint_json, generated_by, served_count, active)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @context, @practice_fields_json, @hint_json, @generated_by, 0, 0)`);
    const getPrompt = db.prepare("SELECT id FROM practice_questions WHERE prompt_zh = ?");
    let inserted = 0;
    for (const question of QUESTIONS) {
      const row = content(question);
      const existing = get.get(row.id);
      if (existing) {
        if (["prompt_zh", "reference_answer", "difficulty", "context", "practice_fields_json", "hint_json", "generated_by", "active"]
          .every(key => existing[key] === row[key]) && existing.served_count === 0) continue;
        throw new Error(`Coverage draft content conflict: ${row.id}`);
      }
      const owner = getPrompt.get(row.prompt_zh);
      if (owner) throw new Error(`Coverage draft prompt collision: ${row.id}/${owner.id}`);
      insert.run(row);
      inserted++;
    }
    return { inserted, inactive: QUESTIONS.length };
  })();
}

export default { up };
