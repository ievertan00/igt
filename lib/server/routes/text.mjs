import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import path from "node:path";
import configLoader from "../../shared/config-loader.mjs";
import { appendReviewLog } from "../../db/review-log.mjs";
import {
  TEXT_ANALYSIS_PROMPT,
  TEXT_ANALYSIS_RESPONSE_SCHEMA,
} from "../../features/text/analysis.mjs";

export function parseTextAnalysis(output) {
  let cleaned = String(output || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|channel>thought[\s\S]*?<channel\|>/gi, "")
    .trim();
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    correction: typeof parsed.correction === "string" ? parsed.correction : "",
    refine: typeof parsed.refine === "string" ? parsed.refine : "",
    diagnoses: Array.isArray(parsed.diagnoses) ? parsed.diagnoses : [],
    remember: Array.isArray(parsed.remember)
      ? parsed.remember.filter((item) => typeof item === "string" && item.trim())
      : [],
  };
}

export function registerTextRoutes({ getLLMManager, getConfig = () => configLoader.load() }) {
  register("POST", "/text", async (req, res, { body }) => {
    const startTime = performance.now();
    req.setTimeout(0);
    res.setTimeout(0);
    const userInput = (body?.text || body?.input || "").trim();
    if (!userInput) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing 'text' or 'input' field" }));
      return;
    }

    let llm;
    try {
      llm = await getLLMManager();
      const llmStart = performance.now();
      const output = await llm.generateWithFallback(
        userInput,
        TEXT_ANALYSIS_PROMPT,
        { taskType: "text", jsonSchema: TEXT_ANALYSIS_RESPONSE_SCHEMA },
      );
      const data = parseTextAnalysis(output);
      const config = getConfig();
      const reviewPath = config.ReviewPath || "00_Review_logs.md";
      const resolvedReviewPath = path.isAbsolute(reviewPath)
        ? reviewPath
        : path.join(process.cwd(), reviewPath);
      let persistence;
      try {
        persistence = appendReviewLog(resolvedReviewPath, {
          originalText: userInput,
          data,
        });
        persistence.saved = true;
      } catch (saveError) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: `Review log not saved: ${saveError.message}`,
          code: "REVIEW_LOG_NOT_SAVED",
          data,
        }));
        return;
      }
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify({
        data,
        persistence,
        perf: { llm_ms: performance.now() - llmStart, total_ms: performance.now() - startTime },
      }));
    } catch (error) {
      const provider = llm ? llm.getCurrentProviderName() : "unknown";
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `${provider.toUpperCase()} Error: ${error.message}` }));
    }
  });
}
