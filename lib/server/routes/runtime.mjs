import { register } from "../router.mjs";

export function registerRuntimeRoutes() {
  register("GET", "/runtime", async (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      runtime: "local",
      userId: "local-user",
      storage: { database: "sqlite", assets: "markdown" },
      capabilities: {
        grammar: true,
        coach: true,
        vocabularyReview: true,
        ask: true,
        export: false,
      },
    }));
  });
}
