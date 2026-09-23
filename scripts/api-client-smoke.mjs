import assert from "node:assert/strict";
import http from "node:http";
import { createApiClient } from "../lib/cli/api-client.mjs";

const server = http.createServer((_req, res) => {
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
  console.log("api client contract smoke ok");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
