import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const apiPort = 19064;
const webPort = 15173;
const child = spawn(process.execPath, ["scripts/web-dev.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, IGT_DEV_API_PORT: String(apiPort), IGT_WEB_PORT: String(webPort) },
  stdio: ["ignore", "pipe", "pipe"]
});
let output = "";
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`web:dev did not start.\n${output}`)), 20000);
  const onChunk = (chunk) => {
    output += chunk.toString();
    if (output.includes(`http://127.0.0.1:${webPort}`)) {
      clearTimeout(timer);
      resolve();
    }
  };
  child.stdout.on("data", onChunk);
  child.stderr.on("data", onChunk);
  child.once("error", reject);
  child.once("exit", (code) => reject(new Error(`web:dev exited with ${code}.\n${output}`)));
});

try {
  await ready;
  const page = await fetch(`http://127.0.0.1:${webPort}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="root"/);
  const runtime = await fetch(`http://127.0.0.1:${webPort}/runtime`);
  assert.equal(runtime.status, 200);
  assert.equal((await runtime.json()).runtime, "local");
  console.log("web dev smoke ok");
} finally {
  if (process.platform === "win32") {
    spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/c", `taskkill /pid ${child.pid} /t /f`], { stdio: "ignore" });
  } else {
    child.kill();
  }
}
