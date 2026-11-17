import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { acquireRuntimeLock, releaseRuntimeLock, updateRuntimeLock, runtimeLockPath } from "../lib/db/runtime-lock.mjs";

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "igt-runtime-lock-"));
  return { dir, db: path.join(dir, "test.db") };
}

test("a live runtime holding the database blocks a second instance", async () => {
  const { dir, db } = tempDb();
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], { stdio: "ignore" });
  try {
    fs.writeFileSync(runtimeLockPath(db), JSON.stringify({ pid: child.pid, mode: "production", host: "0.0.0.0", port: 8787, startedAt: "now" }));
    const result = acquireRuntimeLock(db, { mode: "dev", host: "127.0.0.1", port: 18964 });
    assert.equal(result.ok, false);
    assert.equal(result.existing.pid, child.pid);
    assert.equal(result.existing.mode, "production");
  } finally {
    child.kill();
    await new Promise(resolve => child.once("exit", resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a stale lock from a dead process is reclaimed", async () => {
  const { dir, db } = tempDb();
  const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], { stdio: "ignore" });
  fs.writeFileSync(runtimeLockPath(db), JSON.stringify({ pid: child.pid, mode: "dev", port: 18964 }));
  child.kill();
  await new Promise(resolve => child.once("exit", resolve));
  try {
    const result = acquireRuntimeLock(db, { mode: "production", host: "0.0.0.0", port: 8787 });
    assert.equal(result.ok, true);
    assert.equal(JSON.parse(fs.readFileSync(result.lockPath, "utf8")).pid, process.pid);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("corrupt locks are stale, updates and releases only touch the owner's lock", () => {
  const { dir, db } = tempDb();
  try {
    fs.writeFileSync(runtimeLockPath(db), "{not json");
    const acquired = acquireRuntimeLock(db, { mode: "standalone", host: "127.0.0.1", port: 0 });
    assert.equal(acquired.ok, true);

    updateRuntimeLock(acquired.lockPath, { port: 8787 });
    assert.equal(JSON.parse(fs.readFileSync(acquired.lockPath, "utf8")).port, 8787);

    fs.writeFileSync(acquired.lockPath, JSON.stringify({ pid: -1, mode: "other" }));
    updateRuntimeLock(acquired.lockPath, { port: 9999 });
    releaseRuntimeLock(acquired.lockPath);
    assert.equal(JSON.parse(fs.readFileSync(acquired.lockPath, "utf8")).pid, -1);

    fs.writeFileSync(acquired.lockPath, JSON.stringify({ pid: process.pid, mode: "standalone" }));
    releaseRuntimeLock(acquired.lockPath);
    assert.equal(fs.existsSync(acquired.lockPath), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});