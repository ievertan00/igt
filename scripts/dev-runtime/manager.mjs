import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { legacy } from "./legacy.mjs";
import { root, locations, readRecord, writeRecord, request, alive, sleep } from "./shared.mjs";

function options(args) {
  const values = new Map(), flags = new Set();
  let action = "start", hasAction = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (["--mode", "--instance"].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      values.set(arg, value);
    } else if (["--background", "--skip-vocabulary-sync", "--legacy"].includes(arg)) flags.add(arg);
    else if (!hasAction && ["start", "status", "stop", "restart"].includes(arg)) { action = arg; hasAction = true; }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const mode = values.get("--mode") || "dev";
  if (!["dev", "preview"].includes(mode)) throw new Error("--mode must be dev or preview");
  return { action, mode, instance: values.get("--instance") || mode, background: flags.has("--background"), skipSync: flags.has("--skip-vocabulary-sync") };
}

export async function status(instance) {
  const files = locations(instance), record = readRecord(files);
  if (!record) return { instance, status: "stopped" };
  try { return await request(files, record); } catch {
    return { instance, status: fs.existsSync(files.lock) && (alive(record.guardianPid) || alive(record.pid)) ? "unresponsive" : "stopped",
      previousUrl: record.url, log: files.error, guardianLog: files.guardian };
  }
}

export async function stop(instance) {
  const files = locations(instance), record = readRecord(files);
  if (!record) return;
  try { await request(files, record, "stop"); } catch {
    if (fs.existsSync(files.lock) && (alive(record.guardianPid) || alive(record.pid))) {
      if (process.platform !== "win32") throw new Error(`${instance} has an unresponsive owner. Inspect ${files.error}; no unverified PID was killed.`);
      // Guardian validates this token, including during startup or a frozen worker.
      fs.writeFileSync(files.stop, JSON.stringify({ token: record.token }));
    }
  }
  const deadline = Date.now() + 12000;
  while (fs.existsSync(files.lock)) {
    if (!alive(record.guardianPid) && !alive(record.pid)) { fs.rmSync(files.lock, { force: true }); break; }
    if (Date.now() > deadline) throw new Error(`${instance} did not finish stopping; see ${files.error}`);
    await sleep(100);
  }
}

function tail(files) {
  const positions = new Map();
  return () => {
    for (const [file, output] of [[files.output, process.stdout], [files.error, process.stderr]]) {
      try {
        const length = fs.statSync(file).size, position = positions.get(file) || 0;
        if (length > position) {
          const fd = fs.openSync(file, "r"), buffer = Buffer.alloc(length - position);
          try { fs.readSync(fd, buffer, 0, buffer.length, position); output.write(buffer); } finally { fs.closeSync(fd); }
        }
        positions.set(file, length);
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
  };
}

export async function start(config, { workerEntry = path.join(root, "scripts", "dev-runtime", "worker.mjs") } = {}) {
  const files = locations(config.instance);
  fs.mkdirSync(files.directory, { recursive: true });
  const existing = await status(config.instance);
  if (existing.status === "running" || existing.status === "starting") {
    console.log(`[IGT-DEV] ${config.instance} already ${existing.status}: ${existing.url || "starting"}`);
    return existing;
  }
  if (existing.status === "unresponsive") throw new Error(`${config.instance} is still owned by a live process; inspect ${files.error}`);
  // Exclusive file creation prevents concurrent starts. Never reclaim a live owner.
  try { fs.writeFileSync(files.lock, "", { flag: "wx" }); } catch (error) {
    if (error.code !== "EEXIST") throw error;
    // Do not race another starter by unlinking its lock, even if a previous
    // record looks stale. Explicit stop/restart handles crash recovery first.
    throw new Error(`${config.instance} is starting, stopping, or has a stale lock. Inspect npm run dev:status; recover with npm run dev:restart -- --instance ${config.instance}`);
  }
  const record = { ...config, root, token: randomUUID(), startedAt: Date.now(), pid: process.pid, status: "starting" };
  fs.rmSync(files.stop, { force: true });
  writeRecord(files, record);
  for (const file of [files.output, files.error, files.guardian]) fs.writeFileSync(file, "");
  let child;
  try {
    if (process.platform === "win32") {
      child = spawn(process.execPath, [path.join(root, "scripts", "dev-runtime", "windows-guardian.mjs"),
        config.instance, workerEntry, String(process.pid), String(config.background)],
      { cwd: root, env: process.env, detached: config.background, windowsHide: true, stdio: "ignore" });
    } else {
      const out = fs.openSync(files.output, "a"), err = fs.openSync(files.error, "a");
      try { child = spawn(process.execPath, [workerEntry, config.instance], { cwd: root, detached: config.background,
        stdio: ["ignore", out, err, ...(config.background ? [] : ["ipc"])] }); }
      finally { fs.closeSync(out); fs.closeSync(err); }
    }
    let spawnError;
    child.on("error", error => { spawnError = error; });
    record.guardianPid = child.pid;
    writeRecord(files, record);
    const print = tail(files);
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      if (!config.background) print();
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Startup failed (${child.exitCode ?? child.signalCode}). ${fs.readFileSync(files.error, "utf8")} ${fs.readFileSync(files.guardian, "utf8")}`);
      const current = await status(config.instance);
      if (current.status === "running") {
        console.log(`[IGT-DEV] ${config.instance}: ${current.url}${config.background ? " (background)" : " — Ctrl+C to stop"}`);
        console.log(`[IGT-DEV] Logs: ${files.directory}`);
        if (config.background) { child.stderr?.destroy(); child.unref(); return current; }
        let interrupted = false;
        const interrupt = () => { interrupted = true; void stop(config.instance).catch(error => console.error(error.message)); };
        for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, interrupt);
        try {
          while (child.exitCode === null && child.signalCode === null) { print(); await sleep(200); }
          print();
          if (!interrupted) process.exitCode = child.exitCode || (child.signalCode ? 1 : 0);
        } finally { for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.off(signal, interrupt); }
        return current;
      }
      await sleep(150);
    }
    throw new Error(`Startup timed out. See ${files.error}`);
  } catch (error) {
    // The owner remains alive until the guardian observes the stop request.
    await stop(config.instance).catch(() => {});
    if (!child || child.exitCode !== null || child.signalCode !== null) fs.rmSync(files.lock, { force: true });
    throw error;
  }
}

export async function main(args = process.argv.slice(2)) {
  dotenv.config({ path: path.join(root, ".env"), quiet: true });
  if (args.includes("--help")) {
    console.log("Usage: npm run web:dev -- [start|status|stop|restart] [--instance NAME] [--mode dev|preview] [--background] [--skip-vocabulary-sync]\nstatus lists all registered instances; stop/restart default to dev. Ports never fall back automatically.\nWindows legacy services: npm run dev:status -- --legacy; npm run dev:stop -- --legacy (all verified old instances in this checkout).");
    return;
  }
  const config = options(args);
  if (args.includes("--legacy")) {
    if (!["status", "stop"].includes(config.action)) throw new Error("--legacy is only valid with status or stop");
    await legacy(config.action);
    return;
  }
  if (config.action === "status") {
    const base = path.join(root, ".cache", "dev-instances");
    const names = args.includes("--instance") ? [config.instance] : fs.existsSync(base) ? fs.readdirSync(base, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name) : [];
    for (const name of names) console.log(JSON.stringify(await status(name)));
    if (!names.length) console.log("[IGT-DEV] No managed instances. Older unmanaged services may still occupy ports; this command does not kill them.");
    return;
  }
  if (["stop", "restart"].includes(config.action)) {
    const previous = readRecord(locations(config.instance));
    await stop(config.instance);
    console.log(`[IGT-DEV] ${config.instance} stopped`);
    if (config.action === "stop") return;
    if (previous) Object.assign(config, { mode: previous.mode, webPort: previous.webPort, apiPort: previous.apiPort, skipSync: previous.skipSync });
  }
  const port = (value, fallback) => {
    const number = Number(value ?? fallback);
    if (!Number.isInteger(number) || number < 0 || number > 65535) throw new Error("Port must be an integer between 0 and 65535");
    return number;
  };
  config.apiPort ??= port(process.env.IGT_DEV_API_PORT, 18964);
  config.webPort ??= port(config.mode === "preview" ? process.env.IGT_PREVIEW_PORT : process.env.IGT_WEB_PORT, config.mode === "preview" ? 4173 : 5173);
  await start(config);
}
