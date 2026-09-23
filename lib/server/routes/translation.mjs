import { register } from "../router.mjs";
import { TRANSLATION_PROMPTS, translate } from "../../application/translation.mjs";
import { errorPayload } from "../../contracts/errors.mjs";

export function registerTranslationRoutes({ getLLMManager }) {
  register("POST", "/translation", async (req, res, { body }) => {
    req.setTimeout(0);
    res.setTimeout(0);
    const userInput = (body?.text || body?.input || "").trim();
    if (!userInput) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(errorPayload("INVALID_REQUEST", "Missing 'text' or 'input' field")));
      return;
    }
    const direction = body?.direction;
    if (!TRANSLATION_PROMPTS[direction]) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(errorPayload("INVALID_REQUEST", "Missing or invalid 'direction' field (expected 'zh2en' or 'en2zh')")));
      return;
    }
    let llm;

    try {
      const result = await translate({ text: userInput, direction, getLLMManager: async () => {
        llm = await getLLMManager();
        return llm;
      }});

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(
        JSON.stringify({
          ...result.response,
        }),
      );
    } catch (error) {
      console.error(
        "[IGT-SERVER] Error occurred while processing translation request:",
        error.message,
      );
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify(errorPayload("INTERNAL_ERROR", "Internal server error", true)));
      return;
    }
  });
}
