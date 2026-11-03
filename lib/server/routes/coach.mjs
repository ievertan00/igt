import { register } from "../router.mjs";
import { generateCoachReport } from "../../application/coach-report.mjs";
import { saveCoachReport, listCoachReports, readCoachReport } from "../../application/coach-report-store.mjs";
import { getCoachPatterns, explainCoachPattern } from "../../application/grammar-coach.mjs";

export function registerCoachRoutes({ getLLMManager, loadData, now, reportDirectory } = {}) {
  register("GET", "/coach/reports", async (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(listCoachReports({ directory: reportDirectory })));
  });
  register("GET", /^\/coach\/reports\/[a-f0-9]{24}$/, async (req, res) => {
    const report = readCoachReport(req.url.split("/").pop(), { directory: reportDirectory });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(report));
  });
  register("POST", "/coach/report", async (req, res, { body }) => {
    req.setTimeout(0); res.setTimeout(0);
    const report = await generateCoachReport(body || {}, { loadData, now, getLLMManager });
    let result;
    try { result = saveCoachReport(report, { directory: reportDirectory }); }
    catch { result = { ...report, saveError: "The report was generated but could not be saved locally. Download Markdown to keep a copy." }; }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });
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
