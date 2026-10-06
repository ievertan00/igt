import { practiceQuestionId } from "../lib/features/practice/question-ids.mjs";

const make = (id, prompt_zh, reference_answer, difficulty, context, target, goal, rationale, register, grammar, simple, intermediate, complete) => ({
  id, prompt_zh, reference_answer, difficulty, context, generated_by: "codex-review-draft",
  practice_fields_json: JSON.stringify({
    primary_target: [target], learning_goal: [goal], learning_rationale: [rationale],
    register: [register], grammar_point: grammar,
  }),
  hint_json: JSON.stringify({ simple, intermediate, complete }), active: 0,
});

const QUESTIONS = [
  make("practice-202610-0019", "我需要空腹验血吗？预约单上没有写。", "Do I need to fast before the blood test? It isn't mentioned on the appointment slip.", "standard", "health-pharmacy", "ask-about-test-preparation", "Ask whether fasting is required before a test.", "The learner asks about a specific preparation requirement and explains the missing information.", "neutral", ["Need to for requirements", "Passive voice"], "询问验血前是否需要空腹，并说明预约单没写。", "用 Do I need to…? 询问要求；fast before a test 表示检查前禁食。", "Do I need to _____ before the blood test? It isn't mentioned on the appointment slip."),
  make("practice-202610-0020", "我昨天开始吃新药，今天有点头晕，这是常见反应吗？", "I started taking the new medication yesterday, and I feel a little dizzy today. Is that a common side effect?", "challenge", "health-pharmacy", "ask-about-medication-side-effect", "Describe when a symptom began and ask whether it may be a side effect.", "A clear time sequence helps a pharmacist understand a possible medication reaction.", "neutral", ["Past simple and present simple", "Side-effect questions"], "说明昨天开始服新药、今天头晕，再询问是否常见。", "用 started…yesterday 标出开始时间；Is that a common side effect? 询问可能原因。", "I _____ taking the new medication yesterday, and I feel a little dizzy today. Is that a common _____?"),
  make("practice-202610-0021", "能把辣酱单独放一边吗？有人不吃辣。", "Could you put the chilli sauce on the side? Someone in our group doesn't eat spicy food.", "easy", "restaurants-cafes", "request-condiment-on-side", "Request a condiment separately and give a dietary reason.", "The learner makes a practical serving request and explains the group's preference.", "neutral", ["Could you + base verb", "On the side"], "请服务员把辣酱分开放，并说明有人不吃辣。", "用 Could you put…? 礼貌请求；on the side 表示另放一边。", "Could you put the chilli sauce _____ the side? Someone in our group doesn't eat spicy food."),
  make("practice-202610-0022", "我们可以先排队等位吗？窗边的桌子还没空出来。", "Could we wait in line for a table? The one by the window isn't free yet.", "standard", "restaurants-cafes", "ask-to-join-table-queue", "Ask to wait for a table and explain which one is unavailable.", "The request links the wait-list action to a specific table preference.", "neutral", ["Could we…? request", "Yet with present simple"], "询问能否排队等位，并说明窗边桌还没空。", "wait in line for a table 表示排队等桌；isn't free yet 表示目前还没有空出。", "Could we _____ in line for a table? The one by the window isn't _____ yet."),
  make("practice-202610-0015", "我们的座位旁边有人放了行李，可以请工作人员处理一下吗？", "Someone has left luggage next to our seats. Could you ask a staff member to move it?", "standard", "cinema-entertainment", "request-help-with-blocked-seats", "Report an obstruction beside assigned seats and ask staff for help.", "The learner describes a current problem and makes a polite request through staff.", "neutral", ["Present perfect for a current result", "Ask + object + to-infinitive"], "说明座位旁被行李占了，再请对方找工作人员处理。", "has left 表示留下的行李现在还在；ask someone to move it 说明请求内容。", "Someone has _____ luggage next to our seats. Could you ask a staff member to _____ it?"),
  make("practice-202610-0016", "演出开始后还能进场吗？我朋友可能会迟到十分钟。", "Can my friend still come in after the show starts? They may be ten minutes late.", "easy", "cinema-entertainment", "ask-about-late-entry", "Ask whether late entry is allowed and explain the likely delay.", "The question gives staff the timing context needed to answer an entry-policy request.", "neutral", ["Can for permission", "May for possibility"], "询问演出开始后是否还能入场，并说明朋友可能晚十分钟。", "用 Can…still come in? 询问是否允许；may 表示可能。", "Can my friend still _____ in after the show starts? They may be ten minutes late."),
  make("practice-202610-0017", "我们能把周五的晚餐改到下周吗？我临时要加班。", "Could we move Friday's dinner to next week? I have to work late unexpectedly.", "standard", "friends-social", "reschedule-social-plan", "Ask to reschedule a social plan and give the reason.", "The learner preserves the original plan while clearly proposing a new time.", "informal", ["Could we…? suggestion", "Have to for obligation"], "提出把周五晚餐改到下周，并说明临时要加班。", "move a plan to + 时间表示改期；have to work late 表示不得不加班。", "Could we _____ Friday's dinner to next week? I have to work late _____."),
  make("practice-202610-0018", "听说你拿到新工作了，太替你高兴了！", "I heard you got the new job. I'm so happy for you!", "easy", "friends-social", "congratulate-friend-on-news", "Respond warmly to a friend's good news.", "The short response combines the news with a natural expression of shared happiness.", "informal", ["Past simple in reported news", "Happy for someone"], "转述听到的好消息，再表达替朋友开心。", "I heard… 引出听说的消息；happy for you 表示替你高兴。", "I heard you _____ the new job. I'm so _____ for you!"),
  make("practice-202610-0025", "这件商品没有小票还能退吗？我用手机付款的。", "Can I return this item without a receipt? I paid for it with my phone.", "standard", "supermarkets-shopping", "ask-about-return-without-receipt", "Ask about a return and explain how the purchase was made.", "The reason may help staff locate the transaction when a receipt is unavailable.", "neutral", ["Can for possibility/policy", "Past simple"], "询问没有小票能否退货，并说明用手机付款。", "without a receipt 表示没有小票；paid for it 说明付款方式。", "Can I _____ this item without a receipt? I _____ for it with my phone."),
  make("practice-202610-0026", "这款没有我需要的尺码，有同款更大一码的吗？", "This style isn't available in my size. Do you have the same one a size larger?", "easy", "supermarkets-shopping", "ask-for-larger-size", "Explain that a size is unavailable and ask for the next size up.", "The learner states the problem and identifies the desired alternative precisely.", "neutral", ["Available in + size", "Comparative size phrase"], "说明没有合适尺码，再询问是否有大一码的同款。", "a size larger 表示大一码；same one 指同款商品。", "This style isn't available in my size. Do you have the same one a size _____?"),
  make("practice-202610-0023", "网络维修预约在周二上午，可以改到下午吗？", "The internet repair appointment is for Tuesday morning. Could I move it to the afternoon?", "easy", "appointments-services", "reschedule-service-appointment", "Ask to move a booked service appointment to a different time.", "The learner refers to the current booking before proposing a specific alternative.", "neutral", ["Be scheduled for", "Could I…? request"], "说明当前预约时间，并询问能否改到下午。", "is for Tuesday morning 说明预约时段；move it to the afternoon 表示改时间。", "The internet repair appointment is for Tuesday morning. Could I _____ it to the afternoon?"),
  make("practice-202610-0024", "包裹上写的是旧地址，能在寄出前帮我改一下吗？", "The parcel has the wrong address on it. Could you update it before it's sent out?", "challenge", "appointments-services", "correct-parcel-address", "Report an address error and request a correction before dispatch.", "The time clause makes clear that the change is needed before the parcel leaves.", "neutral", ["Present perfect result", "Passive voice"], "说明包裹地址有误，并请对方在寄出前更正。", "has the wrong address 描述当前错误；before it's sent out 用被动表达寄出前。", "The parcel has the wrong address on it. Could you update it before it's _____ out?"),
  make("practice-202610-0027", "这张日票可以坐机场快线吗？", "Is this day pass valid on the airport express?", "easy", "commuting-transit", "ask-about-transit-pass-validity", "Check whether a travel pass covers a specific service.", "The learner asks about the validity of a pass on a named route.", "neutral", ["Be valid on", "Yes/no question"], "询问日票是否适用于机场快线。", "用 Is this pass valid on…? 询问票种适用范围。", "Is this day pass _____ on the airport express?"),
  make("practice-202610-0028", "电梯今天停用了，带行李的话从哪个出口走比较方便？", "The lift is out of service today. Which exit is more convenient if I'm carrying luggage?", "challenge", "commuting-transit", "ask-accessible-route-during-disruption", "Ask for a convenient exit route when station facilities are unavailable.", "The conditional detail helps staff tailor directions to the traveler's situation.", "neutral", ["Be out of service", "Comparative adjective", "If clause"], "说明电梯停用，再询问带行李时哪个出口更方便。", "out of service 表示暂停使用；if I'm carrying luggage 补充路线选择条件。", "The lift is out of service today. Which exit is more _____ if I'm carrying luggage?"),
];

export function up(db) {
  return db.transaction(() => {
    const get = db.prepare("SELECT * FROM practice_questions WHERE id = ?");
    const prompt = db.prepare("SELECT id FROM practice_questions WHERE prompt_zh = ?");
    const insert = db.prepare(`INSERT INTO practice_questions
      (id, prompt_zh, reference_answer, difficulty, context, practice_fields_json, hint_json, generated_by, served_count, active)
      VALUES (@id, @prompt_zh, @reference_answer, @difficulty, @context, @practice_fields_json, @hint_json, @generated_by, 0, 0)`);
    let inserted = 0;
    for (const row of QUESTIONS) {
      row.id = practiceQuestionId(row.id);
      const existing = get.get(row.id);
      if (existing) {
        if (["prompt_zh", "reference_answer", "difficulty", "context", "practice_fields_json", "hint_json", "generated_by", "active"]
          .every(key => existing[key] === row[key]) && existing.served_count === 0) continue;
        throw new Error(`Coverage draft content conflict: ${row.id}`);
      }
      const duplicate = prompt.get(row.prompt_zh);
      if (duplicate) throw new Error(`Coverage draft prompt collision: ${row.id}/${duplicate.id}`);
      insert.run(row);
      inserted++;
    }
    return { inserted, inactive: QUESTIONS.length };
  })();
}

export default { up };

