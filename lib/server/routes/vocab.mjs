import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { syncVocabularySrs } from "../../application/vocabulary.mjs";
import { listSavedVocabulary, readVocabularyHistory } from "../../application/vocabulary-library.mjs";
import { getDb } from "../../db/connection.mjs";

export function registerVocabRoutes({ getConfig = () => configLoader.load(), getVocabularyDb = getDb } = {}) {
  register("GET", "/vocab/words", async (req, res) => {
    const params = new URL(req.url, "http://localhost").searchParams;
    let db = null;
    try { db = await getVocabularyDb({ readonly: true }); } catch { /* Saved content remains browsable without scheduling. */ }
    const result = listSavedVocabulary({ config: getConfig(), db, search: params.get("q") || "", sort: params.get("sort") || "az",
      schedule: params.get("schedule") || "all", status: params.get("status") || "all",
      limit: Number(params.get("limit") ?? 25), offset: Number(params.get("offset") ?? 0) });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });
  register("GET", "/vocab/history", async (req, res) => {
    const params = new URL(req.url, "http://localhost").searchParams;
    const result = readVocabularyHistory(await getVocabularyDb({ readonly: true }), {
      cardId: Number(params.get("card_id")), offset: Number(params.get("offset") ?? 0), limit: 20,
    });
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
