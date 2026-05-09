import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

test("POST /switch-model endpoint", async (t) => {
  const PORT = 18966;
  const envBackup = fs.existsSync(path.join(projectRoot, ".env")) 
    ? fs.readFileSync(path.join(projectRoot, ".env"), "utf8") 
    : null;

  const server = spawn("node", ["lib/igt-http-server.mjs"], {
    env: { ...process.env, IGT_SERVER_PORT: PORT.toString() },
    cwd: projectRoot
  });

  // Helper to make requests
  const makeRequest = (path, payload) => {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const req = http.request({
        hostname: "127.0.0.1",
        port: PORT,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      }, (res) => {
        let body = "";
        res.on("data", (chunk) => body += chunk);
        res.on("end", () => resolve({ statusCode: res.statusCode, body: JSON.parse(body || "{}") }));
      });
      req.on("error", reject);
      req.write(data);
      req.end();
    });
  };

  try {
    // Wait for server to be ready
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Server timeout")), 10000);
      server.stderr.on("data", (data) => {
        if (data.toString().includes("Ready on")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    await t.test("should switch to gemini without model", async () => {
      const res = await makeRequest("/switch-model", { provider: "gemini" });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.provider, "gemini");
      assert.strictEqual(res.body.model, undefined);

      // Verify .env
      const env = fs.readFileSync(path.join(projectRoot, ".env"), "utf8");
      assert.ok(env.includes("IGT_LLM_PROVIDER=gemini"));
    });

    await t.test("should switch to ollama with model", async () => {
      const res = await makeRequest("/switch-model", { provider: "ollama", model: "gemma2" });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.provider, "ollama");
      assert.strictEqual(res.body.model, "gemma2");

      // Verify .env
      const env = fs.readFileSync(path.join(projectRoot, ".env"), "utf8");
      assert.ok(env.includes("IGT_LLM_PROVIDER=ollama"));
      assert.ok(env.includes("IGT_OLLAMA_MODEL=gemma2"));
    });

    await t.test("should return 400 if provider is missing", async () => {
      const res = await makeRequest("/switch-model", { model: "gemma2" });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error, "Missing 'provider' field");
    });

    await t.test("should return 400 if model is missing for ollama", async () => {
      const res = await makeRequest("/switch-model", { provider: "ollama" });
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error, "Missing 'model' field for ollama provider");
    });

  } finally {
    server.kill();
    // Restore .env
    if (envBackup) {
      fs.writeFileSync(path.join(projectRoot, ".env"), envBackup);
    }
  }
});
