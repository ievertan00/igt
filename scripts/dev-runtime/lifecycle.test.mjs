import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { start, stop, status } from "./manager.mjs";
import { root, locations, readRecord, request, alive, sleep } from "./shared.mjs";
import { classifyLegacy } from "./legacy.mjs";

const workerEntry = path.join(import.meta.dirname, "fixtures", "worker.mjs");
const ownerEntry = path.join(import.meta.dirname, "fixtures", "owner.mjs");
let sequence = 0;
const name = () => `lifecycle-${process.pid}-${++sequence}`;
const config = instance => ({ instance, mode: "dev", apiPort: 0, webPort: 0, background: true });
async function until(predicate, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await predicate()) return; await sleep(100); }
  throw new Error(`Timed out: ${description}`);
}
function pids(instance) {
  const files = locations(instance), record = readRecord(files);
  const grandchild = Number(fs.readFileSync(files.output, "utf8").match(/grandchild=(\d+)/)?.[1]);
  return [record.pid, record.apiPid, grandchild].filter(Boolean);
}
async function released(port) {
  await until(() => new Promise(resolve => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  }), `port ${port} released`);
}
function clean(instance) {
  const files = locations(instance);
  // Only this test's uniquely named directory, after the guardian removed its lock.
  if (!fs.existsSync(files.lock)) fs.rmSync(files.directory, { recursive: true, force: true });
}

test("duplicate start reuses one instance; status authenticates; stop and restart release the same ports", { timeout: 60000 }, async () => {
  const instance = name();
  try {
    const first = await start(config(instance), { workerEntry });
    const tree = pids(instance);
    assert.equal(tree.length, 3);
    const duplicate = await start(config(instance), { workerEntry });
    assert.equal(duplicate.pid, first.pid);
    assert.equal(duplicate.webPort, first.webPort);
    await assert.rejects(request(locations(instance), { token: "incorrect" }), /Invalid instance token/);
    const inspector = spawn(process.execPath, [path.join(root, "scripts", "web-dev.mjs"), "status", "--instance", instance], { stdio: ["ignore", "pipe", "pipe"] });
    let inspected = ""; inspector.stdout.on("data", chunk => { inspected += chunk; });
    await new Promise((resolve, reject) => { inspector.on("error", reject); inspector.on("exit", resolve); });
    assert.equal(JSON.parse(inspected.trim()).pid, first.pid, "new terminal can discover the instance");
    await stop(instance);
    await until(() => tree.every(pid => !alive(pid)), "all three processes exited");
    await released(first.webPort);
    await released(first.apiPort);
    const second = await start({ ...config(instance), webPort: first.webPort, apiPort: first.apiPort }, { workerEntry });
    assert.notEqual(second.pid, first.pid);
    assert.equal(second.webPort, first.webPort);
  } finally { await stop(instance); clean(instance); }
});

test("HTTP proxy routes Vite requests to the controlled API", { timeout: 30000 }, async () => {
  const instance = name();
  try {
    const current = await start(config(instance), { workerEntry });
    const response = await fetch(`${current.url}/runtime`, { signal: AbortSignal.timeout(3000) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { runtime: "local", fixture: true });
  } finally { await stop(instance); clean(instance); }
});

test("concurrent starts cannot launch two copies of one instance", { timeout: 30000 }, async () => {
  const instance = name();
  try {
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => start(config(instance), { workerEntry })));
    const started = results.filter(result => result.status === "fulfilled");
    assert.equal(started.length, 1);
    assert.equal((await status(instance)).pid, started[0].value.pid);
    assert.equal(pids(instance).length, 3);
  } finally { await stop(instance); clean(instance); }
});

test("API startup timeout rolls back all children", { timeout: 30000 }, async () => {
  const instance = name();
  try {
    await assert.rejects(start(config(instance), { workerEntry: path.join(import.meta.dirname, "fixtures", "timeout-worker.mjs") }), /Startup failed/);
    const tree = pids(instance);
    await until(() => tree.every(pid => !alive(pid)), "timed-out startup descendants reclaimed");
  } finally { await stop(instance); clean(instance); }
});

test("port conflict fails without changing port or leaving the API behind", { timeout: 45000 }, async () => {
  const instance = name(), occupied = net.createServer();
  occupied.listen(0, "127.0.0.1");
  await new Promise(resolve => occupied.once("listening", resolve));
  try {
    await assert.rejects(start({ ...config(instance), webPort: occupied.address().port }, { workerEntry }), /Startup failed|already in use/);
    const tree = pids(instance);
    await until(() => tree.every(pid => !alive(pid)), "failed startup tree exited");
    assert.equal((await status(instance)).status, "stopped");
    assert.equal(occupied.listening, true, "the unrelated port owner was preserved");
  } finally { await stop(instance); await new Promise(resolve => occupied.close(resolve)); clean(instance); }
});

test("force-killing the foreground owner reclaims worker, API, grandchild, and ports", { timeout: 45000 }, async () => {
  const instance = name();
  const owner = spawn(process.execPath, [ownerEntry, instance], { cwd: root, stdio: "ignore" });
  try {
    await until(async () => (await status(instance)).status === "running", "foreground ready");
    const current = await status(instance), tree = pids(instance);
    owner.kill("SIGKILL");
    await until(() => tree.every(pid => !alive(pid)), "foreground tree reclaimed");
    // An abruptly terminated guardian may leave a stale lock; stop must recover it.
    await stop(instance);
    assert.equal(fs.existsSync(locations(instance).lock), false);
    await released(current.webPort);
    await released(current.apiPort);
  } finally { if (owner.exitCode === null && owner.signalCode === null) owner.kill(); await stop(instance); clean(instance); }
});

test("Windows shell closure and guardian termination cannot orphan descendants", { skip: process.platform !== "win32", timeout: 60000 }, async () => {
  for (const killGuardian of [false, true]) {
    const instance = name();
    const owner = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", path.join(import.meta.dirname, "fixtures", "terminal.ps1"),
      "-NodeExe", process.execPath, "-OwnerEntry", ownerEntry, "-Instance", instance], { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    owner.stdout.on("data", chunk => { output += chunk; });
    owner.stderr.on("data", chunk => { output += chunk; });
    try {
      await until(async () => {
        if (owner.exitCode !== null) throw new Error(`Terminal exited (${owner.exitCode}): ${output}`);
        return (await status(instance)).status === "running";
      }, "shell session ready");
      const tree = pids(instance), record = readRecord(locations(instance));
      if (killGuardian) process.kill(record.guardianPid, "SIGKILL"); else owner.kill("SIGKILL");
      await until(() => tree.every(pid => !alive(pid)), "job descendants reclaimed");
    } finally { if (owner.exitCode === null && owner.signalCode === null) owner.kill(); await stop(instance); clean(instance); }
  }
});

test("explicit background mode survives its launching terminal and stops from another process", { timeout: 30000 }, async () => {
  const instance = name();
  const owner = spawn(process.execPath, [ownerEntry, instance, "--background"], { cwd: root, stdio: "ignore" });
  try {
    await until(() => owner.exitCode !== null, "background launcher exits");
    assert.equal(owner.exitCode, 0);
    assert.equal((await status(instance)).status, "running");
    const tree = pids(instance);
    const stopper = spawn(process.execPath, [path.join(root, "scripts", "web-dev.mjs"), "stop", "--instance", instance], { cwd: root, stdio: "ignore" });
    await until(() => stopper.exitCode !== null, "cross-process stop");
    assert.equal(stopper.exitCode, 0);
    await until(() => tree.every(pid => !alive(pid)), "background tree exited");
  } finally { await stop(instance); clean(instance); }
});

test("legacy discovery requires this checkout's absolute descendant and excludes other Node apps", () => {
  const process = (pid, parent, command) => ({ ProcessId: pid, ParentProcessId: parent, Name: "node.exe", Created: "2026-01-01", CommandLine: command });
  const snapshot = { processes: [process(1, 0, "npm-cli.js run web:dev"), process(2, 1, "node scripts/web-dev.mjs"),
    process(3, 2, `node ${path.join(root, "apps", "local", "server.mjs")}`),
    process(4, 0, "node scripts/web-dev.mjs"), process(5, 4, "node C:\\another\\apps\\local\\server.mjs"),
    process(6, 0, "node C:\\other-app\\server.mjs")], listeners: [{ OwningProcess: 3, LocalPort: 5173 }, { OwningProcess: 5, LocalPort: 5174 }] };
  const instances = classifyLegacy(snapshot);
  assert.equal(instances.length, 1);
  assert.equal(instances[0].pid, 1);
  assert.deepEqual(instances[0].ports, [5173]);
});

test("preview CLI can start, restart on the same port, and stop from new terminals", { timeout: 45000 }, async () => {
  const instance = name();
  async function cli(...args) {
    const child = spawn(process.execPath, [path.join(root, "scripts", "web-dev.mjs"), ...args, "--instance", instance],
      { cwd: root, env: { ...process.env, IGT_PREVIEW_PORT: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    await until(() => child.exitCode !== null, "CLI completed");
    assert.equal(child.exitCode, 0, output);
  }
  try {
    await cli("start", "--mode", "preview", "--background");
    const first = await status(instance);
    assert.equal(first.status, "running");
    assert.equal(first.mode, "preview");
    assert.equal(first.apiPid, undefined, "preview never starts the learner API");
    await cli("restart", "--background");
    const second = await status(instance);
    assert.notEqual(second.pid, first.pid);
    assert.equal(second.webPort, first.webPort);
    await cli("stop");
    await released(first.webPort);
    assert.equal((await status(instance)).status, "stopped");
  } finally { await stop(instance); clean(instance); }
});
