import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { getLearningOverview, getEnrichedOverviewPracticeLog } from "../../application/learning-overview.mjs";
import { getGrowthOverview, getGrowthRecords, getGrowthRecord } from "../../application/learning-growth.mjs";

export function registerDashboardRoutes({ loadOverview = getLearningOverview, loadPracticeLog = getEnrichedOverviewPracticeLog,
  loadGrowth = getGrowthOverview, loadRecords = getGrowthRecords, loadRecord = getGrowthRecord } = {}) {
  for (const [route, handler] of [["/dashboard/growth", loadGrowth], ["/dashboard/records", loadRecords], ["/dashboard/record", loadRecord]]) {
    register("GET", route, async (req, res) => {
      const params = new URL(req.url, "http://127.0.0.1").searchParams;
      const data = await handler(Object.fromEntries(params), { config: configLoader.load() });
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(data));
    });
  }
  register("GET", "/dashboard/practice-log", async (req, res) => {
    const params = new URL(req.url, "http://127.0.0.1").searchParams;
    const data = await loadPracticeLog(configLoader.load(), { summary: params.get("summary") === "1" });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  });
  register("GET", "/dashboard", async (req, res) => {
    const params = new URL(req.url, "http://127.0.0.1").searchParams;
    const data = await loadOverview(Object.fromEntries(["days", "limit", "offset"].filter(key => params.has(key)).map(key => [key, params.get(key)])), { config: configLoader.load() });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  });
}
