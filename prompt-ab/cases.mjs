// Each row pairs a learner input with a reviewer-only criterion.
const grammarGroups = {
  correct: [
    ["I lived here for three years before I moved to Beijing.", "过去的两个事件顺序明确；无需改时态。"],
    ["Neither answer is wrong.", "双重否定表达两者均可；保留。"],
    ["I wish I were there.", "假设语气成立。"],
    ["The train leaves at six tomorrow.", "时刻表可用一般现在时。"],
    ["I've already eaten, thanks.", "自然的简短回复。"],
    ["Could you send me the draft when you have a moment?", "保留礼貌程度。"],
    ["My glasses are on the desk.", "眼镜作复数。"],
    ["We had our car repaired.", "使役结构成立。"],
    ["She suggested that he leave early.", "虚拟式 leave 合法。"],
    ["There's little water left.", "little 与不可数名词搭配。"]],
  single: [
    ["I have lived here since three years.", "since → for；保留持续时间。"],
    ["He drive to work every day.", "第三人称 drives。"],
    ["She gave me an advice.", "advice 不可数。"],
    ["We discussed about the budget.", "discuss 直接接宾语。"],
    ["I look forward to see you.", "to 为介词，后接 seeing。"],
    ["One of my friend called.", "one of 后用 friends。"],
    ["He is good in solving puzzles.", "惯用 good at。"],
    ["Did you went home?", "did 后用 go。"],
    ["She bought a umbrella.", "元音音素前用 an。"],
    ["I enjoy to swim.", "enjoy 后接 swimming。"]],
  multiple: [
    ["My sister work here. She take the bus.", "修正两处单数谓语。"],
    ["Yesterday we go outside and see a fox.", "两个动作均需过去式。"],
    ["These box is empty.", "保留复数指示并统一名词和谓语；同样接受语境合理的单数方案。"],
    ["I didn't knew he live nearby.", "did 后用 know；修复从句谓语。"],
    ["We was tired. The beds was soft.", "两处改为 were。"],
    ["There are much cars, so traffic are slow.", "many cars；traffic is。"],
    ["He can sings and she can dances.", "情态动词后两处用原形。"],
    ["I have two childs. Both likes music.", "children；both like。"],
    ["The keys is on the shelf. Please takes them.", "keys are；祈使句 take。"],
    ["She has wrote the note but hasn't send it.", "两处过去分词 written、sent。"]],
  preservation: [
    ["1. Check the draft.\n2.Send it by 3:15.", "保留两项和时间，补编号后空格。"],
    ["The 2.5 kg parcel arrive at noon every Friday.", "arrives；保留小数与周期。"],
    ["Could you confirms the £19 fee?", "confirm；保留金额和礼貌。"],
    ["Version 4.2 work on both devices.", "works；保留版本和设备数量。"],
    ["Sales fell from 18% to 12%. The chart show the drop.", "shows；保留下跌方向、数字和首句。"],
    ["Agenda\n1. Review costs\n2. Discuss risks", "标题和列表短语成立；无需句子化。"],
    ["Don't change the date. The meeting start on May 8.", "starts；保留祈使句和日期。"],
    ["I might finishes by Monday.", "finish；保留不确定性。"],
    ["The team shipped 1,200 units. One unit were damaged.", "was；保留总数和受损数量。"],
    ["Please send both file by 09:05 UTC.", "files；保留 both、时区和前导零。"]]
};
const askGroups = {
  direct: [
    ["How do I pluralize 'analysis'?", "analyses；给出单复数对应。"],
    ["advice 能数吗？", "通常不可数；给出 a piece of advice。"],
    ["What is the past tense of teach?", "taught。"],
    ["look forward to 后面怎么接动词？", "to 是介词，接动名词。"],
    ["Where does often go in 'She is late'?", "常见位置 is often late。"],
    ["如何礼貌地请对方再说一遍？", "给一个能直接使用的礼貌请求。"],
    ["Is furniture singular or plural in 'the furniture is new'?", "不可数，谓语单数。"],
    ["怎么读 honest 的 h？", "h 不发音。"],
    ["Can because begin a sentence?", "可以；说明从句与主句如何构成完整句。"],
    ["borrow 的过去式是什么？", "borrowed。"]],
  contrast: [
    ["When would I use fewer instead of less?", "区分可数复数与数量，并避免绝对化。"],
    ["已经离开伦敦了，住过两年用哪个时态？", "明确结束可用一般过去时。"],
    ["Is 'I stopped to smoke' the same as 'I stopped smoking'?", "停下去抽烟与戒/停止抽烟。"],
    ["interesting 和 interested 怎么选？", "区分引发感受和体验感受。"],
    ["Can I say 'at school' and 'in the school'?", "活动身份与具体建筑的语境差异。"],
    ["mustn't 和 don't have to 有何区别？", "禁止与没有必要。"],
    ["What changes if I say 'a few' instead of 'few'?", "少量但有与强调不足。"],
    ["say 和 tell 在转述时怎么选？", "tell 通常接听者；say 可用 to。"],
    ["Do 'since Monday' and 'for a week' give the same information?", "起点与时长；未必相同。"],
    ["工作邮件结尾用 cheers 合适吗？", "取决于地区、关系和正式程度。"]],
  followup: [
    ["那 I’m used to work late 怎么改？","区分习惯晚工作与过去常晚工作。","used to do 和 be used to doing 呢？","前者描述过去习惯，后者表示习惯于。"],
    ["Would it change if the door were already open?","结合上轮区分状态与动作。","How do I request that someone open a door?","You can say ‘Could you open the door?’"],
    ["如果已经还了呢？","用过去情境回答，避免暗示书仍在手中。","怎么说我昨天借了这本书？","I borrowed this book yesterday."],
    ["Can I drop it in my sentence?","宾语关系代词可省。","Is that necessary in ‘the book that I bought’?","That is the object of bought."],
    ["换成 water 呢？","改用 how much water。","怎么问有多少个杯子？","How many cups are there?"],
    ["What if it is happening right now?","与每天对照，使用进行时。","How do I describe her daily run?","She runs in the park every day."],
    ["那如果我也没去呢？","接否定陈述用 neither did I 或 me neither。","如何回应 I went too？","可以用 So did I."],
    ["Could I use it with people?","结合上文解释 who 可指人及上下文。","Which relative pronoun fits ‘the woman ___ called’?","Who fits the subject position."],
    ["如果只有两件呢？","两者比较通常用比较级。","三个选项里最便宜的怎么说？","The cheapest of the three."],
    ["Does that sound too direct to a client?","结合原句给出适度缓和的客户请求。","How can I ask for the file?","Send me the file."]]
};
const cases = [];
function add(task, group, input, rubric, split = "formal") {
  cases.push({ id: task + "-" + (cases.filter(c => c.task === task).length + 1), task, group, split, input, rubric });
}
for (const [group, rows] of Object.entries(grammarGroups))
  for (const [text, rubric] of rows) add("grammar", group, { text }, rubric);
for (const [group, rows] of Object.entries(askGroups))
  for (const [question, rubric, q, a] of rows) add("ask", group, { question, language: /[\u3400-\u9fff]/u.test(question) ? "zh-CN" : "en", messages: q ? [{question:q, answer:a}] : [] }, rubric);

function grammar(userInput, correction = "") { return { source: "grammar", userInput, correction }; }
function practice(userInput, prompt, hintsUsed, referenceAnswer) {
  return { source: "practice", userInput, practice: { prompt, hintsUsed, referenceAnswer } };
}
function coach(group, records, rubric, split = "formal", practiceStatus = "available") {
  const entries = records.map((r,i) => ({...r, diagnoses: [], entryId: "record-" + (i+1), timestamp: new Date(Date.UTC(2026, 0, i+1)).toISOString()}));
  add("coach", group, { entries, language:"zh-CN", sourceStatus:{grammar:"available", practice:practiceStatus} }, rubric, split);
}
coach("sparse",[grammar("Thank you.")],"只支持短语层面的观察。");
coach("sparse",[grammar("node --version")],"命令无法用于评估英语能力。");
coach("sparse",[grammar("Please find the invoice attached.")],"单句无法评价篇章组织。");
coach("retry",[practice("He walk.","他走路。",0,"He walks."),practice("He walks.","他走路。",1,"He walks.")],"同题提示后答对不能证明独立掌握。");
coach("retry",[grammar("I bought apple.","I bought an apple."),grammar("I bought apple.","I bought an apple.")],"重复输入不能作为跨题复发。");
coach("retry",[practice("I am agree.","我同意。",null,"I agree."),practice("I agree.","我同意。",null,"I agree.")],"帮助状态未知，参考答案不能算学习者新证据。");
coach("recurrence",[grammar("He run daily.","He runs daily."),grammar("My dog sleep here.","My dog sleeps here.")],"不同主语和动词支持三单问题反复出现。");
coach("recurrence",[grammar("I did not saw it.","I did not see it."),grammar("Did they ate?","Did they eat?")],"两种句式共同支持 did 后原形的训练建议。");
coach("recurrence",[grammar("She gave me an information.","She gave me some information."),grammar("I need an advice.","I need some advice.")],"可指出不可数名词模式；不要泛化到所有名词。");
coach("mixed",[grammar("She goes home."),grammar("He go home.","He goes home.")],"同时承认正确和错误实例。");
coach("mixed",[grammar("I finished it yesterday.")],"Practice 来源不可用，不能声称已分析。","formal","unavailable");
coach("mixed",[grammar("I take the bus daily.","I took the bus daily."),grammar("I still take it every morning.")],"核验旧纠错；过去式并非必改。");

for (const [text,r] of [["The lights are on.","正确句不误改。"],["They has arrived.","have arrived。"],["Room 7 have two exits.","改 has，保留房号。"]]) add("grammar","calibration",{text},r,"calibration");
for (const [q,r] of [["What is the plural of mouse?","动物通常用 mice。"],["ago 和 before 怎么选？","按参照时间解释。"],["那 tomorrow 呢？","沿用上轮介词语境，tomorrow 通常直接用。"]]) add("ask","calibration",{question:q,language:q.startsWith("What")?"en":"zh-CN",messages:q.includes("tomorrow")?[{question:"on Monday 前面需要介词吗？",answer:"在星期几通常用 on。"}]:[]},r,"calibration");
coach("calibration",[grammar("Good morning!")],"问候语证据稀疏。","calibration");
coach("calibration",[grammar("Two cat.","Two cats."),grammar("Three dog.","Three dogs.")],"两个独立输入复现复数问题。","calibration");
coach("calibration",[practice("We arrived.","我们到了。",2,"We arrived.")],"提示后作答，不能判断独立能力。","calibration");
export default cases;
