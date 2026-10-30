import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { getLearningOverview } from "../../application/learning-overview.mjs";

export function registerDashboardRoutes({ loadOverview = getLearningOverview } = {}) {
  register("GET", "/dashboard", async (req, res) => {
    const params = new URL(req.url, "http://127.0.0.1").searchParams;
    const data = await loadOverview(Object.fromEntries(["days", "limit", "offset"].filter(key => params.has(key)).map(key => [key, params.get(key)])), { config: configLoader.load() });
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(data));
  });
}
