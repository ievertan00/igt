import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify, stripVTControlCharacters } from "node:util";
import configLoader from "../../shared/config-loader.mjs";
import { cliModelTasks, readCliModels, selectedCliModel } from "../../server/llm/cli-models.mjs";
import { api, getApiBaseUrl } from "../api-client.mjs";

const runFile = promisify(execFile);
const labels = {
  default: "默认", grammar: "语法检查", translation: "翻译", word: "查词与添加词汇",
  practice: "练习评估", text: "篇章分析", ask: "问答",
  chat: "对话", coach: "Coach 解释",
};
const tasks = ["default", ...cliModelTasks];
const write = message => process.stdout.write(`${stripVTControlCharacters(message)}\n`);

async function openModelSettings() {
  const root = configLoader.projectRoot;
  if (!existsSync(path.join(root, "apps", "web", "dist", "index.html"))) {
    write("正在构建 Web 模型设置页…");
    await runFile(process.execPath, [
      path.join(root, "node_modules", "vite", "bin", "vite.js"),
      "build", "--config", path.join(root, "apps", "web", "vite.config.ts"),
    ], { cwd: root, windowsHide: true });
  }
  const url = new URL("/#settings?client=cli", getApiBaseUrl()).href;
  write(`模型设置页 ${url}`);
  const opener = process.platform === "win32" ? ["rundll32.exe", "url.dll,FileProtocolHandler"]
    : process.platform === "darwin" ? ["open"] : ["xdg-open"];
  await runFile(opener[0], [...opener.slice(1), url], { windowsHide: true });
  write("保存后回到 CLI，输入 /model 查看共享列表。");
}

export async function runModel(args, ctx) {
  const [command, ...rest] = args;
  const task = command?.toLowerCase();
  try {
    if (task === "add" && !rest.length) {
      await openModelSettings();
      return;
    }
    const state = readCliModels();
    const { profiles, selections } = state;
    if (!task || task === "list") {
      if (profiles.length) {
        write("共享模型");
        profiles.forEach(profile => write(`  ${profile.name} · ${profile.model}`));
        write("");
      }
      write("CLI 任务分配");
      for (const key of tasks) {
        const selected = selectedCliModel(state, key);
        const inherited = key !== "default" && !selections[key] ? "（默认）" : "";
        write(`  ${key.padEnd(12)} ${labels[key]} · ${selected.model}${inherited}`);
      }
      write("\n/model add  添加模型   /model <任务>  选择模型\n");
      return;
    }
    if (!tasks.includes(task) || rest.length > 1) {
      write("用法  /model [list | add | <任务> [模型名称 | reset]]");
      return;
    }
    let choice = rest[0];
    if (choice === undefined) {
      const resetLabel = task === "default" ? `使用现有配置（${state.legacy.model}）` : "使用 CLI 默认模型";
      write(`  0  ${resetLabel}`);
      profiles.forEach((profile, index) => write(`  ${index + 1}  ${profile.name} · ${profile.model}`));
      if (!profiles.length) write("  使用 /model add 添加模型。");
      choice = (await ctx.askLine(ctx.rl, `${labels[task]} · 选择编号，回车取消 ❯ `))?.trim();
      if (!choice) return;
      const position = /^\d+$/.test(choice) ? Number(choice) : -1;
      if (position < 0 || position > profiles.length) {
        write("请输入列表中的编号。");
        return;
      }
      choice = position ? profiles[position - 1].id : "reset";
    }
    const matching = profiles.filter(profile => profile.id === choice || profile.name === choice);
    if (choice !== "reset" && matching.length !== 1) {
      write(matching.length ? "模型名称重复，请用编号选择。" : "找不到这个模型。使用 /model <任务> 查看可选模型。");
      return;
    }
    await api.setCliModel(task, choice === "reset" ? "" : matching[0].id);
    ctx.refreshUI?.();
    const model = selectedCliModel(readCliModels(), task);
    write(`  ${labels[task]} · ${model.model}\n`);
  } catch (error) {
    write(`模型设置失败 · ${error.message}`);
  }
}
