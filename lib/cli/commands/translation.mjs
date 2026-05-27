import { colors, paint, Spinner } from "../ui/index.mjs";
import { api } from "../api-client.mjs";
import { isMainlyChinese } from "../validate-input.mjs";

export async function runTrans(text, ctx) {
  const direction = isMainlyChinese(text) ? "zh2en" : "en2zh";
  const spinner = new Spinner("Translating...");
  spinner.start();
  const controller = new AbortController();
  let cancelled = false;

  ctx.setSigint(() => {
    cancelled = true;
    controller.abort();
    ctx.setSigint(() => {});
    spinner.stop(true);
    process.stdout.write("\n" + paint(colors.gray, "Cancelled.\n"));
  });

  let resp = null;
  try {
    resp = await api.callTranslation(text, direction, controller.signal);
  } catch (err) {
    if (!cancelled) {
      const msg = err.message || "";
      if (
        err.status === 429 ||
        /429|quota|rate.?limit|resource.*exhaust|too many request/i.test(msg)
      ) {
        process.stdout.write(
          paint(colors.yellow, "\n  API limit reached. Wait a moment and try again.\n"),
        );
      } else if (err.name !== "AbortError" && err.code !== "ABORT_ERR") {
        process.stdout.write(paint(colors.red, `\n  Error: ${msg}\n`));
      }
    }
  } finally {
    ctx.setSigint(() => {});
    spinner.stop(true);
  }
  if (cancelled || !resp) return null;

  const srcLabel = direction === "zh2en" ? "中文" : "English";
  const tgtLabel = direction === "zh2en" ? "English" : "中文";
  process.stdout.write(`${paint(colors.bold + colors.gray, srcLabel)}\n`);
  process.stdout.write(`${paint(colors.gray, text)}\n`);
  process.stdout.write("\n");
  process.stdout.write(`${paint(colors.bold + colors.magenta, tgtLabel)}\n`);
  process.stdout.write(`${paint(colors.magenta, resp.data.translation)}\n`);
  if (resp.data.notes) {
    process.stdout.write(`${paint(colors.gray, resp.data.notes)}\n`);
  }
  process.stdout.write("\n");

  if (resp.perf) {
    const { llm_ms, total_ms } = resp.perf;
    process.stdout.write(
      `${paint(colors.gray, `${Math.round(llm_ms)}ms llm  ·  ${Math.round(total_ms)}ms total`)}\n`,
    );
  }

  return resp.data;
}
