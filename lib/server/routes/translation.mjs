import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..", "..");

const TRANSLATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    translation: { type: "string" },
  },
  required: ["translation"],
};

export function registerTranslationRoutes({ getLLMManager }) {
  register("POST", "/translation", async (req, res, { body }) => {
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

    const systemPrompt =
      "You are a professional translator. Translate the Chinese text into natural, fluent English. Return ONLY a JSON object with a single key 'translation' containing the translated string.";

    try {
      const config = configLoader.load();
      llm = await getLLMManager();
      const options = { taskType: "translation" };
      const provider = llm.getCurrentProviderName();
      if (provider === "gemini") options.responseSchema = TRANSLATION_RESPONSE_SCHEMA;
      else options.responseFormat = { type: "json_object" };

      const llmStart = performance.now();
      const text = await llm.generateWithFallback(userInput, systemPrompt, options);
      const llm_ms = performance.now() - llmStart;
      const total_ms = performance.now() - startTime;

      let parsedTranslation = "";
      try {
        const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/g, "").trim());
        parsedTranslation = parsed.translation || text;
      } catch {
        parsedTranslation = text;
      }

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(
        JSON.stringify({
          data: { translation: parsedTranslation },
          perf: { llm_ms, total_ms },
        }),
      );
    } catch (error) {
      console.error(
        "[IGT-SERVER] Error occurred while processing translation request:",
        error.message,
      );
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
      return;
    }
  });
}
