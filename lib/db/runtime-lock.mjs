// Single-writer guard: one live Local Runtime per database. Development and
// production share the same live database, so a second instance must refuse to
// start instead of silently creating two writers.
import fs from "node:fs";

function isAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === "EPERM"; }
}

export function runtimeLockPath(dbPath) {
  return `${dbPath}.runtime-lock`;
}

export function acquireRuntimeLock(dbPath, { mode, host, port }) {
  const lockPath = runtimeLockPath(dbPath);
  if (fs.existsSync(lockPath)) {
    let existing = null;
    try { existing = JSON.parse(fs.readFileSync(lockPath, "utf8")); }
    catch { /* corrupt lock is treated as stale */ }
    if (existing?.pid && existing.pid !== process.pid && isAlive(existing.pid)) {
      return { ok: false, existing, lockPath };
    }
  }
  fs.writeFileSync(lockPath, JSON.stringify({
    pid: process.pid, mode, host, port, startedAt: new Date().toISOString(),
  }, null, 2));
  return { ok: true, lockPath };
}

export function updateRuntimeLock(lockPath, updates) {
  try {
    const current = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (current.pid !== process.pid) return;
    fs.writeFileSync(lockPath, JSON.stringify({ ...current, ...updates }, null, 2));
  } catch { /* lock already removed */ }
}

export function releaseRuntimeLock(lockPath) {
  try {
    const current = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    if (current.pid === process.pid) fs.unlinkSync(lockPath);
  } catch { /* lock already removed */ }
}