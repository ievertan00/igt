import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { syncVocabularySrs } from "../../application/vocabulary.mjs";
import { listSavedVocabulary } from "../../application/vocabulary-library.mjs";

export function registerVocabRoutes({ getConfig = () => configLoader.load() } = {}) {
  register("GET", "/vocab/words", async (req, res) => {
    const params = new URL(req.url, "http://localhost").searchParams;
    const result = listSavedVocabulary({ config: getConfig(), search: params.get("q") || "", sort: params.get("sort") || "az",
      limit: Number(params.get("limit") ?? 25), offset: Number(params.get("offset") ?? 0) });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });
  register("POST", "/vocab/seed", async (req, res) => {
    const config = getConfig();
    const result = await syncVocabularySrs({ config });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ seeded: result.inserted, updated: result.updated, skippedDuplicates: result.skippedDuplicates }));
  });
}
