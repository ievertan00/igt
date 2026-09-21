import { colors, paint } from "../ui/index.mjs";
import { cols } from "./render.mjs";
import { getCommandMetadata } from "./registry.mjs";

export function showHelp() {
  const sep = "─".repeat(Math.min(66, Math.max(30, cols() - 3)));
  process.stdout.write("\n  " + paint(colors.yellow, "Public commands") + "\n  " + paint(colors.gray, sep) + "\n");
  for (const command of getCommandMetadata()) {
    const aliases = command.aliases.length ? ` (${command.aliases.map((alias) => `/${alias}`).join(", ")})` : "";
    process.stdout.write(`  ${paint(colors.cyan, `/${command.name}${aliases}`)}\n`);
    process.stdout.write(`    ${paint(colors.gray, command.summary)}\n`);
  }
  process.stdout.write("\n  " + paint(colors.gray, "直接输入英文句子即可进行语法检查；/word、/practice、/text、/ask 是主要工作流入口。") + "\n\n");
}
