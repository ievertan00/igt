// Production supervisor for the Local Web Runtime: dated logs, crash restart
// with backoff, and log retention. Run from the release directory:
//   node scripts/deploy/service-launcher.mjs --logs DIR
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const projectRoot = path.join(import.meta.dirname, "..", "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const logDir = path.resolve(arg("logs", path.join(projectRoot, "logs")));
fs.mkdirSync(logDir, { recursive: true });

function logStream() {
  const day = new Date().toISOString().slice(0, 10);
  return fs.createWriteStream(path.join(logDir, `runtime-${day}.log`), { flags: "a" });
}

function pruneLogs() {
  const cutoff = Date.now() - 14 * 24 * 3600 * 1000;
  for (const name of fs.readdirSync(logDir)) {
    if (!/^runtime-\d{4}-\d{2}-\d{2}\.log$/.test(name)) continue;
    const full = path.join(logDir, name);
    if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full, { force: true });
  }
}

let stopping = false;
let child = null;
let stream = logStream();
let currentDay = new Date().toISOString().slice(0, 10);
let failures = 0;

function note(message) {
  stream.write(`[launcher ${new Date().toISOString()}] ${message}\n`);
}

function start() {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== currentDay) {
    stream.end();
    stream = logStream();
    currentDay = day;
    pruneLogs();
  }
  child = spawn(process.execPath, ["--env-file=.env", "apps/local/server.mjs"], {
    cwd: projectRoot,
    env: { ...process.env, IGT_RUNTIME_MODE: "production" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true,
  });
  const startedAt = Date.now();
  child.stdout.pipe(stream, { end: false });
  child.stderr.pipe(stream, { end: false });
  note(`runtime started pid=${child.pid}`);
  child.once("exit", (code, signal) => {
    child = null;
    if (stopping) {
      note(`runtime exited code=${code} signal=${signal}; launcher stopping`);
      stream.end();
      process.exit(0);
    }
    if (Date.now() - startedAt > 60_000) failures = 0;
    failures += 1;
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(failures, 5));
    note(`runtime exited code=${code} signal=${signal}; restart in ${delay}ms (failure ${failures})`);
    setTimeout(start, delay);
  });
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  note("shutdown requested");
  if (!child) { stream.end(); process.exit(0); }
  const target = child;
  const timer = setTimeout(() => {
    // taskkill /T covers the TTS sidecar and any other descendants on Windows.
    if (process.platform === "win32") spawnSync("taskkill.exe", ["/PID", String(target.pid), "/T", "/F"], { windowsHide: true });
    else target.kill("SIGKILL");
  }, 6000);
  timer.unref();
  if (target.connected) target.send({ type: "igt:shutdown" }, () => {});
  else target.kill("SIGTERM");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
pruneLogs();
start();