import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pingUrl, setApiBaseUrl } from "./api-client.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");
const SERVER_PORT = Number.parseInt(process.env.IGT_SERVER_PORT || "0", 10);
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
  if (SERVER_PORT > 0) killPort(SERVER_PORT);
  await sleep(200);

  let serverStderr = "";
  let readyPort = null;
  serverProcess = spawn(
    process.execPath,
    [path.join(projectRoot, "lib", "server", "index.mjs")],
    {
      env: { ...process.env, IGT_SERVER_PORT: String(SERVER_PORT), IGT_SERVER_HOST: SERVER_HOST },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  serverProcess.stderr.on("data", (d) => {
    const chunk = d.toString();
    serverStderr += chunk;
    const match = chunk.match(/Ready on http:\/\/[^:]+:(\d+)/);
    if (match) readyPort = Number(match[1]);
  });
  serverProcess.on("error", (e) => process.stderr.write(`Server spawn error: ${e.message}\n`));

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    await sleep(100);
    if (serverProcess.exitCode !== null) {
      process.stderr.write("Error: Server failed to start\n");
      if (serverStderr) process.stderr.write(serverStderr);
      return false;
    }
    if (readyPort && await pingUrl(`http://${SERVER_HOST}:${readyPort}`)) {
      setApiBaseUrl(`http://${SERVER_HOST}:${readyPort}`);
      if (onReady) onReady({ port: readyPort });
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

let ttsSidecarProcess = null;

// Optional TTS sidecar. If config.Tts.Sidecar (env IGT_TTS_SIDECAR) names a script,
// igt spawns it at startup so the local TTS adapter comes up automatically — e.g. the
// CosyVoice shim that translates OpenAI /v1/audio/speech to CosyVoice's API. Opt-in
// and provider-agnostic: unset → no-op (Kokoro and other native OpenAI-compatible
// endpoints need nothing here). Spawned with --env-file so the sidecar reads its own
// config (COSY_* etc.) from .env, which igt parses but does not load into process.env.
// Fire-and-forget: the sidecar handles its own errors (including port-in-use).
export function startTtsSidecar(sidecar) {
  if (!sidecar) return;
  const sidecarPath = path.isAbsolute(sidecar) ? sidecar : path.join(projectRoot, sidecar);
  if (!fs.existsSync(sidecarPath)) return;
  const args = [];
  const envFile = path.join(projectRoot, ".env");
  if (fs.existsSync(envFile)) args.push(`--env-file=${envFile}`);
  args.push(sidecarPath);
  try {
    ttsSidecarProcess = spawn(process.execPath, args, {
      env: { ...process.env },
      stdio: ["ignore", "ignore", "pipe"],
    });
    ttsSidecarProcess.stderr?.on("data", () => {});
    ttsSidecarProcess.on("error", () => {});
  } catch {
    ttsSidecarProcess = null;
  }
}

export function stopTtsSidecar() {
  if (ttsSidecarProcess && !ttsSidecarProcess.killed) ttsSidecarProcess.kill();
}
