import { register } from "../router.mjs";
import { getCoachPatterns, explainCoachPattern } from "../../application/grammar-coach.mjs";

export function registerCoachRoutes({ getLLMManager, loadData, now } = {}) {
  register("GET", "/coach", async (req, res) => {
    const params = new URL(req.url, "http://127.0.0.1").searchParams;
    const diagnosis = getCoachPatterns({ days: params.get("days") ?? params.get("windowDays") ?? 90 }, { loadData, now });
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(diagnosis));
  });
  register("POST", "/coach/explain", async (req, res, { body }) => {
    req.setTimeout(0); res.setTimeout(0);
    const result = await explainCoachPattern(body || {}, { loadData, now, getLLMManager });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });
}
