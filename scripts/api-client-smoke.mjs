import assert from "node:assert/strict";
import http from "node:http";
import { createApiClient } from "../lib/cli/api-client.mjs";

const requests = [];
const server = http.createServer((req, res) => {
  if (req.method === "POST") {
    requests.push([req.url, req.headers["x-igt-cli-task"]]);
    req.resume();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
    return;
  }
  res.writeHead(503, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { code: "RUNTIME_UNAVAILABLE", message: "Runtime unavailable", retryable: true } }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const address = server.address();
  const api = createApiClient({ baseUrl: `http://127.0.0.1:${address.port}` });
  await assert.rejects(api.getRuntime(), (error) => {
    assert.equal(error.code, "RUNTIME_UNAVAILABLE");
    assert.equal(error.retryable, true);
    assert.equal(error.message, "Runtime unavailable");
    return true;
  });
  const cli = createApiClient({ baseUrl: `http://127.0.0.1:${address.port}`, cliModels: true });
  await cli.callGrammar("Grammar request");
  await cli.callTranslation("Translation request", "en-zh");
  await cli.callTextAnalysis("Text request");
  await cli.evaluatePractice({}, "Practice response");
  await cli.callAsk("Ask request");
  await cli.saveAsk();
  await cli.callChat("Chat request");
  await cli.explainCoach("Articles");
  await cli.setCliModel("grammar", "fixture-id");
  await api.callGrammar("Request without CLI model selection");
  assert.deepEqual(requests, [
    ["/grammar", "grammar"], ["/translation", "translation"], ["/text", "text"],
    ["/practice/evaluate", "practice"], ["/ask", "ask"], ["/ask/save", "ask"],
    ["/chat", "chat"], ["/coach/explain", "coach"], ["/settings/llm/cli", undefined],
    ["/grammar", undefined],
  ]);
  console.log("api client contract smoke ok");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
