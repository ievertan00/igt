import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApiClient, pingUrl, setApiBaseUrl } from "./api-client.mjs";
import configLoader from "../shared/config-loader.mjs";
import { runtimeLockPath } from "../db/runtime-lock.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..");
const SERVER_PORT = Number.parseInt(process.env.IGT_SERVER_PORT || "0", 10);
const SERVER_HOST = "127.0.0.1";

let serverProcess = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function findRunningRuntime() {
  const config = configLoader.load();
  const dbPath = path.resolve(projectRoot, config.DbPath || "igt_data.db");
  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(runtimeLockPath(dbPath), "utf8"));
    if (!Number.isInteger(lock.pid) || lock.pid < 1 || !Number.isInteger(lock.port) || lock.port < 1 || lock.port > 65535) return null;
    process.kill(lock.pid, 0);
  } catch { return null; }
  const host = lock.host === "::" || lock.host === "::1" ? "[::1]" : SERVER_HOST;
  const url = `http://${host}:${lock.port}`;
  if (!await pingUrl(url)) return null;
  const runtime = await createApiClient({ baseUrl: url }).getRuntime(AbortSignal.timeout(1000));
  if (!runtime.capabilities?.cliModelSelection) {
    throw new Error("The running Local Runtime does not support CLI model settings. Restart it before launching IGT.");
  }
  return { url, port: lock.port };
}

export async function startServer(onReady) {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
  const running = await findRunningRuntime();
  if (running) {
    setApiBaseUrl(running.url);
    onReady?.({ port: running.port, reused: true });
    return true;
  }

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
