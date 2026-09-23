import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
const apiPort = process.env.IGT_DEV_API_PORT || "18964";
const server = spawn(process.execPath, [path.join(root, "apps", "local", "server.mjs")], { cwd: root, env: { ...process.env, IGT_SERVER_HOST: "127.0.0.1", IGT_SERVER_PORT: apiPort }, stdio: "inherit" });
const frontend = process.platform === "win32"
  ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/c", `${vite} --config apps/web/vite.config.ts`], { cwd: root, stdio: "inherit" })
  : spawn(vite, ["--config", "apps/web/vite.config.ts"], { cwd: root, stdio: "inherit" });
function stopTree(processHandle) {
  if (!processHandle || processHandle.killed) return;
  if (process.platform === "win32") {
    spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/c", `taskkill /pid ${processHandle.pid} /t /f`], { stdio: "ignore" });
  } else {
    processHandle.kill();
  }
}
function stop() { stopTree(server); stopTree(frontend); }
process.on("SIGINT", stop); process.on("SIGTERM", stop); process.on("exit", stop);
frontend.on("exit", (code) => { if (code) { stop(); process.exitCode = code; } });
server.on("exit", (code) => { if (code) { stop(); process.exitCode = code; } });
