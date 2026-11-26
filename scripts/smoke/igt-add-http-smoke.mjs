import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const entry = {
  word: "consolidate", pos: "verb", phonetic: "/kənˈsɒlɪdeɪt/", meaning: "combine",
  zh: "巩固", synonyms: "merge", collocations: "consolidate notes",
  example: "We consolidated the notes.", example2: "", example3: "", note: "",
};
const requests = [];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  requests.push([req.method, url.pathname]);
  res.writeHead(200, { "Content-Type": "application/json" });
  if (url.pathname === "/word/lookup") {
    res.end(JSON.stringify({ data: entry, requested: "consolidate", lookup: "consolidate", translated: false, existing: false }));
  } else if (url.pathname === "/word/add") {
    res.end(JSON.stringify({ persistence: { saved: true, path: "Vocabulary.md", word: entry.word } }));
  } else {
    res.writeHead(404);
    res.end("{}");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
try {
  const { port } = server.address();
  const script = path.join(projectRoot, "lib", "cli", "commands", "entrypoints", "igt-add.mjs");
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, "consolidate"], {
      cwd: projectRoot,
      env: { ...process.env, IGT_API_BASE_URL: `http://127.0.0.1:${port}` },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    // Wait for the first prompt before answering so readline stays open.
    const answer = () => {
      if (/Memory hook\?/.test(stdout)) {
        child.stdin.write("\n"); // no memory hook
        setTimeout(() => { child.stdin.write("y\n"); child.stdin.end(); }, 60);
      } else {
        setTimeout(answer, 20);
      }
    };
    setTimeout(answer, 100);
  });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /consolidate/);
  assert.match(result.stdout, /Saved to/);
  assert.match(result.stdout, /SRS vocab card added/);
  assert.deepEqual(requests, [["GET", "/word/lookup"], ["POST", "/word/add"]]);
  console.log("igt-add HTTP smoke ok");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
