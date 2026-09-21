// Public command metadata is the single source for help output. Dispatch keeps
// the handlers and aliases, while this module defines the user-facing surface.
const COMMAND_METADATA = [
  { name: "word", aliases: ["w", "a"], summary: "查询、添加和复习词汇", visibility: "public" },
  { name: "practice", aliases: ["p"], summary: "统一练习入口：word、sentence、choice", visibility: "public" },
  { name: "text", aliases: [], summary: "编辑并分析完整篇章", visibility: "public" },
  { name: "ask", aliases: [], summary: "解释语言问题和用法", visibility: "public" },
  { name: "translate", aliases: ["tr"], summary: "翻译文本", visibility: "public" },
  { name: "chat", aliases: [], summary: "进行英语对话练习", visibility: "public" },
  { name: "coach", aliases: [], summary: "分析学习证据并生成下一步建议", visibility: "public" },
  { name: "handbook", aliases: ["h"], summary: "查看历史错误归纳", visibility: "public" },
  { name: "stats", aliases: ["st"], summary: "查看统计和近期状态", visibility: "public" },
  { name: "theme", aliases: [], summary: "切换终端主题", visibility: "public" },
  { name: "provider", aliases: [], summary: "查看或切换模型供应商", visibility: "public" },
  { name: "voice", aliases: [], summary: "开启或关闭语音", visibility: "public" },
  { name: "help", aliases: [], summary: "显示帮助", visibility: "public" },
  { name: "exit", aliases: ["quit", "q"], summary: "退出 IGT", visibility: "public" },
  { name: "sentence", aliases: ["sentent"], summary: "旧句子模块入口", visibility: "hidden" },
  { name: "modules", aliases: ["module", "m"], summary: "旧学习模块入口", visibility: "hidden" },
  { name: "pw", aliases: [], summary: "快捷入口：词汇练习", visibility: "hidden" },
  { name: "ps", aliases: [], summary: "快捷入口：句子练习", visibility: "hidden" },
  { name: "pc", aliases: [], summary: "快捷入口：选择题练习", visibility: "hidden" },
  { name: "drill", aliases: ["mc"], summary: "兼容入口：选择题练习", visibility: "hidden" },
  { name: "quiz", aliases: [], summary: "兼容入口：错误驱动练习", visibility: "hidden" },
  { name: "vocab-test", aliases: ["vtest"], summary: "兼容入口：词汇练习", visibility: "hidden" },
  { name: "today", aliases: [], summary: "兼容入口：今日学习", visibility: "hidden" },
  { name: "explain", aliases: ["e"], summary: "兼容入口：解释最近一次检查", visibility: "hidden" },
  { name: "voice", aliases: [], summary: "兼容入口：语音设置", visibility: "hidden" },
  { name: "theme", aliases: [], summary: "兼容入口：主题设置", visibility: "hidden" },
  { name: "llm", aliases: [], summary: "兼容入口：模型设置", visibility: "hidden" },
  { name: "gemini", aliases: [], summary: "兼容入口：切换模型供应商", visibility: "hidden" },
  { name: "qwen", aliases: [], summary: "兼容入口：切换模型供应商", visibility: "hidden" },
  { name: "deepseek", aliases: [], summary: "兼容入口：切换模型供应商", visibility: "hidden" },
  { name: "ollama", aliases: [], summary: "兼容入口：切换模型供应商", visibility: "hidden" },
  { name: "gemma", aliases: [], summary: "兼容入口：切换本地模型", visibility: "hidden" },
];

const byName = new Map(COMMAND_METADATA.map((command) => [command.name, command]));

export function getCommandMetadata() {
  return COMMAND_METADATA.filter((command) => command.visibility === "public");
}

export function assertRegisteredCommand(name) {
  if (!byName.has(name)) throw new Error(`Missing command metadata for /${name}`);
}
