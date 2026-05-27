import fs from "node:fs";
import path from "node:path";
import { colors, paint } from "../ui/index.mjs";
import { api } from "../api-client.mjs";

export async function runUndo(askLine, rl, n, targetPath, onAfterUndo) {
  if (!Number.isFinite(n) || n < 1) {
    process.stdout.write(paint(colors.yellow, "Usage: /undo [N]   (delete the last N inputs; default 1)\n\n"));
    return;
  }
  let preview;
  try { preview = await api.getInputsLast(n); }
  catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
    return;
  }
  if (!preview.rows || preview.rows.length === 0) {
    process.stdout.write(paint(colors.gray, "Nothing to undo.\n\n"));
    return;
  }
  process.stdout.write(`${paint(colors.yellow, `About to delete the last ${preview.rows.length} input(s):`)}\n`);
  for (const r of preview.rows) {
    const text = r.original_text.replace(/\s+/g, " ").slice(0, 80);
    process.stdout.write(`  ${paint(colors.gray, `#${r.id}`)}  ${paint(colors.white, text)}\n`);
  }
  const confirm = await askLine(rl, paint(colors.yellow, "Proceed? (y/N): "));
  if (!confirm || !/^y(es)?$/i.test(confirm.trim())) {
    process.stdout.write(paint(colors.gray, "Cancelled.\n\n"));
    return;
  }
  try {
    const r = await api.undo(n);
    process.stdout.write(`${paint(colors.green, "Deleted")}: ${r.deleted_inputs} input(s), ${r.deleted_diagnoses} diagnoses, ${r.deleted_cards} cards, ${r.deleted_advice} advice rows\n`);
    
    if (targetPath && fs.existsSync(targetPath)) {
      try {
        let content = fs.readFileSync(targetPath, "utf8");
        const parts = content.split(/(?:\r?\n)?(?=### \[)/);
        if (parts.length > 1) {
          const removedCount = Math.min(r.deleted_inputs, parts.length - 1);
          content = parts.slice(0, parts.length - removedCount).join("\n");
          if (!content.endsWith("\n") && content.length > 0) content += "\n";
          fs.writeFileSync(targetPath, content, "utf8");
          process.stdout.write(`${paint(colors.green, "Log Updated")}: removed ${removedCount} entries from ${path.basename(targetPath)}\n`);
        }
      } catch (err) {
        process.stdout.write(paint(colors.yellow, `Warning: Could not update log file: ${err.message}\n`));
      }
    }
    
    process.stdout.write("\n");
    if (onAfterUndo) await onAfterUndo();
  } catch (e) {
    process.stdout.write(paint(colors.red, `Error: ${e.message}\n\n`));
  }
}
