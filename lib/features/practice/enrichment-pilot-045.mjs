// Second small batch: ten easy social-plan items and ten standard restaurant items.
// All candidates are original drafts and remain inactive pending review.
const candidates = [
  {
    id: "pilot-045-social-001", prompt_zh: "我们六点在图书馆门口见吧。", reference_answer: "Let's meet outside the library at six.", difficulty: "easy", context: "friends-social",
    practice_fields_json: JSON.stringify({primary_target:["social-arrangement-time-place"],learning_goal:["Arrange a meeting with a clear place and time."],learning_rationale:["Simple plans are common in everyday messages and require both details to stay clear."],register:["informal"],mood:["suggestion"],grammar_point:["Let's for suggestions","Time and place phrases"]}),
    hint_json: JSON.stringify({simple:"提出见面的地点和时间。",intermediate:"用 Let's + 动词原形提出共同安排；地点和时间可放在句末。",complete:"Let's meet [地点] at [时间]."}), generated_by: "codex",
    sidecar: {essential:["meet outside the library","meet at six"],alternatives:["How about meeting at the library entrance at six?"],counterexamples:["Let's meet inside the library at six" /* changes the meeting place */,"Let's meet outside the library at seven" /* changes the time */],target_evidence:"Both the meeting point and time are retained in a natural suggestion.",template_family:"social-meetup-time-place",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-social-002", prompt_zh: "我今晚不能来，不过明天下午有空。", reference_answer: "I can't make it tonight, but I'm free tomorrow afternoon.", difficulty: "easy", context: "friends-social",
    practice_fields_json: JSON.stringify({primary_target:["availability-contrast"],learning_goal:["Decline one time and state a different available time."],learning_rationale:["Preserving both unavailable and available periods makes a rescheduling reply useful."],register:["informal"],sentence_structure:["compound"],conjunction_type:["coordinating"],grammar_point:["Contrast with but","Availability expressions"]}),
    hint_json: JSON.stringify({simple:"今晚不行，但明天下午可以。",intermediate:"用 but 对比不能参加的时间和有空的时间。",complete:"I can't [参加] [时间A], but I'm free [时间B]."}), generated_by: "codex",
    sidecar: {essential:["cannot attend tonight","available tomorrow afternoon"],alternatives:["Tonight doesn't work for me, but I can come tomorrow afternoon."],counterexamples:["I can make it tonight" /* reverses availability */,"I'm free tomorrow morning" /* changes the alternative time */],target_evidence:"The reply contrasts the declined time with the specific alternative availability.",template_family:"social-decline-alternative-window",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-social-003", prompt_zh: "聚会七点开始，我们可以早点到。", reference_answer: "The get-together starts at seven, and we can get there a little early.", difficulty: "easy", context: "friends-social",
    practice_fields_json: JSON.stringify({primary_target:["event-time-plus-plan"],learning_goal:["State an event's start time and a simple arrival plan."],learning_rationale:["The learner connects a stated schedule with a practical shared plan."],register:["neutral"],sentence_structure:["compound"],conjunction_type:["coordinating"],tense_aspect:["present simple for schedules","modal can"],grammar_point:["Present simple for schedules","Can for possibility"]}),
    hint_json: JSON.stringify({simple:"说明聚会开始时间，并说可以提前到。",intermediate:"固定安排常用一般现在时；can 表达可行的计划。",complete:"The [活动] starts at [时间], and we can get there [提前多久]."}), generated_by: "codex",
    sidecar: {essential:["get-together begins at seven","we can arrive a little early"],alternatives:["The party starts at seven, so we can arrive a bit early."],counterexamples:["The party starts at eight" /* changes the schedule */,"We should arrive late" /* reverses the arrival plan */],target_evidence:"Keeps the schedule and the proposed early arrival linked without adding a new obligation.",template_family:"social-event-time-arrival",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-social-004", prompt_zh: "周六和周日，你哪天比较方便？", reference_answer: "Which day works better for you, Saturday or Sunday?", difficulty: "easy", context: "friends-social",
    practice_fields_json: JSON.stringify({primary_target:["preference-between-options"],learning_goal:["Ask which of two days is more convenient for someone."],learning_rationale:["A clear choice question helps coordinate plans without presuming the other person's schedule."],register:["neutral"],clause_type:["choice question"],grammar_point:["Which choice questions","Work for someone"]}),
    hint_json: JSON.stringify({simple:"询问对方在两个日期中更方便哪一天。",intermediate:"用 Which day 开头；works for you 可表达对你方便。",complete:"Which [选项] works better for you, [选项A] or [选项B]?"}), generated_by: "codex",
    sidecar: {essential:["ask which day is more convenient","the options are Saturday and Sunday"],alternatives:["Are you more free on Saturday or Sunday?"],counterexamples:["Saturday works better for me" /* changes a question to a statement */,"Which day works better, Monday or Tuesday?" /* changes both options */],target_evidence:"A natural question leaves the choice to the other person and names both days.",template_family:"social-choice-of-day",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-social-005", prompt_zh: "抱歉我回得晚，刚才在开会。", reference_answer: "Sorry for the late reply; I was in a meeting.", difficulty: "easy", context: "friends-social",
    practice_fields_json: JSON.stringify({primary_target:["apology-with-brief-reason"],learning_goal:["Apologize for a delayed reply and give a brief reason."],learning_rationale:["Short apologies help maintain a friendly tone while explaining a communication delay."],register:["informal"],sentence_structure:["compound"],grammar_point:["Sorry for + noun phrase","Past progressive for background"]}),
    hint_json: JSON.stringify({simple:"为回复晚道歉，并说明刚才在做什么。",intermediate:"可用 Sorry for + 名词短语；过去进行时描述当时正在做的事。",complete:"Sorry for [延迟], I was [当时正在做的事]."}), generated_by: "codex",
    sidecar: {essential:["apology for replying late","was in a meeting just before replying"],alternatives:["Sorry I took a while to get back to you; I was in a meeting."],counterexamples:["Sorry I missed the meeting" /* changes what happened */,"I was in a meeting tomorrow" /* changes the time relation */],target_evidence:"A brief apology and a plausible past reason are both expressed.",template_family:"social-late-reply-apology",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-social-006", prompt_zh: "我可以带些水果过去。", reference_answer: "I can bring some fruit over.", difficulty: "easy", context: "friends-social",
    practice_fields_json: JSON.stringify({primary_target:["offer-to-bring-item"],learning_goal:["Offer to bring a simple item to a social gathering."],learning_rationale:["A short practical offer is common in informal planning and sharing responsibilities."],register:["informal"],mood:["offer"],grammar_point:["Can for offers","Bring something over"]}),
    hint_json: JSON.stringify({simple:"主动提出带一样东西过去。",intermediate:"can 可用于提出帮助；bring ... over 表示把东西带到对方那里。",complete:"I can bring some [物品] [过去]."}), generated_by: "codex",
    sidecar: {essential:["speaker offers to bring fruit","bring it to the gathering or host's place"],alternatives:["I could bring some fruit with me."],counterexamples:["Could you bring me some fruit?" /* changes an offer to a request */,"I can bring some flowers" /* changes the offered item */],target_evidence:"The speaker volunteers to bring fruit; the offer is not phrased as a request.",template_family:"social-offer-to-bring",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-social-007", prompt_zh: "聚会结束后，我可以帮忙收拾。", reference_answer: "I can help tidy up after the get-together.", difficulty: "easy", context: "friends-social",
    practice_fields_json: JSON.stringify({primary_target:["offer-help-after-event"],learning_goal:["Offer to help with a simple task after a social event."],learning_rationale:["A short offer to share cleanup is a common friendly contribution."],register:["informal"],mood:["offer"],non_finite:["bare infinitive after help"],grammar_point:["Can for offers","Help + bare infinitive","After + time expression"]}),
    hint_json: JSON.stringify({simple:"提出聚会后帮忙收拾。",intermediate:"can 可用于主动提出帮助；help 后可接动词原形。",complete:"I can help [动作] after the [活动]."}), generated_by: "codex",
    sidecar: {essential:["offers to help with tidying up","the offer is for after the get-together"],alternatives:["I can help with the cleanup after the party."],counterexamples:["I can help set up before the party" /* changes the task and timing */,"Could you help me tidy up?" /* changes an offer to a request */],target_evidence:"The speaker volunteers to help with cleanup after the social event.",template_family:"social-offer-after-event",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending.",revision_history:[{date:"2026-10-05",reason:"Replace a near-duplicate of an existing arrival-message prompt with a distinct social offer."}]}
  },
  {
    id: "pilot-045-social-008", prompt_zh: "这是我的朋友 Maya，她也住在附近。", reference_answer: "This is my friend Maya; she lives nearby too.", difficulty: "easy", context: "friends-social",
    practice_fields_json: JSON.stringify({primary_target:["introduce-friend-with-detail"],learning_goal:["Introduce a friend and add one simple relevant detail."],learning_rationale:["A short introduction can establish a social connection and help continue a conversation."],register:["neutral"],sentence_structure:["compound"],grammar_point:["Demonstrative introductions","Pronoun reference"]}),
    hint_json: JSON.stringify({simple:"介绍朋友，并补充她住得不远。",intermediate:"用 This is ... 介绍人；第二句用 she 指代这位朋友。",complete:"This is my friend [姓名]; [代词] lives [地点] too."}), generated_by: "codex",
    sidecar: {essential:["introduces friend Maya","Maya also lives nearby"],alternatives:["I'd like you to meet my friend Maya. She lives close by too."],counterexamples:["This is my neighbor Maya" /* changes the relationship */,"She lives far away" /* reverses the location detail */],target_evidence:"The introduction identifies Maya as a friend and retains the nearby residence detail.",template_family:"social-friend-introduction",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-social-009", prompt_zh: "谢谢你今天陪我。", reference_answer: "Thanks for keeping me company today.", difficulty: "easy", context: "friends-social",
    practice_fields_json: JSON.stringify({primary_target:["thank-for-company"],learning_goal:["Thank someone for spending time with the speaker."],learning_rationale:["Expressing appreciation is a frequent short interaction in friendships."],register:["informal"],non_finite:["gerund after preposition"],grammar_point:["Thanks for + gerund","Keep someone company"]}),
    hint_json: JSON.stringify({simple:"感谢对方今天陪着你。",intermediate:"thanks for 后接名词或动名词；keep someone company 表示陪伴。",complete:"Thanks for [动名词短语] me [时间]."}), generated_by: "codex",
    sidecar: {essential:["thank the other person","they kept the speaker company today"],alternatives:["Thank you for spending the day with me."],counterexamples:["Thanks for waiting for me today" /* narrows the activity to waiting */,"Thanks for keeping me company yesterday" /* changes the day */],target_evidence:"The thanks refer to companionship today, without specifying an unsupported activity.",template_family:"social-gratitude-for-company",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-social-010", prompt_zh: "要不要也带一位朋友来？", reference_answer: "Would you like to bring a friend along too?", difficulty: "easy", context: "friends-social",
    practice_fields_json: JSON.stringify({primary_target:["invite-additional-guest"],learning_goal:["Ask whether someone wants to bring an additional friend."],learning_rationale:["Clarifying who may join helps a host plan a social gathering politely."],register:["informal"],mood:["invitation"],grammar_point:["Would you like to...?","Bring someone along"]}),
    hint_json: JSON.stringify({simple:"询问对方是否想再带一位朋友来。",intermediate:"Would you like to...? 委婉询问意愿；bring ... along 表示带人同行。",complete:"Would you like to bring [人] along [也/一起]?"}), generated_by: "codex",
    sidecar: {essential:["asks whether the other person wants to bring a friend","the friend would also attend"],alternatives:["Do you want to bring a friend with you as well?"],counterexamples:["Would you like to bring a friend next week?" /* adds an unsupported date */,"Would you like to come alone?" /* reverses the invitation */],target_evidence:"A polite yes-no invitation asks about adding one friend to the gathering.",template_family:"social-additional-guest-invitation",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-restaurants-001", prompt_zh: "我对花生过敏，这道汤里含有花生吗？", reference_answer: "I'm allergic to peanuts. Does this soup contain any?", difficulty: "standard", context: "restaurants-cafes",
    practice_fields_json: JSON.stringify({primary_target:["ingredient-presence-question"],learning_goal:["State an ingredient restriction and ask whether a dish contains it."],learning_rationale:["Clear ingredient questions help a diner communicate a dietary constraint and verify a specific dish."],register:["neutral"],clause_type:["yes-no question"],grammar_point:["Allergic to","Contain for ingredients"]}),
    hint_json: JSON.stringify({simple:"说明花生过敏，并询问汤里有没有花生。",intermediate:"用 be allergic to 表达过敏；用 Does ... contain...? 提问。",complete:"I'm allergic to [食材]. Does this [菜品] contain any?"}), generated_by: "codex",
    sidecar: {essential:["speaker is allergic to peanuts","asks whether the soup contains peanuts"],alternatives:["I have a peanut allergy. Is there any peanut in this soup?"],counterexamples:["I'm allergic to shellfish" /* changes the ingredient */,"Does this soup contain dairy?" /* changes the question target */],target_evidence:"The learner reports a restriction and asks about the named dish; no claim is made that the dish is safe.",template_family:"restaurant-allergen-check",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-restaurants-002", prompt_zh: "可以把酱汁另外放吗？我不太喜欢太辣。", reference_answer: "Could I have the sauce on the side? I don't like it too spicy.", difficulty: "standard", context: "restaurants-cafes",
    practice_fields_json: JSON.stringify({primary_target:["polite-food-modification-request"],learning_goal:["Request a serving adjustment and briefly explain a preference."],learning_rationale:["Diners often need to ask for a simple modification while making the preference clear."],register:["neutral"],mood:["polite request"],grammar_point:["Could I have...?","On the side","Too + adjective"]}),
    hint_json: JSON.stringify({simple:"请求酱汁分开放，并说明不喜欢太辣。",intermediate:"Could I have...? 可委婉请求；on the side 表示另放。",complete:"Could I have the [配料] on the side? I don't like it too [味道]."}), generated_by: "codex",
    sidecar: {essential:["requests sauce served separately","does not like it very spicy"],alternatives:["Could you bring the sauce separately? I prefer it less spicy."],counterexamples:["Please make it extra spicy" /* reverses the preference */,"Could I have no sauce?" /* changes separate serving to omission */],target_evidence:"The request asks for separate serving and preserves the mildness preference.",template_family:"restaurant-modification-with-preference",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-restaurants-003", prompt_zh: "我们十分钟前点的饮料还没上，可以帮忙看一下吗？", reference_answer: "The drinks we ordered ten minutes ago haven't arrived yet. Could you check on them?", difficulty: "standard", context: "restaurants-cafes",
    practice_fields_json: JSON.stringify({primary_target:["polite-order-follow-up"],learning_goal:["Report a delayed order and politely ask staff to check on it."],learning_rationale:["The learner needs to identify the order and make a tactful follow-up request."],register:["neutral"],sentence_structure:["complex"],clause_type:["defining relative"],tense_aspect:["present perfect negative"],grammar_point:["Relative clause for order identification","Yet with present perfect"]}),
    hint_json: JSON.stringify({simple:"饮料等了十分钟还没到，请店员查一下。",intermediate:"用 we ordered... 指明是哪份订单；haven't ... yet 描述到现在仍未发生。",complete:"The [物品] we ordered [多久] ago haven't [动作] yet. Could you [查询请求]?"}), generated_by: "codex",
    sidecar: {essential:["drinks were ordered ten minutes ago","they have not arrived yet","asks staff to check"],alternatives:["We ordered our drinks ten minutes ago, but they still haven't come. Could you find out what's happening?"],counterexamples:["The drinks arrived ten minutes ago" /* reverses order status */,"Could you bring the food we ordered?" /* changes the item */],target_evidence:"The time since ordering, current non-arrival, and polite follow-up are all retained.",template_family:"restaurant-delayed-order-follow-up",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-restaurants-004", prompt_zh: "账单上好像多算了一份甜点，我们只点了一份。", reference_answer: "I think we've been charged for an extra dessert; we only ordered one.", difficulty: "standard", context: "restaurants-cafes",
    practice_fields_json: JSON.stringify({primary_target:["bill-discrepancy-with-evidence"],learning_goal:["Raise a possible billing error and give the order detail that supports it."],learning_rationale:["A calm explanation makes a service problem specific and easier to resolve."],register:["neutral"],sentence_structure:["compound"],conjunction_type:["coordinating"],grammar_point:["I think for tentative claims","Present perfect passive","Only for limiting quantity"]}),
    hint_json: JSON.stringify({simple:"指出账单可能多算，并说明实际只点了一份。",intermediate:"I think 可缓和判断；用 only 突出实际点单数量。",complete:"I think we've been charged for [多算项目]; we only ordered [数量]."}), generated_by: "codex",
    sidecar: {essential:["suspects an extra dessert charge","only one dessert was ordered"],alternatives:["There seems to be a second dessert on the bill, but we only ordered one."],counterexamples:["We ordered two desserts" /* removes the discrepancy */,"We were charged for an extra drink" /* changes the item */],target_evidence:"The statement is tentative and supplies the one-dessert order as the reason for checking.",template_family:"restaurant-bill-quantity-discrepancy",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-restaurants-005", prompt_zh: "套餐里的薯条可以换成沙拉吗？", reference_answer: "Could I swap the fries in the set meal for a salad?", difficulty: "standard", context: "restaurants-cafes",
    practice_fields_json: JSON.stringify({primary_target:["request-item-substitution"],learning_goal:["Ask whether one included side can be replaced with another."],learning_rationale:["A precise substitution request is useful when adapting a meal order."],register:["neutral"],mood:["polite request"],grammar_point:["Could I...?","Swap A for B"]}),
    hint_json: JSON.stringify({simple:"询问套餐配菜能否替换。",intermediate:"Could I...? 提出委婉请求；swap A for B 表示用 B 替换 A。",complete:"Could I swap the [原配菜] in the [套餐] for a [替代配菜]?"}), generated_by: "codex",
    sidecar: {essential:["asks to replace the fries included in a set meal","wants a salad instead"],alternatives:["Would it be possible to have a salad instead of the fries with the set meal?"],counterexamples:["Could I add a salad to the fries?" /* asks to add rather than replace */,"Could I swap the salad for fries?" /* reverses the items */],target_evidence:"The requested change is a substitution, not an extra side, and the direction is preserved.",template_family:"restaurant-side-substitution",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-restaurants-006", prompt_zh: "我点的是无咖啡因咖啡，但这杯喝起来更浓。", reference_answer: "I ordered decaf, but this coffee tastes much stronger.", difficulty: "standard", context: "restaurants-cafes",
    practice_fields_json: JSON.stringify({primary_target:["order-detail-contrast"],learning_goal:["Contrast what was ordered with a sensory observation about what was served."],learning_rationale:["Contrasting the order and the result helps a diner flag a possible mismatch clearly."],register:["neutral"],sentence_structure:["compound"],conjunction_type:["coordinating"],grammar_point:["Contrast with but","Taste + adjective"]}),
    hint_json: JSON.stringify({simple:"说明点了什么，再描述这杯咖啡的味道。",intermediate:"用 but 对比原订单和现在的感受；taste 后接形容词。",complete:"I ordered [类型], but this [饮品] tastes [感受]."}), generated_by: "codex",
    sidecar: {essential:["ordered decaffeinated coffee","served coffee tastes stronger than expected"],alternatives:["I asked for a decaf, but this tastes a lot stronger."],counterexamples:["I ordered regular coffee" /* changes the order */,"This coffee tastes weaker" /* reverses the observation */],target_evidence:"The order and observed taste are contrasted without asserting why they differ.",template_family:"restaurant-order-result-mismatch",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-restaurants-007", prompt_zh: "我们四个人想分开付账，可以把账单拆开吗？", reference_answer: "There are four of us, and we'd like to pay separately. Could you split the bill?", difficulty: "standard", context: "restaurants-cafes",
    practice_fields_json: JSON.stringify({primary_target:["request-split-bill"],learning_goal:["Explain the group size and ask to pay separately."],learning_rationale:["A clear split-bill request communicates both the party and payment arrangement."],register:["neutral"],mood:["polite request"],grammar_point:["Would like to","Pay separately","Split the bill"]}),
    hint_json: JSON.stringify({simple:"说明有四个人，并请求分开结账。",intermediate:"would like to 表达意愿；Could you...? 礼貌提出拆账请求。",complete:"There are [人数] of us, and we'd like to [付款方式]. Could you [请求]?"}), generated_by: "codex",
    sidecar: {essential:["party has four people","wants separate payment","asks staff to split the bill"],alternatives:["Could we have four separate checks, please?"],counterexamples:["There are four of us, so we'll pay together" /* reverses the payment arrangement */,"Could you split the dessert?" /* changes the object */],target_evidence:"The group size is stated and the requested payment arrangement is separate bills.",template_family:"restaurant-split-payment",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-restaurants-008", prompt_zh: "我们八点要赶火车，可以先点餐吗？", reference_answer: "We have to catch a train at eight. Could we order now?", difficulty: "standard", context: "restaurants-cafes",
    practice_fields_json: JSON.stringify({primary_target:["time-constraint-request"],learning_goal:["Give a time constraint and make a related service request."],learning_rationale:["Briefly linking a deadline to a request helps staff understand the reason for urgency."],register:["neutral"],sentence_structure:["compound"],grammar_point:["Have to for obligation","Could we for requests"]}),
    hint_json: JSON.stringify({simple:"说明八点要赶火车，因此想现在点餐。",intermediate:"have to 表达必须赶上的安排；Could we...? 提出相关请求。",complete:"We have to [赶上交通] at [时间]. Could we [现在要做的事]?"}), generated_by: "codex",
    sidecar: {essential:["must catch a train at eight","asks to place the order now"],alternatives:["Our train leaves at eight, so could we order straight away?"],counterexamples:["We have to catch a train at nine" /* changes the deadline */,"Could we pay now?" /* changes the request */],target_evidence:"The request is to order now, and the stated train time explains the urgency.",template_family:"restaurant-order-before-deadline",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-restaurants-009", prompt_zh: "可以给我们换个干净的杯子吗？这个杯子上有污渍。", reference_answer: "Could we have a clean glass, please? This one has a mark on it.", difficulty: "standard", context: "restaurants-cafes",
    practice_fields_json: JSON.stringify({primary_target:["polite-replacement-with-reason"],learning_goal:["Request a replacement item and explain the visible problem."],learning_rationale:["Naming the requested replacement and its reason makes a service request actionable."],register:["neutral"],mood:["polite request"],grammar_point:["Could we have...?","Demonstrative reference"]}),
    hint_json: JSON.stringify({simple:"请求换一个干净杯子，并指出当前杯子的问题。",intermediate:"Could we have...? 委婉索要物品；this one 指眼前的杯子。",complete:"Could we have a clean [物品]? This one has [问题]."}), generated_by: "codex",
    sidecar: {essential:["asks for a clean replacement glass","current glass has a mark"],alternatives:["Would it be possible to get another glass? There's a stain on this one."],counterexamples:["Could we have another plate?" /* changes the item */,"This glass is clean" /* reverses the reason */],target_evidence:"The replacement request refers to a glass, and the reason is the mark on the current one.",template_family:"restaurant-replacement-for-visible-defect",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending."}
  },
  {
    id: "pilot-045-restaurants-010", prompt_zh: "菜单上说午餐套餐包含配菜，可以告诉我有哪些选择吗？", reference_answer: "The menu says the lunch special comes with a side. Could you tell me which side dishes I can choose from?", difficulty: "standard", context: "restaurants-cafes",
    practice_fields_json: JSON.stringify({primary_target:["embedded-wh-question-for-options"],learning_goal:["Ask for the available choices using an embedded question."],learning_rationale:["Indirect questions let a diner request menu information politely and naturally."],register:["neutral"],sentence_structure:["complex"],clause_type:["embedded wh-question"],grammar_point:["Embedded question word order","Tell me what..."]}),
    hint_json: JSON.stringify({simple:"说明菜单包含配菜，并礼貌询问可选项目。",intermediate:"Could you tell me... 后接疑问词引导的陈述语序从句。",complete:"The menu says [套餐内容]. Could you tell me what [主语] + [动词] are?"}), generated_by: "codex",
    sidecar: {essential:["lunch special includes a side according to menu","asks which side dishes can be chosen"],alternatives:["It says the lunch deal includes a side dish. Which options can I choose from?"],counterexamples:["Could you tell me where the restaurant is?" /* changes the information requested */,"The lunch special includes a dessert" /* changes the menu item */],target_evidence:"The embedded question asks which side options are available without using direct-question inversion inside the clause.",template_family:"restaurant-menu-choice-inquiry",source:"Original scenario drafted for this batch; no external text used; human provenance and rights review pending.",revision_history:[{date:"2026-10-05",reason:"Make the embedded question specify that the choices concern the side dishes."}]}
  }
];

const rationale = {
  "pilot-045-social-001": "Easy: one short suggestion combines a familiar place and time.",
  "pilot-045-social-002": "Easy: familiar availability phrases are linked by a simple contrast.",
  "pilot-045-social-003": "Easy: a schedule and a simple shared arrival plan use familiar forms.",
  "pilot-045-social-004": "Easy: a short choice question names two familiar day options.",
  "pilot-045-social-005": "Easy: a brief apology and a familiar past reason form a natural message.",
  "pilot-045-social-006": "Easy: a concise offer uses can and a concrete familiar item.",
  "pilot-045-social-007": "Easy: a simple request is linked to a clear when clause.",
  "pilot-045-social-008": "Easy: two short clauses introduce a person and add a familiar location detail.",
  "pilot-045-social-009": "Easy: a common thanks-for pattern expresses one clear social function.",
  "pilot-045-social-010": "Easy: a short availability statement uses a familiar time phrase.",
  "pilot-045-restaurants-001": "Standard: the learner states an ingredient restriction and asks a yes-no question about a dish.",
  "pilot-045-restaurants-002": "Standard: a polite serving request is paired with a taste preference.",
  "pilot-045-restaurants-003": "Standard: the learner identifies a delayed order, preserves elapsed time, and makes a polite follow-up request.",
  "pilot-045-restaurants-004": "Standard: a tentative billing concern is supported by the actual quantity ordered.",
  "pilot-045-restaurants-005": "Standard: the learner asks for a substitution and must preserve its direction.",
  "pilot-045-restaurants-006": "Standard: the learner contrasts the ordered coffee with an observed difference.",
  "pilot-045-restaurants-007": "Standard: the learner states party size, payment preference, and a staff request.",
  "pilot-045-restaurants-008": "Standard: a deadline is connected to a polite request to order immediately.",
  "pilot-045-restaurants-009": "Standard: a polite replacement request is supported by a visible defect.",
  "pilot-045-restaurants-010": "Standard: the learner reports menu information and forms an indirect wh-question about available options.",
};

export const ENRICHMENT_PILOT_045 = candidates.map(candidate => ({
  ...candidate,
  active: 0,
  sidecar: {
    ...candidate.sidecar,
    provisional_difficulty: candidate.difficulty,
    difficulty_rationale: `${rationale[candidate.id]} Provisional: compare with the approved first pilot; no learner-response data available.`,
    review_status: "machine-reviewed; human review pending",
    human_review_status: "pending",
    actual_reviewers: [{ name: "Codex", role: "machine" }],
    rights_status: "Pending: original scenario drafted for this batch; human provenance and rights review required.",
    revision_history: [],
  },
}));

export const ENRICHMENT_PILOT_045_APPROVED = ENRICHMENT_PILOT_045.map(candidate => ({
  ...candidate,
  active: 1,
  sidecar: {
    ...candidate.sidecar,
    source: candidate.sidecar.source.replace("human provenance and rights review pending.", "human provenance and rights review approved by user on 2026-10-05."),
    review_status: "human-approved; user approval recorded 2026-10-05",
    human_review_status: "approved",
    actual_reviewers: [
      ...candidate.sidecar.actual_reviewers,
      { name: "User (current conversation)", role: "human", approved_at: "2026-10-05" },
    ],
    rights_status: "Verified: original scenarios authored for this batch; user approved provenance review on 2026-10-05; no external source text used.",
  },
}));
