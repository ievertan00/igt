import { colors, paint } from "../ui/index.mjs";
import { cols } from "./render.mjs";
import { getCommandMetadata } from "./registry.mjs";

const GROUPS = [
  {
    title: "Start here",
    hint: "输入句子 → 获得反馈 → 记住错误",
    commands: ["text", "translate", "word"],
  },
  {
    title: "Keep learning",
    hint: "把一次反馈变成下一步",
    commands: ["ask", "chat", "practice", "handbook", "coach", "stats"],
  },
  {
    title: "Settings",
    hint: "调整当前会话",
    commands: ["theme", "provider", "voice"],
  },
];

const DETAILS = {
  practice: "子模块：/practice word · /practice sentence · /practice choice",
};

function commandLabel(command) {
  const aliases = command.aliases.length
    ? ` · ${command.aliases.map((alias) => `/${alias}`).join(" ")}`
    : "";
  return `/${command.name}${aliases}`;
}

export function showHelp() {
  const width = Math.min(72, Math.max(36, cols() - 4));
  const metadata = new Map(getCommandMetadata().map((command) => [command.name, command]));
  const twoColumn = width >= 60;
  const commandWidth = Math.min(28, Math.max(20, ...GROUPS.flatMap((group) =>
    group.commands.map((name) => commandLabel(metadata.get(name)).length),
  )));

  process.stdout.write("\n");
  process.stdout.write(`  ${paint(colors.bold + colors.yellow, "IGT help")}  ${paint(colors.gray, "把英语表达变成可复用的学习记录")}\n`);
  process.stdout.write(`  ${paint(colors.gray, "输入英文句子即可检查；下面是最常用的工作流入口。")}\n\n`);

  for (const group of GROUPS) {
    process.stdout.write(`  ${paint(colors.bold + colors.brightCyan, group.title)}  ${paint(colors.gray, group.hint)}\n`);
    for (const name of group.commands) {
      const command = metadata.get(name);
      if (!command) continue;
      const label = commandLabel(command);
      if (twoColumn) {
        process.stdout.write(`    ${paint(colors.cyan, label.padEnd(commandWidth + 2))}${paint(colors.gray, command.summary)}\n`);
      } else {
        process.stdout.write(`    ${paint(colors.cyan, label)}\n`);
        process.stdout.write(`      ${paint(colors.gray, command.summary)}\n`);
      }
      if (DETAILS[name]) process.stdout.write(`      ${paint(colors.gray, DETAILS[name])}\n`);
    }
    process.stdout.write("\n");
  }

  process.stdout.write(`  ${paint(colors.yellow, "Try next")}\n`);
  process.stdout.write(`    ${paint(colors.gray, "/pw              词汇练习\n    /ps              句子练习\n    /pc              选择题练习\n    /word <word>     查询或添加词汇\n    /word review     复习到期词汇卡片")}\n\n`);
}
