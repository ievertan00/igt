import { register } from "../router.mjs";
import { getHandbook, explainHandbookRule } from "../../application/handbook.mjs";
import configLoader from "../../shared/config-loader.mjs";
import { errorPayload } from "../../contracts/errors.mjs";
import { listHandbookReports, readHandbookReport, compareHandbookReports } from "../../application/handbook-reports.mjs";

export function registerHandbookRoutes({ getLLMManager, getReportConfig = () => configLoader.load() } = {}) {
  for (const action of ["list", "read", "compare", "export"]) {
    register("GET", action === "list" ? "/handbook/reports" : `/handbook/reports/${action}`, async (req, res) => {
      try {
        const params = new URL(req.url, "http://127.0.0.1").searchParams;
        const config = getReportConfig();
        let result;
        if (action === "list") result = listHandbookReports(config);
        if (action === "read") result = readHandbookReport(params.get("id"), config);
        if (action === "compare") result = compareHandbookReports(params.get("older"), params.get("newer"), config);
        if (action === "export") {
          const format = params.get("format") || "html";
          if (!["html", "markdown"].includes(format)) throw Object.assign(new Error("Choose HTML or Markdown export."), { status: 400 });
          const report = readHandbookReport(params.get("id"), config);
          const filename = report.id.replace(/\.md$/, format === "html" ? ".html" : ".md");
          res.writeHead(200, { "Content-Type": format === "html" ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "X-Content-Type-Options": "nosniff" });
          res.end(format === "html" ? report.html : report.markdown);
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        const expected = [400, 404, 413].includes(error.status);
        res.writeHead(expected ? error.status : 503, { "Content-Type": "application/json" });
        res.end(JSON.stringify(errorPayload("HANDBOOK_REPORT_ERROR", expected ? error.message : "Reports could not be loaded. Please try again.", !expected)));
      }
    });
  }
  register("GET", "/handbook", async (req, res) => {
    const params = new URL(req.url, "http://127.0.0.1").searchParams;
    const result = await getHandbook({ days: params.get("days") ?? 90, errorType: params.get("errorType") || "", search: params.get("search") || "", limit: params.get("limit") ?? 5, offset: params.get("offset") ?? 0 });
    res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify(result));
  });
  register("POST", "/handbook/rule", async (req, res, { body }) => {
    req.setTimeout(0);
    res.setTimeout(0);
    try {
      const result = await explainHandbookRule(body || {}, { getLLMManager, config: configLoader.load() });
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(result));
    } catch (error) {
      const expected = [400, 404, 409].includes(error.status);
      res.writeHead(expected ? error.status : 503, { "Content-Type": "application/json" });
      res.end(JSON.stringify(errorPayload(expected ? error.code : "HANDBOOK_RULE_UNAVAILABLE", expected ? error.message : "The explanation could not be generated. Please try again.", !expected)));
    }
  });
}
