import Database from 'better-sqlite3';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(resolve(__dirname, '..', 'igt_data.db'));
db.pragma('journal_mode=WAL');

const insert = db.prepare(`
  INSERT OR IGNORE INTO practice_questions
    (id, prompt_zh, reference_answer, difficulty, style, context,
     focus, error_type, served_count, focus_id, variant,
     hints_json, metadata_json, alternative_note, active, Generated_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'complex-1', ?, ?, ?, 1, 'deepseek')
`);

const questions = [
  // ===== Multi-grammar challenge questions (50 items) =====
  // Each combines 2+ grammar dimensions: conditional + passive, subjunctive + reported, etc.

  // --- G05: Conditions — layered hypothetical (7 extra complex) ---
  {
    id: 'language-g05.1-c1', focus_id: 'G05.1', focus: 'General conditions (complex)', error_type: 'G05.1: General conditions',
    prompt_zh: '如果一种材料受热膨胀而另一种材料受热收缩，那么这两者就不能用在同一个需要温度稳定的装置里。',
    reference_answer: 'If one material expands when heated while another contracts under the same conditions, then the two cannot be used together in any device that requires thermal stability.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '两个条件对比，得出禁用结论。',
      intermediate: 'if 从句用一般现在时表达科学规律；while 引出对比；结果用 cannot be used。',
      complete: 'If [材料A] + V-s + when V3 + while [材料B] + V-s + [条件], then [结果主语] + cannot be V3 + together + in [适用范围] + that [限定从句]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'explain-justify', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: 复合科学条件句——if + while 对比 + 被动结果 + that 限定。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g05.2-c1', focus_id: 'G05.2', focus: 'Open future conditions (complex)', error_type: 'G05.2: Open future conditions',
    prompt_zh: '如果你能在月底前提交完整的项目方案，并且预算控制在十万以内，董事会很可能会批准这个提案。',
    reference_answer: 'If you can submit the full project proposal by the end of the month and keep the budget under one hundred thousand, the board is very likely to approve it.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '条件有两个并列要求，都可能实现。',
      intermediate: 'if 从句用现在时，两个条件用 and 并列；结果用 be likely to。',
      complete: 'If [主语] + can V + [截止] + and + V + [限制], [决策方] + is likely to + V + [代词]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'courteous-tactful', purpose: 'predict-speculate-reflect', meaning_relationship: 'condition-exception', register: 'formal' }),
    alternative_note: 'Guided construction: 双条件并列 + 将来可能结果。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g05.3-c1', focus_id: 'G05.3', focus: 'Remote present/future (complex)', error_type: 'G05.3: Remote present/future',
    prompt_zh: '假如当初政府及时出台了监管政策，而且企业也积极配合执行，如今的市场环境就不会混乱到几乎无法收拾的地步。',
    reference_answer: 'If the government had introduced regulatory policies in time and businesses had actively cooperated in implementing them, the market environment today would not be so chaotic as to be almost unmanageable.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '双重过去假设，影响现在的混乱局面。',
      intermediate: '两个过去条件都用 had V3，现在结果用 would not be so + 形容词 + as to V。',
      complete: 'If [主语A] + had V3 + [过去时间] + and [主语B] + had V3 + [配合], [现在主语] + today + would not be so + [形容词] + as to V'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'cautious-tentative', purpose: 'predict-speculate-reflect', meaning_relationship: 'condition-exception', register: 'formal' }),
    alternative_note: 'Guided construction: 双重过去假设 + 现在结果的混合时间条件句。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g05.4-c1', focus_id: 'G05.4', focus: 'Counterfactual past (complex)', error_type: 'G05.4: Counterfactual past',
    prompt_zh: '要不是那天航班被取消，而且我的签证也恰好过期了，我本来是打算按时参加那个国际会议的。',
    reference_answer: 'Had the flight not been cancelled that day and had my visa not happened to have expired as well, I would have planned to attend that international conference on time.',
    difficulty: 'challenge', style: 'formal', context: 'travel',
    hints_json: JSON.stringify({
      simple: '两个过去原因导致结果没发生——用倒装虚拟条件句。',
      intermediate: 'Had it not been... and had... not... 是省略 if 的正式倒装条件；结果用 would have V3。',
      complete: 'Had [事物A] + not been V3 + [时间] + and had [事物B] + not V3 + [补充], [主语] + would have V3 + [原计划]'
    }),
    metadata_json: JSON.stringify({ situation: 'travel-public-life', genre: 'report-explanation', tone: 'cautious-tentative', purpose: 'predict-speculate-reflect', meaning_relationship: 'condition-exception', register: 'formal' }),
    alternative_note: 'Guided construction: 倒装虚拟条件句（Had... not been...）+ 双重原因。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g05.5-c1', focus_id: 'G05.5', focus: 'Mixed-time conditions (complex)', error_type: 'G05.5: Mixed-time conditions',
    prompt_zh: '要是十年前我没有辞掉那份稳定的工作去创业，现在就不会既没有积蓄也没有稳定的收入来源，更不用说还得照顾年迈的父母了。',
    reference_answer: 'If I had not quit that stable job ten years ago to start a business, I would not be without savings or a steady income now, let alone have to take care of my elderly parents.',
    difficulty: 'challenge', style: 'neutral', context: 'everyday',
    hints_json: JSON.stringify({
      simple: '过去选择→现在的多重困境。',
      intermediate: '条件用 had (not) V3，现在结果用 would (not) be；without + 并列名词 表达缺失；let alone 引出更糟的情况。',
      complete: 'If [主语] + had not V3 + [过去行为] + to V + [目的], [主语] + would not be without + [名词A] or [名词B] + now, let alone + [更糟后果]'
    }),
    metadata_json: JSON.stringify({ situation: 'daily-life', genre: 'conversation-chat', tone: 'cautious-tentative', purpose: 'predict-speculate-reflect', meaning_relationship: 'condition-exception', register: 'neutral' }),
    alternative_note: 'Guided construction: 过去条件→现在多重结果 + let alone 递进。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g05.6-c1', focus_id: 'G05.6', focus: 'Wishes (complex)', error_type: 'G05.6: Wishes',
    prompt_zh: '我真希望当初没有因为一时的冲动而拒绝那个机会，也希望能向当时给我建议的人当面道歉。',
    reference_answer: 'I really wish I had not rejected that opportunity on impulse, and I also wish I could apologise in person to the person who gave me advice at the time.',
    difficulty: 'challenge', style: 'neutral', context: 'work',
    hints_json: JSON.stringify({
      simple: '两个并列愿望：一个是对过去行为的后悔，一个是现在无法实现的能力。',
      intermediate: '第一个 wish 用 had (not) V3 表后悔；第二个 wish 用 could V 表现在无法做到。',
      complete: 'I wish [主语] + had not V3 + [过去行为] + on impulse, and I also wish [主语] + could V + [现在愿望] + to [对象] + who + [限定信息]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'conversation-chat', tone: 'cautious-tentative', purpose: 'predict-speculate-reflect', meaning_relationship: 'elaboration-identification', register: 'neutral' }),
    alternative_note: 'Guided construction: 并列 wish —— had V3（后悔）+ could V（现在能力）。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g05.7-c1', focus_id: 'G05.7', focus: 'Regrets (complex)', error_type: 'G05.7: Regrets',
    prompt_zh: '我后悔当时没有坚持自己的立场，反而因为害怕得罪人而同意了那个明显有问题的方案。',
    reference_answer: 'I regret not having stuck to my position at the time and instead agreeing to that clearly flawed plan out of fear of offending anyone.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '后悔没有做A，反而做了B。',
      intermediate: 'regret + not having V3 强调过去未做；instead + V-ing 表示替代行为；out of 引出动机。',
      complete: 'I regret + not having V3 + [本应做的行为] + at the time + and instead + V-ing + [实际做的行为] + out of + [动机名词]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'conversation-chat', tone: 'cautious-tentative', purpose: 'predict-speculate-reflect', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: regret + not having V3 + instead V-ing + out of。 The pattern illustrates this focus; accept other natural translations.',
  },

  // --- G06: Voice — complex passive combinations (6 extra) ---
  {
    id: 'language-g06.1-c1', focus_id: 'G06.1', focus: 'Active/passive choice (complex)', error_type: 'G06.1: Active/passive choice',
    prompt_zh: '虽然调查已经展开，但截至目前还没有任何嫌疑人被正式指控，相关证据也仍在被逐一核实。',
    reference_answer: 'Although an investigation has been launched, no suspects have yet been formally charged as of now, and the relevant evidence is still being verified piece by piece.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '调查被动展开，嫌疑人和证据也都是被动态。',
      intermediate: 'has been launched（现在完成时被动）；have been charged（现在完成时否定被动）；is being verified（现在进行时被动）。',
      complete: 'Although [事物] + has been V3, no [对象] + have yet been V3 + [时间], and [事物] + is still being V3 + [方式]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'inform-update', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: 三种时态的被动语态串用——完成被动 + 否定完成被动 + 进行被动。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g06.2-c1', focus_id: 'G06.2', focus: 'Agent omission (complex)', error_type: 'G06.2: Agent omission',
    prompt_zh: '长期以来人们都认为这种疾病是无法治愈的，但最新研究已经让这个结论被推翻了。',
    reference_answer: 'It has long been believed that this disease is incurable, but the latest research has caused this conclusion to be overturned.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '转述普遍看法（无执行者），然后新研究推翻了它。',
      intermediate: 'It has long been believed that... 是无人称被动转述；cause + 宾语 + to be V3 是使役被动。',
      complete: 'It has long been believed that [结论分句], but [新研究] + has caused + [结论] + to be V3'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'inform-update', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: It has long been believed that... + cause to be V3。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g06.3-c1', focus_id: 'G06.3', focus: 'Modal passive (complex)', error_type: 'G06.3: Modal passive',
    prompt_zh: '所有申请材料必须在截止日期之前通过官方网站在线提交，而且一旦提交就不能再被修改。',
    reference_answer: 'All application materials must be submitted online through the official website before the deadline, and once submitted they cannot be modified.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '两个情态被动：必须提交 + 不能被修改。',
      intermediate: 'must be V3 表强制性被动；cannot be V3 表禁止被动；through 引出途径。',
      complete: '[承受者] + must be V3 + [方式] + through [途径] + before [截止], and once V3 + [承受者] + cannot be V3'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'direct-firm', purpose: 'request-instruct', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: must be V3 + cannot be V3 双情态被动。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g06.4-c1', focus_id: 'G06.4', focus: 'Reporting passive (complex)', error_type: 'G06.4: Reporting passive',
    prompt_zh: '据悉这位前高管在被调查之前就已经被多次警告过，但他对这些警告似乎从未当真。',
    reference_answer: 'The former executive is reported to have been warned repeatedly before being investigated, but he is said never to have taken those warnings seriously.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '两个报道被动：被警告过 + 据说没当真。',
      intermediate: 'is reported to have been V3 表"据报道已经被…"（报道被动+完成被动）；is said never to have V3 表"据说从未"；before being V3 是介词+动名词被动。',
      complete: '[主语] + is reported to have been V3 + [频率] + before being V3, but [主语] + is said never to have V3 + [对象] + [方式]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'inform-update', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: is reported to have been V3 + is said never to have V3 双报道被动。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g06.5-c1', focus_id: 'G06.5', focus: 'Have/get something done (complex)', error_type: 'G06.5: Have/get something done',
    prompt_zh: '我们打算把办公室重新装修一遍，顺便把所有老旧的设备也一并更新换代。',
    reference_answer: 'We are planning to have the office redecorated and also to have all the outdated equipment replaced at the same time.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '两样东西都安排别人做。',
      intermediate: 'plan to have + 对象 + V3 表计划安排别人做；at the same time 表同步。',
      complete: '[主语] + are planning + to have + [对象A] + V3 + and to have + [对象B] + V3 + at the same time'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'email-message', tone: 'detached-objective', purpose: 'inform-update', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: 并列 plan to have + n + V3 双重使役。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g06.6-c1', focus_id: 'G06.6', focus: 'Make/let/have/get someone act (complex)', error_type: 'G06.6: Make/let/have/get someone act',
    prompt_zh: '经理不会让你在没接受培训的情况下独自操作这台设备，但他可以安排一个有经验的同事带你熟悉流程。',
    reference_answer: "The manager won't let you operate this equipment on your own without having been trained, but he can have an experienced colleague walk you through the process.",
    difficulty: 'challenge', style: 'neutral', context: 'work',
    hints_json: JSON.stringify({
      simple: '不让做 + 让另一个人做。',
      intermediate: "won't let + 人 + V（不带 to）= 不让；have + 人 + V（不带 to）= 安排某人做；without having been V3 是介词+完成被动动名词。",
      complete: "[主语] + won't let + [人] + V + [对象] + on one's own + without having been V3, but [主语] + can have + [另一人] + V + [代词] + through [内容]"
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'conversation-chat', tone: 'direct-firm', purpose: 'request-instruct', meaning_relationship: 'contrast-concession', register: 'neutral' }),
    alternative_note: "Guided construction: won't let + n + V（禁止使役）+ have + n + V（安排使役）+ without having been V3。 The pattern illustrates this focus; accept other natural translations.",
  },

  // --- G07: Clause linking — nested embedding (7 extra) ---
  {
    id: 'language-g07.4-c1', focus_id: 'G07.4', focus: 'Content clauses (complex)', error_type: 'G07.4: Content clauses',
    prompt_zh: '我不确定他是否明白，我们之所以坚持这个方案，是因为它已经被三个独立团队验证过了。',
    reference_answer: "I'm not sure whether he understands that the reason we insist on this plan is that it has been verified by three independent teams.",
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '不确知→是否明白→原因→验证。三层嵌套。',
      intermediate: "I'm not sure whether... 外层间接疑问；that the reason... is that... 中层原因表语从句；...has been verified by... 内层被动。",
      complete: "I'm not sure whether [主语] + V-s + that + the reason [主语] + V + on [对象] + is that [对象] + has been V3 + by [执行者]"
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'meeting-contribution', tone: 'cautious-tentative', purpose: 'explain-justify', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: whether + that + the reason... is that... 三层嵌套内容从句。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g07.9-c1', focus_id: 'G07.9', focus: 'Concession (complex)', error_type: 'G07.9: Concession',
    prompt_zh: '尽管所有人都承认这个目标过于宏大，而且可用的资金也只够维持三个月，但团队依然决定全力以赴，而不是降低标准。',
    reference_answer: 'Although everyone acknowledged that the goal was too ambitious and that the available funds would only last for three months, the team still decided to give it their all rather than lower their standards.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '两个让步条件（承认+资金不足）→仍然坚持。',
      intermediate: 'although 引导两个 that 宾语从句用 and 并列；主句用 still + decided to V + rather than + V。',
      complete: 'Although everyone V-ed + that [分句A] + and that [分句B], [主语] + still + decided + to V + rather than + V + [对象]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'explain-justify', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: although + 并列 that 从句 + rather than 对比。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g07.10-c1', focus_id: 'G07.10', focus: 'Comparison clauses (complex)', error_type: 'G07.10: Comparison clauses',
    prompt_zh: '这份数据显示，线上销售额的增长速度比去年同一时期快了将近三倍，但线下的表现却远不如预期。',
    reference_answer: 'The data shows that online sales are growing nearly three times faster than they did in the same period last year, while offline performance has fallen far short of expectations.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '线上vs线下对比——一个比去年快三倍，一个远不如预期。',
      intermediate: '比较级 + than 分句（用 did 代替重复动词）；while 引出对比；fall short of 是固定短语。',
      complete: '[数据] + shows that [主语A] + are V-ing + [倍数] + [比较级] + than + [主语] + did + [时间], while [主语B] + has V3 + far short of + [预期名词]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'inform-update', meaning_relationship: 'comparison-degree', register: 'formal' }),
    alternative_note: 'Guided construction: 比较级 + than 分句（助动词替代）+ while 对比 + fall short of。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g07.12-c1', focus_id: 'G07.12', focus: 'Non-finite noun modifiers (complex)', error_type: 'G07.12: Non-finite noun modifiers',
    prompt_zh: '被要求在一个月内完成所有测试的工程师们终于拿出了那份让所有人刮目相看的报告。',
    reference_answer: 'The engineers, who had been asked to complete all the tests within a month, finally produced the report that impressed everyone.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '被要求做X的工程师们拿出了让所有人刮目相看的Y。',
      intermediate: 'had been asked to complete（过去完成被动 + to-infinitive）；that impressed everyone 是定语从句限定报告。',
      complete: '[名词A], who had been V3 + to V + [对象] + within [时限], finally + V-ed + [名词B] + that impressed [对象]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'describe-narrate', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: who had been V3 to V（定语从句+被动+不定式）+ that impressed（第二层定语从句）。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g07.7-c1', focus_id: 'G07.7', focus: 'Purpose clauses (complex)', error_type: 'G07.7: Purpose clauses',
    prompt_zh: '公司之所以推出这个培训计划，不仅是为了提高员工的技能，更是为了让整个团队能够应对下一阶段将要面临的技术挑战。',
    reference_answer: 'The company launched this training programme not only to improve their employees\' skills but also so that the entire team would be able to tackle the technical challenges they would face in the next phase.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '双重目的：to V 短目的 + so that 长目的。',
      intermediate: 'not only to V... but also so that... 是不对等目的并列；so that + would be able to V 表达将来能力目的；they would face 是嵌入关系从句。',
      complete: '[主语] + V-ed + [对象] + not only to V + [目的A] + but also so that [主语B] + would be able to + V + [对象] + (that) [主语B] + would V + [时间]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'explain-justify', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: not only to V... but also so that... 不对等目的并列 + 嵌入关系从句。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g07.6-c1', focus_id: 'G07.6', focus: 'Reason clauses (complex)', error_type: 'G07.6: Reason clauses',
    prompt_zh: '鉴于上次合作中出现了多次因为沟通不到位而导致的延误，这次我们决定在项目启动前就制定好一套详细的汇报机制。',
    reference_answer: 'Given that the last collaboration saw multiple delays caused by poor communication, this time we decided to establish a detailed reporting system before the project even started.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '鉴于过去的教训→这次提前行动。',
      intermediate: 'Given that 引导原因（比 because 更正式）；caused by 是分词短语后置修饰 delays；before the project even started 是时间从句。',
      complete: 'Given that [过去事件主语] + V-ed + [问题] + caused by [原因名词], this time [主语] + decided + to V + [对象] + before [事件] + even V-ed'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'email-message', tone: 'detached-objective', purpose: 'explain-justify', meaning_relationship: 'result-consequence', register: 'formal' }),
    alternative_note: 'Guided construction: Given that... caused by... + before... even V-ed。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g07.13-c1', focus_id: 'G07.13', focus: 'Non-finite adverbials (complex)', error_type: 'G07.13: Non-finite adverbials',
    prompt_zh: '被通知必须在二十四小时内撤离后，他们在完全没有准备的情况下匆忙收拾了最重要的文件，留下大量来不及处理的资料。',
    reference_answer: 'Having been told that they had to evacuate within twenty-four hours, they hurriedly packed up the most important documents without any preparation, leaving behind a large amount of data that could not be processed in time.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '被通知→匆忙收拾→留下资料。三个动作共享同一主语。',
      intermediate: 'Having been told that... 是完成被动态分词作状语；leaving behind... 是现在分词作伴随结果；that could not be V3 是修饰 data 的定语从句。',
      complete: 'Having been V3 + that [从句], [主语] + V-ed + [对象] + without [补充], leaving behind [对象] + that could not be V3 + [时间]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'describe-narrate', meaning_relationship: 'time-duration', register: 'formal' }),
    alternative_note: 'Guided construction: Having been told that...（完成被动分词）+ leaving behind...（伴随分词）+ 修饰性定语从句。 The pattern illustrates this focus; accept other natural translations.',
  },

  // --- G04: Modality — layered stance (5 extra) ---
  {
    id: 'language-g04.7-c1', focus_id: 'G04.7', focus: 'Possibility (complex)', error_type: 'G04.7: Possibility',
    prompt_zh: '考虑到现有的数据量还不足以得出可靠结论，这个假设可能根本就是错的，但也可能只是因为我们漏掉了某个关键变量。',
    reference_answer: 'Given that the current amount of data is not yet sufficient to draw a reliable conclusion, this hypothesis may well be fundamentally wrong, but it could also just be that we have overlooked a key variable.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '两个不同强度的可能性——may well be 大概率错 + could just be 小概率原因。',
      intermediate: 'Given that 引出前提；may well be 表较大概率；could be that 表较小可能性；have overlooked 是现在完成时。',
      complete: 'Given that [前提分句], [主语] + may well be + [判断] + [形容词], but it could also just be that [主语] + have V3 + [另一原因]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'cautious-tentative', purpose: 'predict-speculate-reflect', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: Given that + may well be + could be that 双可能性对比。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g04.8-c1', focus_id: 'G04.8', focus: 'Deduction (complex)', error_type: 'G04.8: Deduction',
    prompt_zh: '服务器从凌晨两点起就一直没有响应——要么是硬件出了问题，要么就是有人在未经授权的情况下动了配置。',
    reference_answer: 'The server has been unresponsive since two in the morning — there must be either a hardware failure or someone must have changed the configuration without authorisation.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '两个推断：硬件故障（现在状态）或人为改动（过去行为）。',
      intermediate: 'must be 是对现在状态的推断；must have V3 是对过去行为的推断；either... or... 连接两个推断；without authorisation 是伴随状语。',
      complete: '[主语] + has been V3 + since [时间] — there must be either [名词A] + or [主语B] + must have V3 + [对象] + without [名词]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'direct-firm', purpose: 'predict-speculate-reflect', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: must be（现在推断）or must have V3（过去推断）二选一。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g04.4-c1', focus_id: 'G04.4', focus: 'Lack of obligation (complex)', error_type: 'G04.4: Lack of obligation',
    prompt_zh: '你完全没有必要为了赶进度而牺牲质量——公司从来没有要求过我们在不合理的期限内交付任何东西。',
    reference_answer: 'You really don\'t need to sacrifice quality just to keep up with the schedule — the company has never required us to deliver anything within unreasonable deadlines.',
    difficulty: 'challenge', style: 'neutral', context: 'work',
    hints_json: JSON.stringify({
      simple: '没必要做A + 因为公司没要求过B。',
      intermediate: "don't need to 表示没有必要；never required + 人 + to V 表示从没有这个要求；within 接时间界限。",
      complete: "[主语] + don't need to + V + [牺牲对象] + just to V + [目标] — [决策方] + has never required + [人] + to V + [对象] + within [限制]"
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'conversation-chat', tone: 'courteous-tactful', purpose: 'explain-justify', meaning_relationship: 'result-consequence', register: 'neutral' }),
    alternative_note: "Guided construction: don't need to + just to V + never required... to V within...。 The pattern illustrates this focus; accept other natural translations.",
  },
  {
    id: 'language-g04.3-c1', focus_id: 'G04.3', focus: 'Obligation (complex)', error_type: 'G04.3: Obligation',
    prompt_zh: '按照最新的行业规定，任何涉及用户隐私数据的操作都必须事先获得书面许可，并且保留至少三年的操作记录。',
    reference_answer: 'According to the latest industry regulations, any operation involving user privacy data must obtain prior written consent and must keep a record of the operation for at least three years.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '两条并列的强制性要求。',
      intermediate: 'According to 引出规定来源；involving 是现在分词修饰 operation；must obtain + must keep 并列情态义务；for at least + 时长。',
      complete: 'According to [来源规定], any [主语] + involving [限定范围] + must V + [对象A] + and must V + [对象B] + for at least [时长]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'direct-firm', purpose: 'request-instruct', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: According to + involving + must V + and must V 双义务并列。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g04.9-c1', focus_id: 'G04.9', focus: 'Willingness (complex)', error_type: 'G04.9: Willingness',
    prompt_zh: '虽然没有人愿意承担额外的责任，但如果项目真的因此陷入僵局，我想至少会有几个人站出来表示愿意接手协调工作。',
    reference_answer: 'Although no one is willing to take on additional responsibility, if the project really ends up deadlocked because of this, I think at least a few people would step up and express their willingness to take over the coordination.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '没有人愿意承担→但如果僵局→至少有人愿意接手。',
      intermediate: 'be willing to 表意愿；ends up deadlocked 是系动词+形容词补语表结果状态；would step up 是假想结果的意愿；express willingness to V 是名词化表达意愿。',
      complete: 'Although no one is willing to + V + [对象], if [主语] + really + ends up + [形容词] + because of [原因], I think at least [数量] + would + V + and express + willingness to V + [后续]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'meeting-contribution', tone: 'cautious-tentative', purpose: 'predict-speculate-reflect', meaning_relationship: 'condition-exception', register: 'formal' }),
    alternative_note: 'Guided construction: be willing to + ends up + 形容词 + would V + express willingness to V。 The pattern illustrates this focus; accept other natural translations.',
  },

  // --- G03: Time nesting (4 extra) ---
  {
    id: 'language-g03.5-c1', focus_id: 'G03.5', focus: 'Present relevance (complex)', error_type: 'G03.5: Present relevance',
    prompt_zh: '自上个季度以来，我们已经在研发上投入了超过预算两倍的资金，但到目前为止还没有看到任何能够量化的回报。',
    reference_answer: 'Since last quarter, we have already invested more than twice the budget in research and development, but so far we have yet to see any returns that can be quantified.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '自从上个季度→到现在投入超支→但至今无回报。',
      intermediate: 'Since + 过去时间点 + have V3 表从过去持续到现在；have yet to V 是正式否定完成表达；that can be V3 是被动定语从句。',
      complete: 'Since [时间点], [主语] + have already V3 + [倍数额] + in [领域], but so far [主语] + have yet to V + [对象] + that can be V3'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'inform-update', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: Since + have already V3 + have yet to V + that can be V3。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g03.7-c1', focus_id: 'G03.7', focus: 'Earlier past (complex)', error_type: 'G03.7: Earlier past',
    prompt_zh: '在警方到达之前，小偷已经通过那扇我们以为早就修好了的后窗逃走了。',
    reference_answer: 'Before the police arrived, the thief had already escaped through the back window that we thought had been fixed long ago.',
    difficulty: 'challenge', style: 'neutral', context: 'everyday',
    hints_json: JSON.stringify({
      simple: '三个时间层次：到达（过去）→ 逃走（更早）→ 修窗户（最早，以为修好了）。',
      intermediate: 'arrived（过去）→ had escaped（过去完成）→ had been fixed（过去完成被动，嵌入在 thought 的宾语从句中）。',
      complete: 'Before [主语A] + V-ed, [主语B] + had already V3 + through [途径] + that [主语A] + thought + had been V3 + [过去时间]'
    }),
    metadata_json: JSON.stringify({ situation: 'daily-life', genre: 'conversation-chat', tone: 'detached-objective', purpose: 'describe-narrate', meaning_relationship: 'time-duration', register: 'neutral' }),
    alternative_note: 'Guided construction: V-ed + had already V3 + that... thought + had been V3 三层时间嵌套。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g03.8-c1', focus_id: 'G03.8', focus: 'Future arrangements (complex)', error_type: 'G03.8: Future arrangements',
    prompt_zh: '根据目前已经确认的日程，下周一的演示会被安排在上午十点，不过如果客户临时有变动，我们可以提前一小时调整。',
    reference_answer: 'According to the schedule that has been confirmed so far, the demo next Monday is being arranged for ten in the morning, though we can adjust it an hour earlier if the client has a last-minute change.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '已安排的活动（进行时表将来）+ 可能的调整条件。',
      intermediate: 'has been confirmed（完成被动）修饰 schedule；is being arranged（现在进行时被动表将来安排）；though 引出让步；if 条件用现在时。',
      complete: 'According to [依据] + that has been V3 + so far, [活动] + [时间] + is being V3 + for [具体时间], though [主语] + can V + [代词] + [调整] + if [主语] + V-s + [变动]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'email-message', tone: 'detached-objective', purpose: 'inform-update', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: has been V3 + is being V3（将来安排）+ though + if 条件。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g03.6-c1', focus_id: 'G03.6', focus: 'Continuing duration (complex)', error_type: 'G03.6: Continuing duration',
    prompt_zh: '自从项目启动以来，核心团队一直在昼夜不停地工作，以至于好几个人已经连续好几周没有休过一天假了。',
    reference_answer: 'Ever since the project was launched, the core team has been working around the clock, to the point where several members have not had a single day off for weeks on end.',
    difficulty: 'challenge', style: 'neutral', context: 'work',
    hints_json: JSON.stringify({
      simple: '自从启动→一直在工作→好几个人好几周无休。',
      intermediate: 'Ever since + 过去被动 + has been V-ing；to the point where 引出程度结果；have not had... for weeks on end 是完成否定 + 持续时长。',
      complete: 'Ever since [主语] + was V3, [团队] + has been V-ing + [方式], to the point where [成员] + have not V3 + [对象] + for [时长] + on end'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'describe-narrate', meaning_relationship: 'result-consequence', register: 'neutral' }),
    alternative_note: 'Guided construction: Ever since... was V3 + has been V-ing + to the point where... have not V3 for... on end。 The pattern illustrates this focus; accept other natural translations.',
  },

  // --- G12: Information organisation — high register (5 extra) ---
  {
    id: 'language-g12.2-c1', focus_id: 'G12.2', focus: 'Fronting (complex)', error_type: 'G12.2: Fronting',
    prompt_zh: '至于那些尚未解决的技术难题，我们将在下一阶段的研发计划中逐一攻克。',
    reference_answer: 'As for those technical problems that have yet to be resolved, we will tackle them one by one in the next phase of our research and development plan.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '把未解决的难题提前，然后用代词 them 回指。',
      intermediate: 'As for 引导话题前置；that have yet to be V3 修饰 problems 的定语从句；them 是回指代词。',
      complete: 'As for [前置话题] + that have yet to be V3, [主语] + will V + them + [方式] + in [阶段范围]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'direct-firm', purpose: 'inform-update', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: As for + 前置话题 + that have yet to be V3 + 回指代词 them。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g12.3-c1', focus_id: 'G12.3', focus: 'Clefts (complex)', error_type: 'G12.3: Clefts',
    prompt_zh: '真正让客户感到不满的并不是价格本身，而是我们花了整整两周才给出的答复中竟然没有解决任何一个他们提出的核心问题。',
    reference_answer: 'What really dissatisfied the client was not the price itself, but the fact that the response we took two full weeks to deliver did not address a single one of the core issues they had raised.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '假分裂句：What 不满→不是 A 而是 B。',
      intermediate: 'What... was not A but B 是假分裂句（pseudo-cleft）；the fact that... 引出同位语从句解释 B；they had raised 是嵌套定语从句。',
      complete: 'What really V-ed + [感受方] + was not [因素A], but the fact that [主语] + we took [时长] to V + did not V + [对象B] + (that) [主语] + had V3'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'direct-firm', purpose: 'explain-justify', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: What... was not A but the fact that...（假分裂句 + 同位语 + 嵌套定语）。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g12.4-c1', focus_id: 'G12.4', focus: 'Parallelism (complex)', error_type: 'G12.4: Parallelism',
    prompt_zh: '一项合格的提案不仅要有清晰的目标、可行的预算和明确的时间表，而且必须包含风险评估、备选方案以及至少两种不同场景下的应急措施。',
    reference_answer: 'A qualified proposal must not only have clear objectives, a feasible budget, and a definite timeline, but also include a risk assessment, alternative plans, and contingency measures for at least two different scenarios.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '两大组并列要求，每组内又有三个并列项。',
      intermediate: 'not only have A, B, and C, but also include D, E, and F；两组各三个名词短语保持并列结构一致；for + 名词引出适用范围。',
      complete: '[主语] + must not only have + [名词A], [名词B], and [名词C], but also include + [名词D], [名词E], and [名词F] + for [适用范围]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'direct-firm', purpose: 'request-instruct', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: not only have A, B, and C, but also include D, E, and F 双层三项并列。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g12.6-c1', focus_id: 'G12.6', focus: 'Expansion/compression (complex)', error_type: 'G12.6: Expansion/compression',
    prompt_zh: '那些在裁员中被波及的员工——其中不少人已经为公司工作了超过十五年——在接到通知的当天就被要求收拾东西离开。',
    reference_answer: 'Those employees who were affected by the layoffs — many of whom had worked for the company for over fifteen years — were asked to pack up and leave on the very day they received the notice.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '主干：那些员工被要求离开。破折号内是补充信息。',
      intermediate: 'who were affected（定语从句）；many of whom（介词+关系代词的非限制性定语）；were asked to V（被动+不定式）；the very day they received（关系副词省略的时间定语）。',
      complete: 'Those [名词] + who were V3 + by [事件] — many of whom + had V3 + for [时长] — were V3 + to V + and V + on the very day [主语] + V-ed [对象]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'describe-narrate', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: who were V3 — many of whom had V3 — were V3 to V 嵌入补充 + 展开 + 被动。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g12.1-c1', focus_id: 'G12.1', focus: 'End focus (complex)', error_type: 'G12.1: End focus',
    prompt_zh: '在过去五年里经历了两轮融资、三次战略转型和一次几乎致命的现金流危机之后，这家初创公司最终在它成立七周年的那天拿到了它一直在等的上市批准。',
    reference_answer: 'After going through two rounds of funding, three strategic pivots, and one near-fatal cash-flow crisis over the past five years, the startup finally received the IPO approval it had been waiting for on the seventh anniversary of its founding.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '把冗长的前置背景（五年的坎坷历程）放在句首，把最重要的结果（上市批准）放在句尾。',
      intermediate: 'After going through（动名词短语作介词宾语，内含三项并列名词）；finally received 放在句尾焦点位置；it had been waiting for 是过去完成进行时定语从句。',
      complete: 'After going through + [名词A], [名词B], and [名词C] + over [时长], [主语] + finally + V-ed + [核心结果] + (that) [主语] + had been V-ing for + on [周年时间]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'inform-update', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: After going through A, B, and C... finally V-ed the X it had been V-ing for（句尾焦点+过去完成进行时）。 The pattern illustrates this focus; accept other natural translations.',
  },

  // --- Pragmatic: diplomatic complexity (5 extra) ---
  {
    id: 'language-p03-c1', focus_id: 'P03', focus: 'Diplomatic disagreement (complex)', error_type: 'P03: Diplomatic disagreement',
    prompt_zh: '我非常欣赏你们团队在这件事上投入的精力，而且你们的分析角度也确实是独到的，不过如果从合规的角度来看，目前这个方案里至少有三个地方可能会让审计方产生质疑。',
    reference_answer: 'I truly appreciate the effort your team has put into this, and your analytical approach is indeed unique, but from a compliance standpoint, there are at least three areas in the current plan that could raise questions from the auditors.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '先双重肯定（欣赏+承认独到），再委婉指出合规问题。',
      intermediate: 'I appreciate... and... is indeed... 双肯定铺垫；but from a... standpoint 引出专业角度；there are... that could... 把问题表述为可能性而非断言。',
      complete: 'I truly appreciate + [对方的付出] + that [主语] + has V3, and [对方特点] + is indeed [肯定], but from a [角度] + standpoint, there are at least [数量] + [问题名词] + in [对象] + that could V + [后果]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'email-message', tone: 'courteous-tactful', purpose: 'explain-justify', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: I appreciate... and... is indeed... but from a... standpoint, there are... that could... 双重肯定铺垫+角度化否定。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-p05-c1', focus_id: 'P05', focus: 'Expressing uncertainty (complex)', error_type: 'P05: Expressing uncertainty',
    prompt_zh: '目前的数据趋势确实看起来对第一季度很不利，但我倾向于认为这其中有一部分是季节性波动造成的，而非纯粹的结构性问题，尽管我也不想过于乐观地排除后一种可能性。',
    reference_answer: 'The current data trend does look quite unfavourable for the first quarter, but I am inclined to think that part of this is caused by seasonal fluctuations rather than purely structural issues, though I don\'t want to be overly optimistic and rule out the latter possibility either.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '承认不利→倾向季节性解释→但也不排除结构性问题。多重保留。',
      intermediate: 'does look（强调助动词 + 系动词）；I am inclined to think that... 是谨慎表态；part of this is caused by 是被动原因表达；rather than 引出对比；though... either 双重让步保留。',
      complete: '[主语] + does look [形容词] for [时间], but I am inclined to think that part of [代词] + is caused by [因素A] rather than [因素B], though I don\'t want to be [负面形容词] and V + [可能性] either'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'meeting-contribution', tone: 'cautious-tentative', purpose: 'predict-speculate-reflect', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: does look... but I am inclined to think that... is caused by... rather than... though... either 多层谨慎表达。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-p04-c1', focus_id: 'P04', focus: 'Acknowledging responsibility (complex)', error_type: 'P04: Acknowledging responsibility',
    prompt_zh: '我想为我们团队在上次交付中的表现道歉——不仅是因为错过了截止日期，更令人难以接受的是，我们交付的内容中竟然包含了本应在内部测试阶段就被发现的基础错误。',
    reference_answer: 'I would like to apologise on behalf of my team for our performance in the last delivery — not only because we missed the deadline, but even more unacceptably, the content we delivered actually contained basic errors that should have been caught during the internal testing phase.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '集体道歉→两个层面：错过截止 + 交付基础错误（本该被发现的）。',
      intermediate: 'would like to apologise on behalf of 是正式集体道歉；not only because... but even more... 递进道歉理由；should have been caught 是过去应该被做的被动（虚拟+被动）。',
      complete: 'I would like to apologise on behalf of [团队] for [行为范围] in [事件] — not only because [理由A], but even more [副词], [理由B] + that should have been V3 + during [本应发生的阶段]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'email-message', tone: 'courteous-tactful', purpose: 'explain-justify', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: would like to apologise on behalf of... — not only because... but even more... that should have been V3 多层次正式道歉+虚拟被动。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-p02-c1', focus_id: 'P02', focus: 'Tactful refusal (complex)', error_type: 'P02: Tactful refusal',
    prompt_zh: '虽然我们对这次合作机会非常感兴趣，但经过内部详细评估后，我们认为目前的提案框架与我们今年的战略方向存在较大偏差，所以恐怕无法在这个时候继续推进，不过我们很乐意在半年后重新评估。',
    reference_answer: 'While we are very interested in this collaboration opportunity, after a thorough internal evaluation, we believe that the current proposal framework deviates significantly from our strategic direction this year, so I\'m afraid we cannot proceed at this time, though we would be happy to reassess in six months.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '先表达兴趣→再说偏差→所以暂无法推进→但留半年后再评的余地。',
      intermediate: 'While 表达让步式兴趣；after... evaluation 是时间状语前置；deviates from 是正式表述偏差；I\'m afraid we cannot 是委婉拒绝；though we would be happy to 留余地。',
      complete: 'While [主语] + are [正面态度] + in [机会], after [评估] + [清醒判断] + that [方案] + V-s + significantly from [方向], so I\'m afraid [主语] + cannot V + at this time, though [主语] + would be happy to V + [时间后]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'email-message', tone: 'courteous-tactful', purpose: 'explain-justify', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: While... after... we believe that... so I\'m afraid we cannot... though we would be happy to... 正式多层委婉拒绝+留余地。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-p06-c1', focus_id: 'P06', focus: 'Setting boundaries (complex)', error_type: 'P06: Setting boundaries',
    prompt_zh: '我们可以在现有的合同框架内提供额外的技术支持，但这仅限于已被列入附件A的服务项目——任何超出该范围的请求都需要走单独的审批流程，并可能产生额外费用。',
    reference_answer: 'We can provide additional technical support within the existing contract framework, but this is limited to the services already listed in Appendix A — any request that goes beyond this scope will need to go through a separate approval process and may incur additional costs.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '能做A→但仅限于→超过范围→需审批+可能收费。',
      intermediate: 'within 接限定范围；is limited to 是界限表述；that goes beyond 是定语从句划定超出范围；will need to 和 may incur 分别是义务和可能性的情态表达。',
      complete: '[主语] + can V + [服务] + within [框架], but this is limited to [范围] + listed in [附件] — any [事物] + that goes beyond [范围] + will need to V + [流程] + and may incur [后果]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'email-message', tone: 'direct-firm', purpose: 'request-instruct', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: can V within... but is limited to... — any... that goes beyond... will need to V and may incur... 多层边界划定。 The pattern illustrates this focus; accept other natural translations.',
  },

  // --- G08: Verb complementation — formal register (3 extra) ---
  {
    id: 'language-g08.3-c1', focus_id: 'G08.3', focus: 'Verb + object + infinitive (complex)', error_type: 'G08.3: Verb + object + infinitive',
    prompt_zh: '董事会要求独立审计师在下一季度开始之前，不仅要完成对账目的全面审查，还要出具一份详细说明所有异常交易的分析报告。',
    reference_answer: 'The board has instructed the independent auditor not only to complete a comprehensive review of the accounts before the start of the next quarter, but also to produce an analytical report detailing all irregular transactions.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '要求某人不仅做A还要做B。',
      intermediate: 'instruct + 人 + not only to V... but also to V... 是不定式并列；detailing 是现在分词修饰 report。',
      complete: '[主语] + has instructed + [人] + not only to V + [对象A] + before [时间], but also to V + [对象B] + [V-ing修饰] + [细节]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'direct-firm', purpose: 'request-instruct', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: instruct + n + not only to V... but also to V... + V-ing 修饰。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g08.4-c1', focus_id: 'G08.4', focus: 'Verb + preposition (complex)', error_type: 'G08.4: Verb + preposition',
    prompt_zh: '应对这种级别的危机绝不能仅仅依赖于一两个人的判断——整个决策层必须参与到每一个关键环节的讨论中来。',
    reference_answer: 'Responding to a crisis of this level must never rely solely on the judgment of one or two individuals — the entire decision-making layer must engage in the discussion of every key step.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '不能仅依赖→必须参与。两个动词+介词搭配。',
      intermediate: 'rely on 依赖；engage in 参与；Responding to 是动名词短语作主语；of this level 是介词短语后置修饰。',
      complete: 'Responding to [名词] + of this level + must never rely solely on [依赖对象] — [主语] + must engage in [参与内容] + of every [关键名词]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'direct-firm', purpose: 'request-instruct', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: rely on + engage in 双动词介词搭配 + Responding to 动名词主语。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g08.5-c1', focus_id: 'G08.5', focus: 'Pattern changes meaning (complex)', error_type: 'G08.5: Pattern changes meaning',
    prompt_zh: '我记得把合同锁在柜子里了，但我不记得锁之前有没有检查过里面的页码是不是齐全。',
    reference_answer: 'I remember locking the contract in the cabinet, but I don\'t remember checking whether all the pages were complete before I locked it.',
    difficulty: 'challenge', style: 'neutral', context: 'work',
    hints_json: JSON.stringify({
      simple: '记得做过（锁了）+ 不记得做过（检查页码）。',
      intermediate: 'remember V-ing 记得做过；remember to V 记得去做；whether... were complete 是宾语从句（be 动词过去式）。',
      complete: 'I remember + V-ing + [对象A] + [地点], but I don\'t remember + V-ing + whether [对象B] + were [状态] + before [主语] + V-ed + [代词]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'conversation-chat', tone: 'cautious-tentative', purpose: 'describe-narrate', meaning_relationship: 'time-duration', register: 'neutral' }),
    alternative_note: 'Guided construction: remember V-ing + but don\'t remember V-ing + whether... were... 双 remember 对比 + 嵌入疑问。 The pattern illustrates this focus; accept other natural translations.',
  },

  // --- G09: Reference — precise determination (3 extra) ---
  {
    id: 'language-g09.1-c1', focus_id: 'G09.1', focus: 'Articles (complex)', error_type: 'G09.1: Articles',
    prompt_zh: '在这篇论文的第二部分，作者提出了一个非常有趣的假设——但可惜的是，这个假设所依赖的数据来源并没有在文中清楚地标注出来。',
    reference_answer: 'In the second part of the paper, the author puts forward an interesting hypothesis — but unfortunately, the data sources on which the hypothesis relies are not clearly indicated in the text.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '论文→泛指→特指那个假设→特指那些数据来源。',
      intermediate: '首次提到的 hypothesis 用 an；第二次回指用 the；on which... relies 是介词+关系代词的定语从句修饰 data sources。',
      complete: 'In [部分] + of the [整体], the [人] + puts forward an [事物A] + but unfortunately, the [事物B] + on which the [事物A] + V-s + are not clearly V3'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'explain-justify', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: an → the 回指 + on which... relies 介词关系从句。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g09.2-c1', focus_id: 'G09.2', focus: 'Countability (complex)', error_type: 'G09.2: Countability',
    prompt_zh: '如果您需要进一步的资料来评估这个职位，我们可以提供包括工作经历证明、学历认证以及至少两份推荐信在内的全套文件。',
    reference_answer: 'If you need further information to evaluate this position, we can provide a full set of documents including proof of employment history, academic qualification verification, and at least two letters of recommendation.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: 'information 不可数→documents 可数复数→proof 不可数→letters 可数复数。',
      intermediate: 'further information（不可数）；a full set of documents（量词+复数）；proof（不可数）；letters of recommendation（可数复数+of 短语）。',
      complete: 'If [主语] + need + further [不可数名词] + to V + [目的], [主语] + can provide + a full set of [复数名词] + including + [不可数名词A], [名词短语B], and at least [数量] + [复数名词C] + of [限定]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'email-message', tone: 'courteous-tactful', purpose: 'inform-update', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: information（不可数）+ a set of documents（量词+复数）+ proof（不可数）+ letters（可数）跨可数性复杂名词短语。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g09.7-c1', focus_id: 'G09.7', focus: 'Pronoun reference (complex)', error_type: 'G09.7: Pronoun reference',
    prompt_zh: '张经理把他的方案和李经理的方案都给了王总，但王总说他只看完了前者，后者的数据部分还需要再核实。',
    reference_answer: 'Manager Zhang gave both his proposal and Manager Li\'s proposal to Mr Wang, but Mr Wang said he had only finished reading the former, and that the data section of the latter still needed to be verified.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '两个方案→前者（张的）和后者（李的）用 former/latter 指代。',
      intermediate: 'the former 指代第一个提到的方案；the latter 指代第二个；that the data section... still needed to be V3 是第二个 that 宾语从句。',
      complete: '[人A] + gave both his [对象] + and [人B]\'s [对象] + to [人C], but [人C] said [主语] + had only V3 the former, and that the [部分] of the latter still needed to be V3'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'conversation-chat', tone: 'detached-objective', purpose: 'inform-update', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: the former / the latter 多对象引用 + said (that)... and that... 并列间接引语。 The pattern illustrates this focus; accept other natural translations.',
  },

  // --- V: Vocabulary — formal/academic register (3 extra) ---
  {
    id: 'language-v05-c1', focus_id: 'V05', focus: 'Conventional expressions (complex)', error_type: 'V05: Conventional expressions',
    prompt_zh: '鉴于我们双方在过去几个月中建立的良好合作关系，我们非常有信心能在互惠互利的基础上进一步深化这一伙伴关系。',
    reference_answer: 'In light of the strong working relationship we have built over the past few months, we are very confident that we can further deepen this partnership on a mutually beneficial basis.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '鉴于合作关系→有信心→在互惠基础上深化。',
      intermediate: 'In light of 是正式"鉴于"表达；we have built 是现在完成时定语从句；on a... basis 是正式"在……基础上"的惯用表达。',
      complete: 'In light of + [关系名词] + (that) [主语] + have V3 + over [时间], [主语] + are confident that [主语] + can V + [动作] + on a [形容词] basis'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'email-message', tone: 'courteous-tactful', purpose: 'predict-speculate-reflect', meaning_relationship: 'elaboration-identification', register: 'formal' }),
    alternative_note: 'Guided construction: In light of + have V3 + on a... basis 商务正式表达。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-v03-c1', focus_id: 'V03', focus: 'Word choice (complex)', error_type: 'V03: Word choice',
    prompt_zh: '虽然两组数据在表面上看起来很相似，但如果你仔细对比它们的分布特征，就会发现第一组的方差明显大于第二组，这意味着后者的样本更加集中。',
    reference_answer: 'Although the two sets of data appear similar on the surface, if you carefully compare their distribution characteristics, you will find that the variance of the first set is significantly greater than that of the second, which means that the latter\'s samples are more concentrated.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: 'appear（显得）/ compare（对比）/ greater than（大于）/ concentrated（集中）——学术用词。',
      intermediate: 'appear 是较 look 更正式的"看起来"；variance 是统计学"方差"；that of the second 用 that 代替 variance；which means 引出推论。',
      complete: 'Although [主语] + appear [形容词] + on the surface, if [主语] + carefully compare [特征], [主语] + will find that [数据A] + is significantly [比较级] + than that of [数据B], which means that [推论分句]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'explain-justify', meaning_relationship: 'comparison-degree', register: 'formal' }),
    alternative_note: 'Guided construction: appear + compare + variance + than that of + which means 学术用词+代词替代+非限制性关系从句。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-v06-c1', focus_id: 'V06', focus: 'Meaning-preserving reformulation (complex)', error_type: 'V06: Meaning-preserving reformulation',
    prompt_zh: '很多人在初学外语时都会碰到这样一个瓶颈：明明已经背了很多单词，但一到实际交流时却总是找不到合适的表达方式。',
    reference_answer: 'Many people encounter a bottleneck when they first start learning a foreign language: they have already memorised a large number of words, but when it comes to actual communication, they always struggle to find the right way to express themselves.',
    difficulty: 'challenge', style: 'neutral', context: 'everyday',
    hints_json: JSON.stringify({
      simple: '不逐字翻译"碰到瓶颈""找不到表达"。',
      intermediate: 'encounter a bottleneck 是 idiomatic 表述"碰到瓶颈"；when it comes to 是 idiom 表"一到……时"；struggle to find 替代 can\'t find 更传神。',
      complete: 'Many [人] + encounter a bottleneck + when [时间从句]: [主语] + have already V3 + [数量] + of [名词], but when it comes to [活动], [主语] + always struggle to V + [所需事物]'
    }),
    metadata_json: JSON.stringify({ situation: 'daily-life', genre: 'conversation-chat', tone: 'detached-objective', purpose: 'explain-justify', meaning_relationship: 'contrast-concession', register: 'neutral' }),
    alternative_note: 'Guided construction: encounter a bottleneck + when it comes to + struggle to find 意译地道表达。 The pattern illustrates this focus; accept other natural translations.',
  },

  // --- G02: Advanced question forms (2 extra) ---
  {
    id: 'language-g02.4-c1', focus_id: 'G02.4', focus: 'Indirect questions (complex)', error_type: 'G02.4: Indirect questions',
    prompt_zh: '我到现在还在想，那些当初反对我们方案的人，到底是真的看到了我们没有意识到的风险，还是只是出于对改变的本能抵触。',
    reference_answer: 'I am still wondering whether those who initially opposed our plan genuinely saw risks that we had not been aware of, or whether it was simply an instinctive resistance to change.',
    difficulty: 'challenge', style: 'neutral', context: 'work',
    hints_json: JSON.stringify({
      simple: '还在想→是否A或是否B。两个间接疑问并列。',
      intermediate: 'I am wondering whether... 是现在进行时间接疑问；who opposed 是定语从句修饰 those；that we had not been aware of 是过去完成时定语从句（介词后置）；or whether 是并列间接疑问。',
      complete: 'I am still wondering whether [主语] + who V-ed + [对象] + genuinely V-ed + [名词] + that [主语] + had not been aware of, or whether it was simply [名词短语]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'conversation-chat', tone: 'cautious-tentative', purpose: 'predict-speculate-reflect', meaning_relationship: 'elaboration-identification', register: 'neutral' }),
    alternative_note: 'Guided construction: wondering whether... or whether 并列间接疑问 + who V-ed... that... had not been aware of 多层嵌套。 The pattern illustrates this focus; accept other natural translations.',
  },
  {
    id: 'language-g02.5-c1', focus_id: 'G02.5', focus: 'Negative scope (complex)', error_type: 'G02.5: Negative scope',
    prompt_zh: '并不是所有接受过培训的员工都能在实际操作中不出差错，但这不意味着培训本身没有价值。',
    reference_answer: 'Not all employees who have received training can perform the actual operations without making mistakes, but this does not mean the training itself is without value.',
    difficulty: 'challenge', style: 'formal', context: 'work',
    hints_json: JSON.stringify({
      simple: '并非所有→但不意味。双重否定范围。',
      intermediate: 'Not all 是部分否定；who have received 是完成时定语从句；without making 是介词+动名词否定；does not mean... is without 是双重否定收束。',
      complete: 'Not all [名词] + who have V3 + [限定] + can V + [行为] + without V-ing [问题], but this does not mean [事物] + itself + is without [正面价值]'
    }),
    metadata_json: JSON.stringify({ situation: 'work-study', genre: 'report-explanation', tone: 'detached-objective', purpose: 'explain-justify', meaning_relationship: 'contrast-concession', register: 'formal' }),
    alternative_note: 'Guided construction: Not all... who have V3... without V-ing... does not mean... is without 三重否定范围嵌套。 The pattern illustrates this focus; accept other natural translations.',
  },
];

const tx = db.transaction(() => {
  for (const q of questions) {
    insert.run(
      q.id, q.prompt_zh, q.reference_answer, q.difficulty, q.style, q.context,
      q.focus, q.error_type, q.focus_id,
      q.hints_json, q.metadata_json, q.alternative_note
    );
  }
});

tx();
console.log(`Inserted ${questions.length} complex questions.`);
db.close();