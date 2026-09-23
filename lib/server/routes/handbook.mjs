import { register } from "../router.mjs";
import { getHandbook } from "../../application/handbook.mjs";

export function registerHandbookRoutes() {
  register("GET", (url) => url.startsWith("/handbook"), async (req, res) => {
    const params = new URL(req.url, "http://127.0.0.1").searchParams;
    const result = await getHandbook({ days: Number(params.get("days") || 90), errorType: params.get("errorType") || "" });
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(result));
  });
}
