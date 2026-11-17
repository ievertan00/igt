import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export function locations(instance) {
  if (!/^[a-zA-Z0-9_-]{1,48}$/.test(instance)) throw new Error("Invalid instance name (use letters, digits, - or _).");
  const directory = path.join(root, ".cache", "dev-instances", instance);
  const key = createHash("sha256").update(`${root.toLowerCase()}:${instance}`).digest("hex").slice(0, 24);
  return { directory, record: path.join(directory, "instance.json"), lock: path.join(directory, "lock"),
    stop: path.join(directory, "stop.json"),
    output: path.join(directory, "stdout.log"), error: path.join(directory, "stderr.log"),
    guardian: path.join(directory, "guardian.log"),
    socket: process.platform === "win32" ? `\\\\.\\pipe\\igt-dev-${key}` : path.join(directory, "control.sock") };
}
export function readRecord(files) {
  try { return JSON.parse(fs.readFileSync(files.record, "utf8")); } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
export function writeRecord(files, record) {
  const temporary = `${files.record}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(record, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, files.record);
}
export function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}
export function request(files, record, action = "status") {
  return new Promise((resolve, reject) => {
    const socket = net.connect(files.socket);
    let response = "";
    socket.setTimeout(1500, () => socket.destroy(new Error("Instance control timed out")));
    socket.on("connect", () => socket.end(`${JSON.stringify({ token: record.token, action })}\n`));
    socket.on("data", chunk => { response += chunk; });
    socket.on("error", reject);
    socket.on("end", () => {
      try {
        const result = JSON.parse(response);
        if (result.error) throw new Error(result.error);
        resolve(result);
      } catch (error) { reject(error); }
    });
  });
}
