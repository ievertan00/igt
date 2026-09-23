import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { syncVocabularySrs } from "../../application/vocabulary.mjs";

export function registerVocabRoutes() {
  register("POST", "/vocab/seed", async (req, res) => {
    const config = configLoader.load();
    const result = await syncVocabularySrs({ config });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ seeded: result.inserted, updated: result.updated, skippedDuplicates: result.skippedDuplicates }));
  });
}
