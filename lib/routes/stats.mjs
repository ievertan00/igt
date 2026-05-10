import { register } from "../server/router.mjs";
import { getStats } from "../db/stats.mjs";
import { getSessionSummary, getCurrentSessionId } from "../db/inputs.mjs";

export function registerStatsRoutes() {
  register("GET", "/stats", async (req, res) => {
    const stats = await getStats();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(stats));
  });

  register("GET", "/session/summary", async (req, res) => {
    const sid = getCurrentSessionId();
    if (!sid) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ no_session: true }));
      return;
    }
    const summary = await getSessionSummary(sid);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(summary));
  });
}
