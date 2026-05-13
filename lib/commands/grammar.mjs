import { colors, paint, Spinner } from "../ui.mjs";
import { api } from "../api-client.mjs";
import { renderResponse, logResult, cols } from "./render.mjs";

export async function runGrammarCheck(text, targetPath, ctx) {
  const spinner = new Spinner("Thinking");
  spinner.start();
  const controller = new AbortController();
  let cancelled = false;

  ctx.onSigint(() => {
    cancelled = true;
    controller.abort();
    ctx.onSigint(() => {});
    spinner.stop(true);
    process.stdout.write("\n" + paint(colors.gray, "Cancelled.\n"));
  });

  let resp = null;
  try {
    resp = await api.callGrammar(text, controller.signal);
  } catch (err) {
    if (!cancelled) {
      const msg = err.message || "";
      if (err.status === 429 || /429|quota|rate.?limit|resource.*exhaust|too many request/i.test(msg)) {
        process.stdout.write(paint(colors.yellow, "\n  API limit reached. Wait a moment and try again.\n"));
      } else if (err.name !== "AbortError" && err.code !== "ABORT_ERR") {
        process.stdout.write(paint(colors.red, `\n  Error: ${msg}\n`));
      }
    }
  } finally {
    ctx.onSigint(() => {});
    spinner.stop(true);
  }
  if (cancelled || !resp) return null;

  const sep = "─".repeat(Math.min(44, Math.max(20, cols() - 3)));
  process.stdout.write("\n");
  process.stdout.write(`${paint(colors.gray, "Input  ")}${text}\n`);
  process.stdout.write(`${paint(colors.gray, sep)}\n`);
  renderResponse(resp.data);
  process.stdout.write("\n");
  if (resp.perf) {
    const { llm_ms, total_ms } = resp.perf;
    process.stdout.write(`${paint(colors.gray, `${Math.round(llm_ms)}ms llm  ·  ${Math.round(total_ms)}ms total`)}\n`);
  }
  logResult(targetPath, text, resp.data);
  ctx.onResult({ inputs: 1, diagnoses: Array.isArray(resp.data.diagnoses) ? resp.data.diagnoses.length : 0 });
  return resp.data;
}
