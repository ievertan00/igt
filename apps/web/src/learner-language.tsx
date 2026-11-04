import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

export type LearnerLanguage = "zh-CN" | "en";
export const learnerLanguageKey = "clearwrite.learner-language";

// Only authored interface copy belongs here. Learning content and model output
// keep their original language, even when they happen to match a UI label.
export const beginnerCopy: Record<string, string> = {
  "Model settings": "模型设置",
  "Model": "模型",
  "Switch model configuration": "切换模型配置",
  "Applies to all sections for future requests.": "应用于所有功能的后续请求。",
  "Current setup": "当前配置",
  "Loading models…": "正在加载模型…",
  "Manage models": "管理模型",
  "Switching model…": "正在切换模型…",
  "Shared across sections": "所有功能共用",
  "Retry": "重试",
  "Saved models": "已保存的模型",
  "Configuration": "配置",
  "New configuration": "新建配置",
  "Configuration name": "配置名称",
  "e.g. Everyday writing": "例如：日常写作",
  "Active": "使用中",
  "Save and use model": "保存并使用模型",
  "Save as new model": "另存为新模型",
  "Update selected model": "更新所选模型",
  "Saving as new keeps your existing models. Updating replaces only the selected configuration.": "另存为新模型会保留已有模型；更新只会替换所选配置。",
  "Model configuration saved and applied.": "模型配置已保存并应用。",
  "Grammar, Express, Vocabulary, Practice, and Ask": "语法检查、表达、词汇、练习与提问",
  "Save a named setup, then switch models from Writing, Vocabulary, Practice, or Coach. Changes apply to all sections for future requests.": "为配置命名并保存后，即可在写作、词汇、练习或学习教练中切换模型。切换将应用于所有功能的后续请求。",
  "Search notes or topics": "搜索笔记或主题",
  "Search notes or topics…": "搜索笔记或主题…",
  "Clear search": "清除搜索",
  "Clear topic filter": "清除主题筛选",
  "Show fewer topics": "收起主题",
  "Show all {count} topics": "显示全部 {count} 个主题",
  "Copied summary": "摘要已复制",
  "Copy summary": "复制摘要",
  "Copied to clipboard": "已复制到剪贴板",
  "Updated": "更新于",
  "Open this note to read the full explanation.": "打开笔记，阅读完整解释。",
  "Read note": "阅读笔记",
  "Copied content": "正文已复制",
  "Copy note content": "复制笔记正文",
  "Could not copy. Open the note and copy its text manually.": "复制失败。请打开笔记，手动选择并复制正文。",

  "AI-Powered Writing Enhancer": "AI 英文写作助手",
  "Refine your tone, catch subtle grammar nuances, and learn standard phrasing with contextual feedback.": "调整语气、发现细微的语法问题，通过结合语境的反馈学习规范表达。",
  "Try writing it yourself first. Use AI feedback as your continuous learning guide.": "先试着自己写，再通过 AI 反馈持续学习。",
  "Save this feedback to your personalized learning log for revision later.": "将这次反馈保存到学习记录，方便日后复习。",
  "AI Assistant": "AI 助手",
  "Ask why, compare alternatives, or request extra examples.": "了解原因、比较不同表达，或查看更多例句。",
  "Suggested follow-ups": "建议追问",
  "Why use this verb form?": "为什么使用这个动词形式？",
  "Is this formal enough for documentation?": "这种表达适合正式文档吗？",
  "Give 3 alternative variations": "请给出三种其他表达",
  "Explain the grammar changes here": "请解释这里的语法修改",
  "Hello! I'm your ClearWrite Assistant. Have questions about these suggestions or want alternative phrasing options?": "你好！我是 ClearWrite 助手。你可以追问这些建议，也可以探索其他表达方式。",
  "Ask AI": "提问",
  "All notes": "全部笔记",
  "Topics": "主题",
  "Tenses": "时态",
  "Sentence structure": "句子结构",
  "Articles & determiners": "冠词与限定词",
  "Prepositions": "介词",
  "Verbs": "动词",
  "Word choice": "词语辨析",
  "Collocations": "词语搭配",
  "Pronunciation": "发音",
  "Style & tone": "风格与语气",
  "Writing": "写作",
  "Reading": "阅读",
  "Listening": "听力",
  "Conversation": "会话",
  "Usage": "用法",
  "Grammar": "语法",
  "Vocabulary": "词汇",
  "Other": "其他",
  "Uncategorized": "未分类",
  "Try a different category or topic.": "试试其他分类或主题。",

  "Delete note": "删除笔记",
  "Delete saved check": "删除这条记录",
  "Confirm deletion": "确认删除",
  "Delete this check?": "删除这条记录？",
  "This cannot be undone.": "删除后无法恢复。",
  "Delete": "删除",
  "Could not delete this check. Try again.": "无法删除这条记录，请重试。",
  "This saved check could not be deleted. Refresh the log or try again.": "无法删除这条已保存的记录，请刷新记录列表或重试。",
  "Choose a valid saved check.": "请选择有效的已保存记录。",
  "The Review Log is not configured.": "尚未配置 Review Log。",
  "The Review Log is unavailable. Refresh before trying again.": "暂时无法读取 Review Log，请刷新后重试。",
  "More than one saved check has this ID. Resolve the duplicate IDs in your Review Log first.": "多条记录使用了相同的编号，请先在 Review Log 中处理重复编号。",
  "Only saved Handbook checks can be deleted here.": "这里只能删除 Handbook 中已保存的语法检查记录。",
  "Your Review Log changed. Refresh before deleting this check.": "Review Log 已发生变化，请刷新后再删除这条记录。",
  "Saved check deleted from your Review Log.": "已从 Review Log 中删除这条记录。",
  "Delete this note?": "删除这篇笔记？",
  "This permanently deletes the saved note. This cannot be undone.": "这篇已保存的笔记将被永久删除，无法恢复。",
  "Keep note": "保留笔记",
  "Retry deletion": "重试删除",
  "Note deleted": "笔记已删除",
  "Saved note": "已保存的笔记",
  "Close note": "关闭笔记",
  "Dismiss notification": "关闭通知",
  "Cancel": "取消",
  "Delete permanently": "永久删除",
  "Deleting…": "正在删除…",
  "Permanently delete this saved note? This cannot be undone.": "确定永久删除这篇已保存的笔记？此操作无法撤销。",
  "Could not delete this note. Try again.": "无法删除这篇笔记，请重试。",
  "This Ask note could not be deleted. Try again.": "无法删除这篇 Ask 笔记，请重试。",
  "Ask about this feedback": "继续了解这次反馈",
  "Ask why, compare alternatives, or try another example. This checked sentence and its feedback are included.": "询问原因、比较其他表达，或尝试新例句。提问时会附上这次检查的原句与反馈。",
  "Follow-up question": "追问",
  "For example: Why use this verb form?": "例如：为什么这里要用这个动词形式？",
  "Ask a follow-up": "继续追问",
  "Save as Ask note": "保存为 Ask 笔记",
  "Saved as an Ask note.": "已保存为 Ask 笔记。",
  "Could not answer. Your question is kept; try again.": "暂时无法回答。问题已保留，请重试。",
  "Could not save. Try again.": "暂时无法保存，请重试。",
  "The response was empty. Please try again.": "回答为空，请重试。",
  "There is no answer to save.": "没有可保存的回答。",
  "Check your writing. Understand the suggested changes.": "写一句英语，检查语法和用词，再看懂为什么这样改。",
  "Your English sentence": "你写的英语句子",
  "Write something in English…": "试着用英语写一句话，例如：I went to the park yesterday.",
  "A sentence or a short paragraph": "从一句话或一小段英语开始",
  "Checking grammar and wording…": "正在检查语法和用词…",
  "Checking…": "正在检查…",
  "Check my English": "检查我的英语",
  "Try writing it yourself first. Use AI feedback as a guide, then practise the expression in your own context. Save only when you choose.": "先自己试着写，再参考 AI 的修改建议。看懂后，用自己的话再写一句。想留着复习时，再点击保存。",
  "Save to review log": "保存到复习记录",
  "Saved": "已保存",
  "Saving…": "正在保存…",
  "Explore an English version of your Chinese text, or check what an English passage means in Chinese. Compare the wording, then try expressing the idea yourself.": "不知道英语怎么说？先写中文，参考英语表达。也可以输入英语，查看中文意思。读懂后，试着自己说一遍。",
  "Your text": "你想表达或理解的内容",
  "Chinese → English": "中文 → 英语",
  "English → Chinese": "英语 → 中文",
  "What do you want to say?": "你想说什么？",
  "What do you want to understand?": "你想读懂什么？",
  "Describe your idea in Chinese. You can include who you’re speaking to and the tone you want.": "用中文写下你的想法，也可以说明对谁说、希望语气正式还是轻松。",
  "Paste an English sentence or passage. Include the context if it helps explain the meaning.": "粘贴一句或一段英语。可以补充它出现的场景，帮助理解意思。",
  "Finding the right words…": "正在整理英语表达…",
  "Explaining the meaning…": "正在解释意思…",
  "Say it in English →": "看看英语怎么说 →",
  "Explain in Chinese →": "用中文解释 →",
  "Recall the expression. Make it easier to use next time.": "先不看答案，试着回想英语单词或短语，再查看反馈。",
  "Type the English word or phrase…": "输入你想起的英语单词或短语…",
  "Check answer": "检查答案",
  "Show answer": "查看答案",
  "Next word": "下一个单词",
  "Start a new session": "开始新一轮复习",
  "Find possible practice priorities in your saved writing. These suggestions reflect your activity here, not a full assessment of your English.": "根据你保存的写作记录，找出值得多练的地方。这些建议只反映你在这里的练习，不代表完整的英语水平评估。",
  "Enter an English word or a Chinese expression. Find its English meaning, examples, and common combinations, then save it for review.": "输入英语单词或中文说法，查看意思、例句和常见搭配。想以后复习，可以保存到单词本。",
  "Try “follow up” or “跟进”": "例如：follow up 或 跟进",
  "Look up": "查词",
  "Review due words": "复习到期单词",
  "Looking up…": "正在查词…",
  "Try translating a Chinese sentence into English before checking the AI feedback. Use the suggestions to revise your answer and try a new sentence of your own.": "先把题目中的中文翻译成英语，再查看 AI 的建议。修改后，试着用同样的表达另写一句。",
  "Write your translation in English…": "试着用英语翻译上面的句子…",
  "Revisit corrections and notes from your writing. Try a fresh example without looking, then compare it with your notes.": "回看写作中的修改和笔记。先不看笔记，自己写一个新例句，再对照检查。",
  "Search your examples": "查找你的例句",
  "Search sentences, corrections or notes": "搜索原句、修改或笔记",
  "Keep saving your writing to build a collection of useful examples.": "检查写作后，保存想复习的内容，慢慢积累自己的例句。",
  "Make sense of grammar, word choice, tone, and natural expressions. Bring a sentence or a question.": "可以问语法、用词、语气，或怎样说更自然。用中文提问也可以，最好附上一个例句。",
  "Useful explanations, kept for later. Find a note and pick up where you left off.": "这里保存了你想回看的解释。找到一篇笔记，就可以接着学习或提问。",
  "Ask a question": "提个问题",
  "Keep the conversation going": "接着问",
  "What would you like to understand?": "你想弄懂什么？",
  "Ask a follow-up. Add an example or tell us what is still unclear…": "继续提问，可以补充例句，或说说还有哪里不明白…",
  "Type your question here. Add a sentence or an example for context…": "用中文或英语写下问题，附上例句会更容易解释清楚…",
  "Ctrl / ⌘ + Enter to send": "按 Ctrl / ⌘ + Enter 发送",
  "Thinking…": "正在思考…",
  "Send": "发送",
  "Thinking about your question…": "正在整理你的问题…",
  "AI explanations may need checking. Save useful answers to revisit them.": "AI 的解释也可能有误，学习时请结合例句判断。有用的回答可以保存，方便回看。",
  "Search saved notes": "查找已保存的笔记",
  "Search titles, tags or content…": "搜索标题、标签或正文…",
  "All categories": "全部分类",
  "All tags": "全部标签",
  "Category": "分类",
  "Tag": "标签",
  "Copy response": "复制回答",
  "Explore further": "继续了解",
  "Back to question": "返回上一个问题",
  "New conversation": "开始新对话",
  "Continue discussion": "继续提问",
  "About statuses": "了解学习状态",
  "Search saved words": "查找已保存的单词",
  "Search words, meanings or examples…": "搜索单词、意思或例句…",
  "Sort by": "排序方式",
  "Word: A–Z": "按字母 A–Z",
  "Recently saved": "最近保存",
  "Next review": "下次复习",
  "Review schedule": "复习时间",
  "Any schedule": "全部时间",
  "Due for review": "该复习了",
  "Upcoming": "稍后复习",
  "Not scheduled": "尚未安排",
  "Learning status": "学习状态",
  "All learning statuses": "全部学习状态",
  "Clear filters": "清除筛选",
  "Learning distribution": "学习状态分布",
  "Menu": "菜单",
  "Main navigation": "主导航",
  "Open navigation": "打开导航",
  "Close navigation": "收起导航",
  "Skip to content": "跳到正文",
  "ClearWrite home": "ClearWrite 首页",
  "ClearWrite helps you check your writing, explore words, and practise expressing ideas. Use it alongside regular reading, listening, and real conversations—learning English takes more than a tool.": "从写一句话开始：检查写作、查词，再练习表达。平时也要多读、多听，找机会用英语交流。",
  "Current focus": "最近的练习重点",
  "Write about something from your day, then review the suggested changes.": "用英语写一件今天发生的事，再看看修改建议。",
  "Write a sentence": "写一句英语",
  "Recent writing": "最近的写作",
  "Your activity here": "在这里的练习记录",
  "Your learning library": "你的学习资料",
  "No saved writing yet": "还没有保存的写作",
  "Check a sentence in Grammar, then save the feedback you want to revisit.": "到「语法检查」写一句英语，检查后保存想复习的反馈。",
  "Connect Google Gemini, Qwen, DeepSeek, LM Studio, vLLM, and other OpenAI-compatible services.": "连接 AI 服务，用于检查写作、解释词汇和回答问题。请在下方选择服务并填写模型信息。",
  "Choose where IGT reads and saves your Markdown learning records.": "选择学习记录的 Markdown 文件位置，方便保存和回看。",
  "Markdown file settings": "学习记录文件设置",
  "Markdown files": "学习记录文件",
  "Settings sections": "设置分类",
  "Answer language": "回答语言",
  "Note language": "笔记语言",
  "Applies to your next answer. English examples stay in English.": "用于下一次生成的回答。英语例句仍保留英文。",
  "Save this answer": "保存这条回答",
  "Summarize & save conversation": "整理对话并保存",
  "Saved to notes": "已保存到笔记",
  "Retry save": "重试保存",
  "This is a new discussion using the complete saved note as context. Your note stays unchanged.": "你可以根据这篇完整笔记继续提问。原笔记不会被修改。",
  "No saved conversations yet": "还没有保存的笔记",
  "Save a useful answer in Ask to revisit it here.": "在 Ask 中保存有用的回答，就可以在这里回看。",
  "Your saved CLI notes appear here too.": "从 CLI 保存的笔记也会显示在这里。",
  "No notes match these filters": "没有符合筛选条件的笔记",
  "Try a different word, category or tag.": "换一个关键词、分类或标签试试。",
  "Use this note as context for a new question.": "根据这篇笔记，继续提出新问题。",
  "Wait for your current answer before starting another discussion.": "请等当前回答完成，再开始新的讨论。",
  "Drag the corner to resize · Arrow keys when focused": "拖动角落调整大小；也可以聚焦后使用方向键",
  "Could not check your English. Try again.": "暂时无法检查，请保留原句并重试。",
  "Couldn’t find an expression. Try again.": "暂时无法生成表达，请保留输入并重试。",
  "Could not prepare practice. Please try again.": "暂时无法准备练习，你的设置已保留，请重试。",
  "Could not review this answer. Try again.": "暂时无法评价，你的答案已保留，请重试。",
  "Could not start a new session. Try again.": "暂时无法开始复习，请重试。",
  "No examples in this category yet.": "这个分类还没有例句。",
  "A little more practice first.": "先积累一些练习记录。",
  "These suggestions are based on the records available here. They do not show everything you know or how you use English elsewhere.": "这些建议只根据这里的记录生成，不能完整反映你已经学会的内容，也不能代表你在其他场景中的英语表现。",
  "AI feedback is a suggestion, not a measure of mastery.": "AI 的反馈可以帮助你练习，但不能证明你已经掌握。",
  "Your learning notes could not be loaded.": "暂时无法读取学习笔记，请重试。",
  "Loading your handbook…": "正在读取学习手册…",
  "Loading your learning activity…": "正在读取练习记录…",
  "Looking at your learning history…": "正在分析已有的练习记录…",
  "Coach is unavailable": "暂时无法生成练习建议",
  "Key structure": "核心结构",
  "Practice drills": "练习训练",
  "Self-correct": "自我修正",
  "New context": "新场景迁移",
  "Recall tomorrow": "隔天回忆",
  "Incorrect": "错句",
  "Correct": "修正",
  "Reveal hint": "显示提示",
  "Reveal answer": "显示答案",
  "Structure hint": "结构提示",
  "Answer": "参考答案",
  "Express this intent": "表达这个意图",
  "No answers — try these tomorrow without looking back at today's work.": "这里不提供答案——明天再来尝试，不要回头看今天的练习。",
  "Three-phase practice: self-correct → transfer to new context → recall tomorrow. Work through each phase without looking ahead.": "三阶段练习：自我修正 → 迁移到新场景 → 隔天回忆。按顺序完成每个阶段，不要提前看后面的内容。",
  "Practise together": "一起练习",
  "These structures are worth practising alongside this one — learning to distinguish them builds more durable knowledge.": "这些结构值得和当前模式一起练习——学会区分它们能建立更持久的掌握。",
  "Overview is unavailable": "暂时无法读取学习概览",
  "Model settings are unavailable": "暂时无法读取模型设置",
  "Loading model settings…": "正在读取模型设置…",
  "Markdown file settings are unavailable": "暂时无法读取学习记录文件设置",
  "Loading Markdown file settings…": "正在读取学习记录文件设置…",
  "Could not save": "未能保存，请重试",
  "Input changed. Check again before saving.": "输入已经修改，请重新检查后再保存。",
  "Case, spaces and hyphens do not affect spelling.": "大小写、空格和连字符不会影响拼写判断。",
  "Cannot recall it? Leave your answer blank and check.": "想不起来也没关系，可以留空后点击检查。",
  "Choose a context or keep all contexts.": "可以选择一个使用场景，也可以保留全部场景。",
  "Related sentence practice from your Handbook. Your overall translation score and hints used will be recorded separately from mastery of this pattern.": "这些句子与你在 Handbook 中查看的用法相关。系统会记录翻译总分和提示使用情况，但这些记录不能直接证明你掌握了这个用法。",
  "Choose how many questions for this session.": "选择这一轮想练几道题。",
  "Match the level to your current ability and goal.": "根据你现在的能力和练习目标选择难度。",
  "Easy uses one familiar idea; Standard adds a realistic choice; Challenge asks for more precise, connected English.": "Easy 围绕一个熟悉的意思练习；Standard 增加实际情境中的表达选择；Challenge 需要更准确、连贯的英语。",
  "Choose a level and context for a short session from the question bank.": "选择难度和使用场景，从题库中开始一轮简短练习。",
  "Write your own translation first. If you get stuck, reveal a hint one step at a time.": "先自己试着翻译。如果卡住了，可以逐步查看提示。",
  "Compare the suggestions with your answer. The reference is one possible expression; other answers may also work.": "把建议与你的答案对照着看。参考答案只是一种表达方式，其他合理的译法也可能正确。",
  "Your attempts are recorded. One good answer is a useful step; try using the expression again later.": "系统会记录你的练习。答对一次是进步，也请过一段时间再试着使用这个表达。",
  "Translate this sentence into English.": "试着把这句话翻译成英语。",
  "There is not enough evidence to choose a focus yet. Keep saving your writing and revisit Coach after a little more practice.": "目前的记录还不足以判断练习重点。继续保存写作反馈，积累一些练习后再来看看 Coach。",
  "Learning statuses describe recorded recall evidence, not complete mastery. Review schedules are tracked separately.": "学习状态根据已记录的回忆表现判断，不能代表完全掌握。复习时间另行安排，不等于学习状态。",
  "Classification depends on available history. Ratings and scheduled intervals alone do not establish retention.": "状态取决于已有记录。仅凭自评等级或复习间隔，不能判断你是否已经记牢。",
  "No reviews have been recorded for this review card.": "这张复习卡还没有复习记录。",
  "Recall evidence is accumulating, or the latest correct recall used audio assistance.": "回忆记录还在积累中，或最近一次答对时使用了语音提示。",
  "The latest recorded typed recall was incorrect, regardless of the selected rating.": "最近一次输入的回忆答案不正确；自评等级不会改变这条记录。",
  "Consecutive correct recalls without audio assistance on at least two separate days.": "至少在两个不同日期，连续不借助语音提示答对。",
  "Consecutive correct recalls without audio assistance, with at least 7 actual days between the latest two reviews.": "连续不借助语音提示答对，而且最近两次复习实际相隔至少 7 天。",
  "Detailed recall evidence is missing, incomplete, older than the latest review, or cannot be uniquely linked to this entry.": "详细回忆记录缺失、不完整、早于最近一次复习，或无法准确对应到这个词条。",
  "Review information could not be loaded. Your saved content is available.": "暂时无法读取复习信息，已保存的词条仍可查看。",
  "Choose your vocabulary file in Settings to browse your saved words.": "在 Settings 中选择词汇文件，就可以查看已保存的单词。",
  "Broaden your review and learning filters to see more words.": "放宽复习时间或学习状态的筛选条件，查看更多词条。",
  "Look up an expression and save it to find it here.": "查询一个想学的表达并保存，就可以在这里回看。",
  "Read a saved snapshot of your learning history. A past report may differ from your current Handbook.": "查看以前保存的学习报告。报告保留当时的记录，可能与现在的 Handbook 不同。",
  "No saved reports yet. Reports you generate with /handbook will appear here.": "还没有保存的报告。通过 /handbook 生成的报告会显示在这里。",
  "Showing the 500 most recent reports.": "这里显示最近的 500 份报告。",
  "HTML opens offline and includes a print layout. Report text is preserved as saved; its conclusions may reflect an older analysis.": "HTML 报告可以离线打开和打印。正文保留保存时的内容，其中的结论可能来自较早的分析。",
  "This report has no matching structured snapshot. It can be read and exported, but reliable count comparisons are unavailable.": "这份报告没有对应的结构化记录。可以阅读和导出，但暂时无法可靠地比较记录数量。",
  "Related practice is temporarily unavailable. Refresh to try again.": "相关练习暂时不可用，请刷新后重试。",
  "No related practice questions are available for this category yet. Your examples remain available below.": "这个分类暂时没有相关练习题，你的例句仍可在下方查看。",
  "Your examples are ready to read while the explanation is prepared. You can switch categories.": "解释生成期间，你仍可阅读例句，也可以切换分类。",
  "Your examples have changed. Refresh the handbook before trying again.": "例句已经更新，请刷新 Handbook 后重试。",
  "The explanation could not be loaded. Your examples are still available. Please try again.": "暂时无法读取解释，你的例句仍可查看，请重试。",
  "Choose where IGT reads and saves its Markdown learning records. Paths are stored locally.": "选择学习记录的 Markdown 文件位置。文件路径只保存在本机。",
  "Used for requests after you save.": "保存后，新的请求将使用这项设置。",
  "API base URL, usually ending in /v1": "API 服务地址，通常以 /v1 结尾。",
  "ⓘ API base URL, usually ending in /v1": "API 服务地址，通常以 /v1 结尾。",
  "ⓘ Optional for local services. Stored on this device.": "本地服务可以不填。密钥只保存在本机。",
  "Stored on this device; leave blank to keep the saved key.": "密钥只保存在本机。留空即可继续使用已保存的密钥。",
  "Remove this provider’s key when saving": "保存时删除这个服务的密钥",
  "Grammar, Express, and Ask": "用于 Grammar、Express 和 Ask。",
  "Handbook, Coach, and text analysis": "用于 Handbook、Coach 和文本分析。",
  "Preparing explanation…": "正在准备解释…",
  "Try explanation again": "重新生成解释",
  "Explain this pattern": "解释这个用法",
  "There is not enough evidence to choose a focus yet. Keep saving your writing and feedback, then check back.": "目前的记录还不足以判断练习重点。继续保存写作和反馈，积累一些练习后再来看看。",
  "Based on all {history} for this category, including examples outside your search. These observations do not establish mastery.": "根据这个分类的{history}判断，包括搜索结果以外的例句。这些记录不能证明你已经掌握。",
  "saved history": "全部已保存记录",
  "records in the last {days} days": "最近 {days} 天的记录",
  "Get a rule explanation based on up to {count} recent examples from this category. Matching saved explanations are reused.": "根据这个分类最近的最多 {count} 条例句生成用法解释。如果已有匹配的解释，会直接显示已保存的内容。",
  "AI-generated from {count} recent examples. Check the explanation against your sentences.": "AI 根据最近 {count} 条例句生成。请对照自己的句子检查解释是否合适。",
  "An overall score does not establish control of this specific pattern.": "翻译总分不能证明你已经掌握这个具体用法。",
  "{count} related questions available. Choose your session before starting.": "有 {count} 道相关题目。开始前，可以先选择这一轮的练习设置。",
  "Could not get an answer. Your question is still here.": "暂时无法生成回答，你的问题已保留，请重试。",
  "Saved notes could not be loaded.": "暂时无法读取已保存的笔记，请重试。",
  "Retry loading notes": "重新读取笔记",
  "Refreshing your notes…": "正在刷新笔记…",
  "Loading saved notes…": "正在读取已保存的笔记…",
  "Summarizing and saving your conversation…": "正在整理对话并保存笔记…",
  "Saving to notes…": "正在保存到笔记…",
  "Save not confirmed. Retry safely; an already saved conversation will be reused.": "保存结果尚未确认。可以安全重试，已保存的对话会直接复用。",
  "Could not copy. Select the response text and copy it manually.": "暂时无法复制，请选中回答正文手动复制。",
  "Response copied": "已复制回答",
  "New question": "提出新问题",

  // ── Dashboard / Overview ──
  "Your effort. Your next focus.": "你的练习投入，你的下一步重点。",
  "See your sentence work over time and the mistakes to give attention to next.": "查看你的句子练习趋势，找到需要关注的重点错误。",
  "Refresh": "刷新",
  "Loading…": "正在读取…",
  "Loading recorded activity…": "正在读取练习记录…",
  "Previously loaded activity remains below.": "之前加载的记录仍在下方显示。",
  "Try again": "重试",
  "Some activity could not be read: {sources}. Counts may be incomplete.": "部分记录暂时无法读取：{sources}。统计数字可能不完整。",
  "Top 3 priorities": "重点关注的 3 个错误",
  "Most frequent error types in saved Grammar and Text feedback. Each diagnosis counts as one hit.": "Grammar 和 Text 分析中最频繁的诊断类型。每次诊断计为一次命中。",
  "Priorities unavailable": "无法读取重点",
  "Saved writing could not be read. Refresh to try again.": "暂时无法读取已保存的写作记录，请刷新后重试。",
  "No error types recorded in the last 30 days.": "最近 30 天没有记录到错误类型。",
  "Save feedback from Grammar or Text analysis to see what needs attention.": "保存 Grammar 或 Text 分析的反馈，即可看到需要关注的重点。",
  "Practise sentences": "练习句子",
  "Recent activity": "最近活动",
  "Open record": "打开记录",
  "No records on this page.": "这一页没有记录。",
  "No recent activity in this window.": "这个时间范围内没有最近活动。",
  "Go to the previous page to see earlier records.": "翻到上一页，查看更早的记录。",
  "Complete a practice or save some feedback — it will appear here.": "完成一次练习或保存一些反馈，就会在这里显示。",
  "{start}–{end} of {total}": "{start}–{end}，共 {total} 条",
  "{total} records": "共 {total} 条",
  "Previous": "上一页",
  "Next": "下一页",
  "Your saved material": "你的学习资料",
  "Saved words": "已保存的单词",
  "Browse your library": "浏览你的单词本",
  "Grammar corrections": "语法修正记录",
  "Your saved sentences and feedback": "你保存的句子与反馈",
  "Ask notes": "Ask 笔记",
  "Explanations you kept": "你保留的解释",
  "Recorded effort and error frequency do not establish mastery. Unsaved tool use is not included. Vocabulary review history is excluded.": "记录的练习量和错误频次不能证明掌握程度。未保存的工具使用不包含在内，词汇复习记录不在此统计。",
  "{count} undated record(s) excluded.": "已排除 {count} 条无日期记录。",
  "Effort trend": "练习趋势",
  "Daily": "日",
  "Weekly": "周",
  "Monthly": "月",
  "Last 7 days": "最近 7 天",
  "Last 4 weeks": "最近 4 周",
  "Last 6 months": "最近 6 个月",
  "Sentences · zero baseline": "句子数 · 零点基线",
  "Today": "今天",
  "Current": "当前",
  "Weekly momentum:": "周练习动量：",
  "No previous-week baseline": "上周无基线数据",
  "No activity in either week": "近两周均无练习记录",
  "{percent}%": "{percent}%",
  "{current} sentences in the last 7 days vs {previous} in the previous 7 days.": "最近 7 天 {current} 句，前 7 天 {previous} 句。",
  "How effort is counted": "练习量如何计算",
  "Beijing dates. Weeks start Monday; current week and month are partial. Saved Grammar/Text sentences and Sentence Practice attempts count as effort. Repeat work counts again; vocabulary reviews do not count.": "按北京时间计。周从周一开始；当前周和月为部分统计。Grammar/Text 中保存的句子和句子练习尝试计入练习量。重复练习计入；词汇复习不计入。",
  "just now": "刚刚",
  "{minutes}m ago": "{minutes} 分钟前",
  "{hours}h ago": "{hours} 小时前",
  "{days}d ago": "{days} 天前",
  "Date unavailable": "日期不可用",
  "· date only": "· 仅日期",
  "· Beijing time": "· 北京时间",
  "Time window": "时间范围",
  "Last {days} days": "最近 {days} 天",
  "Last 30 days": "最近 30 天",
  "All history": "全部历史",
  "Activity pages": "活动分页",

  // ── Coach ──
  "Understand your recurring mistakes.": "理解你的高频错误。",
  "Find patterns in your saved Grammar checks, explore possible causes, and learn the grammar principles behind the corrections.": "在已保存的 Grammar 检查中发现模式，探索可能的原因，学习修正背后的语法原理。",
  "Refresh patterns": "刷新分析",
  "Reading saved checks…": "正在读取已保存的检查记录…",
  "Based on {checks} saved Grammar check(s) {window}. A recurring pattern needs at least two distinct checks.": "基于 {checks} 条已保存的 Grammar 检查记录{window}。至少两条不同的检查记录才会识别为高频模式。",
  "in the last {days} days": "最近 {days} 天",
  "across all history": "（全部历史）",
  "{count} historical record(s) have no identified source and are excluded. Your original records are preserved.": "{count} 条历史记录来源未知，已排除。原始记录保持不变。",
  "Recurring mistakes": "高频错误模式",
  "No recurring pattern yet.": "还没有高频错误模式。",
  "Keep saving Grammar checks. A single correction does not establish a recurring difficulty.": "继续保存 Grammar 检查记录。一次修正不足以确定高频难点。",
  "Browse saved checks": "浏览已保存的检查",
  "This pattern is not available in the selected window.": "所选时间范围内没有这个错误模式。",
  "Choose a listed pattern or a longer time window.": "选择一个列表中的模式，或扩大时间范围。",
  "Generating an explanation from your saved checks…": "正在根据你的检查记录生成解释…",
  "Possible causes": "可能的原因",
  "These are hypotheses based on your records, not confirmed psychological causes.": "这些是基于你的记录提出的推测，不是确定的心理成因。",
  "Supporting checks:": "支持记录：",
  "Grammar principle": "语法原理",
  "Context and exceptions": "语境与例外",
  "From your saved checks": "来自你的检查记录",
  "Open saved check": "打开已保存的检查",
  "Original:": "原句：",
  "Correction:": "修正：",
  "No correction saved": "未保存修正",
  "Phase 1": "阶段 1",
  "Phase 2": "阶段 2",
  "Phase 3": "阶段 3",
  "Self-correct ({count} items)": "自我修正（{count} 题）",
  "New context ({count} items)": "新场景（{count} 题）",
  "Recall tomorrow ({count} intents)": "隔天回忆（{count} 个意图）",
  "This explanation uses a sample of the pattern's saved checks.": "本解释基于该模式已保存检查的抽样生成。",
  "Generated explanation": "AI 生成解释",
  "Reused from matching evidence": "复用已有解释",
  "Generated on request": "本次生成",
  "Saved feedback is unchanged.": "已保存的反馈未被修改。",
  "Regenerate explanation": "重新生成解释",
  "Mistake frequency and generated explanations do not establish durable mastery or overall English ability.": "错误频次和 AI 生成的解释不能证明持久掌握或整体英语水平。",
  "{checks} affected checks": "{checks} 条相关检查",
  "{observations} observations": "{observations} 次诊断",

  // ── Handbook shell (App.tsx) ──
  "Your saved Grammar checks.": "你已保存的语法检查。",
  "Review the original sentences, corrections and explanations saved in your Review Log. Refresh to load the latest checks.": "查看 Review Log 中保存的原句、修正与解释。刷新以加载最新记录。",
  "All checks": "全部检查",
  "With diagnosed mistakes": "有诊断的检查",
  "No diagnosed mistakes": "无诊断的检查",
  "All mistake types": "全部错误类型",
  "Search": "搜索",
  "Could not load Handbook": "无法读取 Handbook",
  "Previously loaded checks remain below.": "之前加载的检查仍在下方显示。",
  "Loading saved checks…": "正在读取已保存的检查…",
  "Some records have no usable date and cannot be placed in this time window.": "部分记录无有效日期，无法归入此时间范围。",
  "No diagnosed mistakes describes the saved feedback. It does not establish error-free writing or mastery.": "「无诊断」描述的是已保存的反馈，不能证明写作无错误或已掌握。",
  "Grammar check log": "语法检查记录",
  "Original": "原句",
  "Correction": "修正",
  "No diagnosed mistakes in saved feedback.": "已保存的反馈中无诊断记录。",
  "More natural alternative": "更自然的表达",
  "Saved explanations and notes": "已保存的解释与笔记",
  "No additional notes were saved.": "未保存额外笔记。",
  "No saved checks to show.": "没有可显示的已保存检查。",
  "Try another search, clear your filters or return to the first page.": "换个搜索词、清除筛选条件，或回到首页。",
  "Save a Grammar check to start your log, or choose a longer time window.": "保存一次语法检查即可开始记录，也可以选择更长的时间范围。",
  "Check a sentence": "写一句英语",
  "Writing · Grammar": "写作 · Grammar",
  "Historical check": "历史检查",
  "Mistake type": "错误类型",
  "Diagnoses": "诊断",
  "No checks on this page": "本页没有检查记录",
  "Hide explanations & notes": "折叠解释与笔记",
  "Show explanations & notes": "展开解释与笔记",
};

function initialLanguage(): LearnerLanguage {
  try {
    return localStorage.getItem(learnerLanguageKey) === "zh-CN" ? "zh-CN" : "en";
  } catch {
    return "en";
  }
}

const LanguageContext = createContext<{
  language: LearnerLanguage;
  setLanguage: (language: LearnerLanguage) => void;
}>({ language: "en", setLanguage: () => {} });

export function LearnerLanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState(initialLanguage);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === learnerLanguageKey || event.key === null) updateLanguage(initialLanguage());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function setLanguage(next: LearnerLanguage) {
    updateLanguage(next);
    try { localStorage.setItem(learnerLanguageKey, next); } catch { /* Still works for this session. */ }
  }
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export function useGuideCopy() {
  const { language, setLanguage } = useContext(LanguageContext);
  const t = (english: string, values: Record<string, string | number> = {}) => {
    const text = language === "zh-CN" ? beginnerCopy[english] ?? english : english;
    return text.replace(/\{(\w+)\}/g, (placeholder, key: string) => String(values[key] ?? placeholder));
  };
  return { language, setLanguage, t };
}

// Reserve the larger authored copy without duplicating text in the accessibility
// tree. Both versions wrap naturally at the available width, including zoom.
export function GuideText({ text }: { text: string }) {
  const { language, t } = useGuideCopy();
  const reserve = language === "en" ? beginnerCopy[text] ?? text : text;
  return <span className="guide-copy" data-reserve={reserve}><span>{t(text)}</span></span>;
}

export function LearnerLanguageSwitch({ id = "learner-language" }: { id?: string }) {
  const { language, setLanguage } = useGuideCopy();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const label = language === "zh-CN" ? "引导语言" : "Guide language";
  const options = [
    { value: "zh-CN" as const, title: "中文引导", description: "中文说明，保留英文标语与重点。" },
    { value: "en" as const, title: "English", description: "For learners comfortable reading English." },
  ];
  function close() {
    if (!menuRef.current) return;
    menuRef.current.open = false;
    menuRef.current.querySelector("summary")?.focus({ preventScroll: true });
  }
  return <details ref={menuRef} id={id} className="learning-menu learner-language-menu" name="workspace-navigation"
    onToggle={event => {
      if (!event.currentTarget.open) return;
      requestAnimationFrame(() => menuRef.current?.open && menuRef.current.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true }));
    }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}>
    <summary aria-label={`${label}: ${language === "zh-CN" ? "中文引导" : "English"}`} aria-haspopup="menu" aria-controls={`${id}-options`}
      onKeyDown={event => {
        if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
        event.preventDefault();
        menuRef.current!.open = true;
        menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
      }}>
      <Icon name="globe" className="language-menu-icon" />
      <span className="guide-copy" data-reserve={language === "zh-CN" ? "English" : "中文引导"} lang={language}><span>{language === "zh-CN" ? "中文引导" : "English"}</span></span>
      <Icon name="chevron" />
    </summary>
    <div className="language-options">
      <p className="language-options-label" id={`${id}-label`}>{label}</p>
      <div role="menu" id={`${id}-options`} aria-labelledby={`${id}-label`} onKeyDown={event => {
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
          buttons[next]?.focus();
        } else if (event.key === "Escape") {
          event.preventDefault(); event.stopPropagation(); close();
        } else if (event.key === "Tab") close();
      }}>
        {options.map(option => <button key={option.value} type="button" role="menuitemradio" tabIndex={-1} aria-checked={language === option.value} data-language={option.value}
          onClick={() => { setLanguage(option.value); close(); }}>
          <span className="language-option-copy" lang={option.value}><strong>{option.title}</strong><small>{option.description}</small></span>
          {language === option.value && <Icon name="check" />}
        </button>)}
      </div>
      <p className="language-options-hint">{language === "zh-CN" ? "Ask 的回答语言可在提问时单独选择。" : "Choose the answer language separately in Ask."}</p>
    </div>
  </details>;
}
