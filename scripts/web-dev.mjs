import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
const server = spawn(process.execPath, [path.join(root, "lib", "server", "index.mjs")], { cwd: root, env: { ...process.env, IGT_SERVER_HOST: "127.0.0.1", IGT_SERVER_PORT: "18964" }, stdio: "inherit" });
const frontend = process.platform === "win32"
  ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `"${vite}" --config apps/web/vite.config.ts`], { cwd: root, stdio: "inherit" })
  : spawn(vite, ["--config", "apps/web/vite.config.ts"], { cwd: root, stdio: "inherit" });
function stop() { if (!server.killed) server.kill(); if (!frontend.killed) frontend.kill(); }
process.on("SIGINT", stop); process.on("SIGTERM", stop); process.on("exit", stop);
frontend.on("exit", (code) => { if (code) { stop(); process.exitCode = code; } });
server.on("exit", (code) => { if (code) { stop(); process.exitCode = code; } });
