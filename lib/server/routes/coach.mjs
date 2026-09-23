import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { analyzeCoach } from "../../application/coach.mjs";

export function registerCoachRoutes() {
  async function analyze(req, res) {
    const params = new URL(req.url, "http://127.0.0.1").searchParams;
    const windowDays = Number(params.get("windowDays") || 30);
    const config = configLoader.load();
    const diagnosis = await analyzeCoach({
      windowDays: Number.isFinite(windowDays) ? windowDays : 30,
      config,
      force: req.method === "POST",
    });
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(diagnosis));
  }
  register("GET", (url) => url.startsWith("/coach"), analyze);
  register("POST", "/coach/analyze", analyze);
}
