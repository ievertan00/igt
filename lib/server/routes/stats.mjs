import { register } from "../router.mjs";
import { getStats, getTodayEffort } from "../../db/stats.mjs";

export function registerStatsRoutes() {
  register("GET", "/stats", async (req, res) => {
    const stats = await getStats();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
  });

  register("GET", "/today", async (req, res) => {
    const effort = await getTodayEffort();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(effort));
  });

}
