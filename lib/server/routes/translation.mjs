import { performance } from "node:perf_hooks";
import { register } from "../router.mjs";

const TRANSLATION_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    translation: { type: "string" },
    notes: { type: "string" },
  },
  required: ["translation"],
};

const PROMPTS = {
  zh2en:
    "You are a professional translator. Translate the Chinese text into natural, fluent English. " +
    "Return ONLY a JSON object with two keys: " +
    "'translation' (the translated string) and " +
    "'notes' (a brief observation about idioms, register, or nuance if relevant — empty string otherwise).",
  en2zh:
    "You are a professional translator. Translate the English text into natural, fluent Simplified Chinese. " +
    "Return ONLY a JSON object with two keys: " +
    "'translation' (the translated string) and " +
    "'notes' (a brief observation about idioms, register, or nuance if relevant — empty string otherwise).",
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
    const direction = body?.direction;
    if (!PROMPTS[direction]) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing or invalid 'direction' field (expected 'zh2en' or 'en2zh')" }));
      return;
    }
    let llm;

    const systemPrompt = PROMPTS[direction];

    try {
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
      let parsedNotes = "";
      try {
        const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/g, "").trim());
        parsedTranslation = parsed.translation || text;
        parsedNotes = parsed.notes || "";
      } catch {
        parsedTranslation = text;
      }

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(
        JSON.stringify({
          data: { translation: parsedTranslation, notes: parsedNotes, direction },
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
