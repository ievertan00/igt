import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ping } from "./api-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const SERVER_PORT = 18964;
const SERVER_HOST = "127.0.0.1";

let serverProcess = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function killPort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync("netstat -ano", { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts[1] && parts[1].endsWith(`:${port}`) && /^\d+$/.test(parts.at(-1))) {
          pids.add(parts.at(-1));
        }
      }
      for (const pid of pids) {
        try { execSync(`taskkill /PID ${pid} /F`, { stdio: "pipe" }); } catch {}
      }
    } else {
      execSync(`lsof -ti :${port} | xargs kill -9`, { shell: true, stdio: "pipe" });
    }
  } catch {}
}

export async function startServer(onReady) {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
  killPort(SERVER_PORT);
  await sleep(200);

  let serverStderr = "";
  serverProcess = spawn(
    process.execPath,
    [path.join(projectRoot, "lib", "server", "igt-http-server.mjs")],
    {
      env: { ...process.env, IGT_SERVER_PORT: String(SERVER_PORT), IGT_SERVER_HOST: SERVER_HOST },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  serverProcess.stderr.on("data", (d) => { serverStderr += d.toString(); });
  serverProcess.on("error", (e) => process.stderr.write(`Server spawn error: ${e.message}\n`));

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    await sleep(100);
    if (serverProcess.exitCode !== null) {
      process.stderr.write("Error: Server failed to start\n");
      if (serverStderr) process.stderr.write(serverStderr);
      return false;
    }
    if (await ping()) {
      if (onReady) onReady({ port: SERVER_PORT });
      return true;
    }
  }
  process.stderr.write("Error: Server startup timeout\n");
  if (serverStderr) process.stderr.write(serverStderr);
  return false;
}

export function stopServer() {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
}
