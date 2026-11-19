import { stripVTControlCharacters } from "node:util";
import { colors, paint, visibleWidth, wrapCJK } from "../ui/index.mjs";
import { cols } from "./render.mjs";
import { getCommandMetadata } from "./registry.mjs";

const GROUPS = [
  [
    { title: "Start here", hint: "输入 → 反馈 → 记住", commands: ["text", "translate", "word"] },
    { title: "Practice & talk", hint: "把反馈变成下一步", commands: ["practice", "ask", "chat"] },
  ],
  [
    { title: "Review", hint: "从记录里找规律", commands: ["handbook", "coach", "stats"] },
    { title: "Session", hint: "按需调整", commands: ["theme", "model", "voice"] },
  ],
];

const FOOTER_EXAMPLES = "/practice 3 · /practice sentence 3 · /ps · /word review · /model add";

const USAGE = {
  word: [
    "/word <word or phrase>   查询或添加词条",
    "/word review [1-100]    先回忆，再用 Again / Hard / Good / Easy 评分",
    "/word --list            查看已保存词条",
  ],
  practice: [
    "/practice [1-10]             按题号练习",
    "/practice sentence [1-10]    指定句子模式",
    "/practice --difficulty easy|standard|challenge",
    "/practice --style casual|neutral|formal",
    "/practice --context <场景>   home-routines | restaurants-cafes |",
    "        supermarkets-shopping | cinema-entertainment |",
    "        friends-social | health-pharmacy | work-study |",
    "        commuting-transit | travel-accommodation |",
    "        appointments-services",
  ],
  text: [
    "/text                    打开编辑器，写完篇章后提交分析",
  ],
  translate: [
    "/translate <text>        翻译文本",
  ],
  ask: [
    "/ask <question>          针对语言问题提问",
  ],
  chat: [
    "/chat                    进入英语对话；输入 /exit 结束",
  ],
  coach: [
    "/coach                   分析已保存语法检查中的常见错误",
    "/coach --days 90          指定时间范围",
    '/coach --type "Articles"  按需解释某一类错误',
    "/coach --help            查看全部参数",
  ],
  handbook: [
    "/handbook                按时间浏览已保存的语法检查",
    "/handbook --days 90      指定时间范围",
    '/handbook --search "text"  搜索原文',
    '/handbook --type "Articles"  按错误类型筛选',
    "/handbook --diagnosis none  查看无诊断错误的检查",
    "/handbook --help         查看全部参数",
  ],
  stats: [
    "/stats                   查看学习活动概况",
    "/stats --days 30         指定时间范围",
    "/stats --limit 10        限制时间线条数",
    "/stats --offset 0        翻页",
    "/stats --help            查看全部参数",
  ],
  theme: [
    "/theme                   从列表中选择终端主题",
  ],
  model: [
    "/model add               添加模型",
    "/model default           设置 CLI 默认模型",
    "/model <任务>            设置任务所用模型",
    "/model <任务> reset      恢复任务默认模型",
  ],
  voice: [
    "/voice                   查看语音状态",
    "/voice on | off          开启或关闭语音",
  ],
  help: [
    "/help                    显示命令总览",
    "/help <命令>             查看该命令的用法与示例",
  ],
  exit: [
    "/exit                    退出 IGT（也可用 /quit 或 /q）",
  ],
};

function commandLabel(command) {
  const aliases = command.aliases.length
    ? ` · ${command.aliases.map((alias) => `/${alias}`).join(" ")}`
    : "";
  return `/${command.name}${aliases}`;
}

function padDisplay(text, width) {
  return text + " ".repeat(Math.max(0, width - visibleWidth(text)));
}

function truncateToWidth(text, max) {
  if (visibleWidth(text) <= max) return text;
  let result = "";
  for (const char of text) {
    if (visibleWidth(result + char) > max - 1) break;
    result += char;
  }
  return `${result}…`;
}

function printWrappedLine(line, width, indent = 4) {
  const plain = stripVTControlCharacters(line);
  const leading = plain.match(/^ */)[0].length;
  const base = " ".repeat(indent);
  if (visibleWidth(plain) + indent <= width) {
    process.stdout.write(`${base}${paint(colors.gray, line)}\n`);
    return;
  }
  const body = plain.slice(leading);
  const available = Math.max(12, width - indent - leading);
  const wrapped = wrapCJK(body, available).split("\n");
  wrapped.forEach((part, index) => {
    const prefix = index === 0
      ? `${base}${" ".repeat(leading)}`
      : `${base}${" ".repeat(leading || 2)}`;
    process.stdout.write(`${prefix}${paint(colors.gray, part)}\n`);
  });
}

function printExampleLine(width) {
  const prefix = `  ${paint(colors.yellow, "例")}  `;
  const prefixWidth = visibleWidth(stripVTControlCharacters(prefix));
  const available = Math.max(12, width - prefixWidth - 2);
  const lines = [];
  let current = "";
  for (const part of FOOTER_EXAMPLES.split(" · ")) {
    const candidate = current ? `${current} · ${part}` : part;
    if (visibleWidth(candidate) <= available || !current) current = candidate;
    else {
      lines.push(current);
      current = part;
    }
  }
  if (current) lines.push(current);
  lines.forEach((line, index) => {
    const indent = index === 0 ? prefix : " ".repeat(prefixWidth + 2);
    process.stdout.write(`${indent}${paint(colors.gray, line)}\n`);
  });
}

function showOverview(metadata, width) {
  const byName = new Map(metadata.map((command) => [command.name, command]));
  const twoColumn = width >= 70;
  const labelWidth = Math.min(
    18,
    Math.max(...metadata.map((command) => visibleWidth(commandLabel(command)))),
  );
  const columnWidth = twoColumn ? Math.floor((width - 4) / 2) : width;
  const shortWidth = Math.max(8, columnWidth - labelWidth - 2);

  const headerFor = (group) =>
    `${paint(colors.bold + colors.brightCyan, group.title)}  ${paint(colors.gray, group.hint)}`;
  const commandFor = (name) => {
    const command = byName.get(name);
    if (!command) return "";
    const label = padDisplay(paint(colors.cyan, commandLabel(command)), labelWidth);
    const short = truncateToWidth(command.short || command.summary, shortWidth);
    return `${label}  ${paint(colors.gray, short)}`;
  };

  process.stdout.write(
    `  ${paint(colors.bold + colors.yellow, "IGT help")}  ${paint(colors.gray, "把英语表达变成可复用的学习记录")}\n`,
  );
  process.stdout.write(
    `  ${paint(colors.gray, "输入英文句子检查语法 · 中文自动翻译 · /help <命令> 看完整参数")}\n\n`,
  );

  if (twoColumn) {
    for (const pair of GROUPS) {
      process.stdout.write(`  ${padDisplay(headerFor(pair[0]), columnWidth)}  ${headerFor(pair[1])}\n`);
      const rowCount = Math.max(...pair.map((group) => group.commands.length));
      for (let index = 0; index < rowCount; index++) {
        const left = pair[0].commands[index] ? commandFor(pair[0].commands[index]) : "";
        const right = pair[1].commands[index] ? commandFor(pair[1].commands[index]) : "";
        process.stdout.write(`  ${padDisplay(left, columnWidth)}  ${right}\n`);
      }
      process.stdout.write("\n");
    }
  } else {
    for (const group of GROUPS.flat()) {
      process.stdout.write(`  ${headerFor(group)}\n`);
      for (const name of group.commands) process.stdout.write(`    ${commandFor(name)}\n`);
      process.stdout.write("\n");
    }
  }

  printExampleLine(width);
  process.stdout.write(`  ${paint(colors.gray, "/help <命令> 看完整参数 · /exit 退出")}\n\n`);
}

function showTopic(topic, metadata, width) {
  const key = String(topic).replace(/^\/+/, "").toLowerCase();
  const command = metadata.find(
    (item) => item.name === key || item.aliases.includes(key),
  );
  if (!command) {
    process.stdout.write(
      `  ${paint(colors.yellow, `No help for /${key}. Showing the command overview.`)}\n\n`,
    );
    showOverview(metadata, width);
    return;
  }

  process.stdout.write(
    `  ${paint(colors.bold + colors.yellow, `/${command.name}`)}  ${paint(colors.gray, command.summary)}\n`,
  );
  if (command.aliases.length) {
    process.stdout.write(
      `  ${paint(colors.gray, "别名")}  ${paint(colors.cyan, command.aliases.map((alias) => `/${alias}`).join(" · "))}\n`,
    );
  }
  process.stdout.write("\n");
  for (const line of USAGE[command.name] || [command.summary]) printWrappedLine(line, width);
  process.stdout.write(
    `\n  ${paint(colors.yellow, "/help")} 返回总览 · ${paint(colors.yellow, "/exit")} 退出\n\n`,
  );
}

export function showHelp(topic) {
  const metadata = getCommandMetadata();
  const width = Math.min(76, Math.max(40, cols() - 4));
  if (topic) showTopic(topic, metadata, width);
  else showOverview(metadata, width);
}
