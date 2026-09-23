import { register } from "../router.mjs";
import { getErrorFrequency, getExamples, getTotalStats } from "../../features/handbook/queries.mjs";

export function registerHandbookRoutes() {
  register("GET", (url) => url.startsWith("/handbook"), async (req, res) => {
    const params = new URL(req.url, "http://127.0.0.1").searchParams;
    const days = Math.min(3650, Math.max(0, Number(params.get("days") || 90)));
    const errorType = params.get("errorType") || "";
    const [frequencies, stats] = await Promise.all([getErrorFrequency(days), getTotalStats(days)]);
    const selected = errorType || frequencies[0]?.error_type || null;
    const examples = selected ? await getExamples(selected, 5) : [];
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ days, stats, frequencies, selected, examples }));
  });
}
