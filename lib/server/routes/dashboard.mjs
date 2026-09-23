import { fileURLToPath } from "node:url";
import path from "node:path";
import { register } from "../router.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { getDashboard } from "../../application/dashboard.mjs";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export function registerDashboardRoutes() {
  register("GET", "/dashboard", async (req, res) => {
    const data = await getDashboard({ config: configLoader.load(), projectRoot });
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(data));
  });
}
