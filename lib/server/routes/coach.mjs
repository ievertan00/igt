import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { buildLearningDiagnosis } from "../../features/learning-diagnosis/index.mjs";

export function registerCoachRoutes() {
  async function analyze(req, res) {
    const params = new URL(req.url, "http://127.0.0.1").searchParams;
    const windowDays = Number(params.get("windowDays") || 30);
    const config = configLoader.load();
    const diagnosis = await buildLearningDiagnosis({
      days: Number.isFinite(windowDays) ? windowDays : 30,
      goal: "general English",
      resourceMode: "local",
      vaultDir: config.VaultDir || null,
    });
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(diagnosis));
  }
  register("GET", (url) => url.startsWith("/coach"), analyze);
  register("POST", "/coach/analyze", analyze);
}
