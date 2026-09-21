import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { colors, paint, Spinner } from "../../cli/ui/index.mjs";
import { api } from "../../cli/api-client.mjs";
import { renderTextResponse } from "../../cli/commands/render.mjs";

const DRAFT_FILE = path.join(process.cwd(), ".igt-text-draft.txt");

function openEditor(filePath, ctx) {
  const editor = process.env.IGT_EDITOR || process.env.EDITOR || "notepad.exe";
  return new Promise((resolve, reject) => {
    if (ctx.rl) ctx.rl.pause();
    if (ctx.detachStdin) ctx.detachStdin();
    const child = spawn(editor, [filePath], { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (ctx.rl) ctx.rl.resume();
      if (ctx.attachStdin) ctx.attachStdin();
      if (code === 0) resolve();
      else reject(new Error(`Editor exited with code ${code}`));
    });
  });
}

async function collectTextFromEditor(ctx, initial = "") {
  if (initial && !fs.existsSync(DRAFT_FILE)) fs.writeFileSync(DRAFT_FILE, `${initial}\n`, "utf8");
  if (!fs.existsSync(DRAFT_FILE)) fs.writeFileSync(DRAFT_FILE, "", "utf8");
  process.stdout.write(paint(colors.gray, `Opening text editor: ${DRAFT_FILE}\n`));
  await openEditor(DRAFT_FILE, ctx);
  return fs.readFileSync(DRAFT_FILE, "utf8").trim();
}

export async function runTextModule(args, ctx) {
  let text;
  try {
    text = await collectTextFromEditor(ctx, args.join(" ").trim());
  } catch (error) {
    process.stdout.write(paint(colors.yellow, `Could not open editor: ${error.message}\n\n`));
    return;
  }
  if (!text) {
    process.stdout.write(paint(colors.yellow, "No text submitted.\n\n"));
    return;
  }

  const spinner = new Spinner("Analyzing complete text...");
  spinner.start();
  try {
    const response = await api.callTextAnalysis(text);
    spinner.stop(true);
    process.stdout.write(paint(colors.bold + colors.cyan, "\nText Analysis\n\n"));
    renderTextResponse(response.data);
    process.stdout.write("\n");
  } catch (error) {
    spinner.stop(true);
    process.stdout.write(paint(colors.red, `Text analysis failed: ${error.message}\n\n`));
  }
}
