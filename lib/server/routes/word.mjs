import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { lookupWord, addWord } from "../../application/word.mjs";
import { errorPayload } from "../../contracts/errors.mjs";

function json(res, status, value) {
  if (typeof value?.error === "string") value = { ...value, ...errorPayload(status >= 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST", value.error, status >= 500) };
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(value));
}

export function registerWordRoutes({ getLLMManager }) {
  register("GET", (url) => url.startsWith("/word/lookup"), async (req, res) => {
    const query = new URL(req.url, "http://127.0.0.1").searchParams.get("q")?.trim();
    if (!query) return json(res, 400, { error: "Missing 'q' query parameter" });
    try {
      const result = await lookupWord({ query, getLLMManager });
      json(res, 200, { data: { ...result.entry, requested: result.requested }, persistence: { saved: false } });
    } catch (error) {
      json(res, 502, { error: error.message });
    }
  });

  register("POST", "/word/add", async (req, res, { body }) => {
    try {
      const result = await addWord({ entry: body?.entry, config: configLoader.load() });
      json(res, 200, result);
    } catch (error) {
      json(res, 400, { error: error.message });
    }
  });
}
