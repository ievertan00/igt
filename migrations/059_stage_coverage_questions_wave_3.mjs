import { practiceQuestionId } from "../lib/features/practice/question-ids.mjs";
import { normalizePracticeContext } from "../lib/features/practice/contexts.mjs";

const q = (id, zh, answer, difficulty, context, target, goal, rationale, register, grammar, simple, intermediate, complete) => ({
  id, prompt_zh: zh, reference_answer: answer, difficulty, context: normalizePracticeContext(context),
  practice_fields_json: JSON.stringify({ primary_target: [target], learning_goal: [goal], learning_rationale: [rationale], register: [register], grammar_point: grammar }),
  hint_json: JSON.stringify({ simple, intermediate, complete }), generated_by: "codex-review-draft", active: 0,
});

const QUESTIONS = [
  q("practice-202610-0033", "我下周要出差，能提前几天续配这支吸入剂吗？", "I'm travelling for work next week. Can I get a few days' extra supply of this inhaler in advance?", "standard", "health-pharmacy", "request-early-medication-refill", "Ask whether a medicine can be supplied early because of upcoming travel.", "The learner gives the timing and reason before asking for an early supply.", "neutral", ["Can for requests", "A few days' extra supply"], "说明下周要出差，再询问能否提前多配几天的吸入剂。", "用 Can I get…? 询问能否办理；in advance 表示提前。", "I'm travelling for work next week. Can I get a few days' extra _____ of this inhaler in advance?"),
  q("practice-202610-0034", "这个药要和食物一起吃，还是饭前服用？", "Should I take this medication with food or before a meal?", "easy", "health-pharmacy", "ask-medication-timing", "Ask whether a medicine should be taken with food or before a meal.", "The alternative question presents two clear timing options.", "neutral", ["Should for advice", "Alternative question"], "询问药物应随餐服还是饭前服。", "用 Should I take…? 询问服用建议；or 连接两个选择。", "Should I take this medication _____ food or before a meal?"),
  q("practice-202610-0035", "我们预订了七点的位子，可能会晚到十分钟。", "We have a reservation for seven, but we may be about ten minutes late.", "easy", "restaurants-cafes", "notify-restaurant-late-arrival", "Notify a restaurant that a party with a reservation may arrive late.", "The contrast preserves the reservation time and the possible delay.", "neutral", ["Present perfect for a current booking", "May for possibility"], "说明有七点预订，但可能晚到十分钟。", "have a reservation 描述当前预约；may 表示可能性。", "We have a reservation for seven, but we _____ be about ten minutes late."),
  q("practice-202610-0036", "可以把这份沙拉里的奶酪去掉吗？", "Could you leave the cheese out of this salad?", "easy", "restaurants-cafes", "request-ingredient-omission", "Ask restaurant staff to omit an ingredient from a dish.", "The learner makes a concise, polite customization request.", "neutral", ["Could you + base verb", "Leave something out of"], "礼貌请服务员不要在沙拉里放奶酪。", "用 Could you…? 提请求；leave something out of 表示省去某种材料。", "Could you _____ the cheese out of this salad?"),
  q("practice-202610-0029", "这场演出中场休息多长时间？", "How long is the intermission during this performance?", "easy", "cinema-entertainment", "ask-performance-intermission-length", "Ask how long an intermission lasts during a performance.", "A direct how-long question requests a duration for a specific event.", "neutral", ["How long + be question", "During + event"], "询问演出中场休息的时长。", "用 How long is…? 询问时长；intermission 指演出中场休息。", "How _____ is the intermission during this performance?"),
  q("practice-202610-0030", "我们买的是无障碍座位，入口离这里远吗？", "We booked accessible seats. Is the entrance far from here?", "standard", "cinema-entertainment", "ask-accessible-seat-entry-distance", "Ask how far the entrance is from accessible seating.", "The learner identifies the seating arrangement before asking for practical directions.", "neutral", ["Past simple", "How far question"], "说明订了无障碍座位，再询问入口是否离这里很远。", "booked 描述已完成的预订；Is…far from here? 询问距离。", "We _____ accessible seats. Is the entrance far from here?"),
  q("practice-202610-0031", "我刚看到你的消息，周末去徒步我很愿意参加。", "I just saw your message. I'd love to join you for the hike this weekend.", "easy", "friends-social", "accept-social-invitation", "Accept a friend's invitation warmly and refer to the planned activity.", "The learner acknowledges the message and clearly accepts the invitation.", "informal", ["Would love to + verb", "Join someone for an activity"], "说刚看到消息，并表示很愿意参加周末徒步。", "I'd love to… 是热情接受邀请的自然表达。", "I just saw your message. I'd love to _____ you for the hike this weekend."),
  q("practice-202610-0032", "我把你的书放在前台了，你有空时去拿就行。", "I left your book at the front desk. You can pick it up whenever you have time.", "standard", "friends-social", "tell-friend-where-item-was-left", "Tell a friend where an item was left and when they can collect it.", "The two clauses give a location and a flexible collection time.", "informal", ["Past simple", "Whenever clause", "Pick up"], "说明书放在前台，并告诉对方有空时去取。", "用 left + 物品 + 地点说明放置位置；whenever 表示任何方便的时候。", "I _____ your book at the front desk. You can pick it up whenever you have time."),
  q("practice-202610-0039", "这个电饭锅保修几年？", "How many years is this rice cooker under warranty?", "easy", "supermarkets-shopping", "ask-product-warranty-period", "Ask how long a product is covered by its warranty.", "The learner asks for a precise duration tied to a product purchase.", "neutral", ["How many + plural noun", "Under warranty"], "询问电饭锅的保修年限。", "用 How many years…? 询问年数；under warranty 表示在保修期内。", "How many years is this rice cooker under _____?"),
  q("practice-202610-0040", "我不需要购物袋，谢谢，我自己带了一个。", "I don't need a shopping bag, thanks. I brought my own.", "easy", "supermarkets-shopping", "decline-shopping-bag", "Politely decline a bag and explain that you brought one.", "The learner makes a simple checkout preference clear and gives a brief reason.", "neutral", ["Need for necessity", "Bring your own"], "礼貌表示不需要购物袋，并说明自己带了。", "用 don't need 表示不需要；brought my own 省略重复的 bag。", "I don't _____ a shopping bag, thanks. I brought my own."),
  q("practice-202610-0037", "这期电费比上个月高很多，能帮我看看读数吗？", "This electricity bill is much higher than last month's. Could you check the meter reading for me?", "standard", "appointments-services", "request-utility-bill-reading-check", "Report an unusually high utility bill and request a meter-reading check.", "The comparison gives a concrete reason for the service request.", "neutral", ["Comparative adjective", "Could you…? request"], "比较本月与上月电费，再请对方核对电表读数。", "higher than 引出比较对象；meter reading 指电表读数。", "This electricity bill is much _____ than last month's. Could you check the meter reading for me?"),
  q("practice-202610-0038", "门禁卡刷不出来了，今天能补办一张吗？", "My access card has stopped working. Can I get a replacement today?", "standard", "appointments-services", "request-access-card-replacement", "Report a failed access card and ask for a replacement today.", "The present perfect describes a current problem and the request states a desired timeframe.", "neutral", ["Present perfect for a changed state", "Can I get…? request"], "说明门禁卡现在不能用了，再问今天能否补办。", "has stopped working 表示已经停止工作且当前仍如此；replacement 指替换卡。", "My access card has stopped _____. Can I get a _____ today?"),
  q("practice-202610-0041", "公交车今天改走另一条路，去博物馆该在哪站下？", "The bus is taking a different route today. Which stop should I get off at for the museum?", "standard", "commuting-transit", "ask-stop-on-diverted-route", "Ask which stop to use when a bus is on a diverted route.", "The learner gives the service change before asking for the relevant stop.", "neutral", ["Present continuous for temporary change", "Should for advice"], "说明公交今天改道，再问去博物馆应在哪站下车。", "is taking a different route 表示临时线路变化；get off at 指在哪站下车。", "The bus is taking a different route today. Which stop should I _____ off at for the museum?"),
  q("practice-202610-0042", "这趟车不停中央车站吗？我需要在那里换乘。", "Does this service stop at Central Station? I need to change there.", "easy", "commuting-transit", "confirm-service-stop", "Confirm whether a service stops at an interchange station.", "The second sentence explains why the stop information matters.", "neutral", ["Does + subject + base verb", "Need to + verb"], "先确认列车是否停中央车站，再说明需要在那里换乘。", "一般现在时疑问句用 Does…stop…?；change there 表示在那里换乘。", "Does this service _____ at Central Station? I need to change there."),
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

