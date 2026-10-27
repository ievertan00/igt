import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "vite.cmd" : "vite");
const requestedApiPort = process.env.IGT_DEV_API_PORT || "18964";
let server;
let frontend;
let stopping = false;

function stopTree(processHandle) {
  if (!processHandle || processHandle.killed) return;
  if (process.platform === "win32") {
    spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/c", `taskkill /pid ${processHandle.pid} /t /f`], { stdio: "ignore" });
  } else {
    processHandle.kill();
  }
}

function stop() {
  if (stopping) return;
  stopping = true;
  stopTree(server);
  stopTree(frontend);
}

function startApi(port) {
  const child = spawn(process.execPath, [path.join(root, "apps", "local", "server.mjs"),
    ...(process.argv.includes("--skip-vocabulary-sync") ? ["--skip-vocabulary-sync"] : [])], {
    cwd: root,
    env: { ...process.env, IGT_SERVER_HOST: "127.0.0.1", IGT_SERVER_PORT: port },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ child, output, ...result });
    };
    const onData = (stream, chunk) => {
      const text = chunk.toString();
      output += text;
      stream.write(text);
      const ready = output.match(/\[IGT-SERVER\] Ready on http:\/\/127\.0\.0\.1:(\d+)/);
      if (ready) finish({ port: ready[1] });
    };

    child.stdout.on("data", (chunk) => onData(process.stdout, chunk));
    child.stderr.on("data", (chunk) => onData(process.stderr, chunk));
    child.once("error", (error) => finish({ error }));
    child.once("exit", (code) => finish({ code }));
  });
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("exit", stop);

let api = await startApi(requestedApiPort);
if (!api.port && requestedApiPort !== "0" && /EADDRINUSE/.test(api.output)) {
  console.error(`[IGT-DEV] API port ${requestedApiPort} is occupied; retrying on an available port.`);
  api = await startApi("0");
}

if (!api.port) {
  if (api.error) console.error(`[IGT-DEV] Could not start API: ${api.error.message}`);
  process.exitCode = api.code ?? 1;
} else {
  server = api.child;
  server.once("exit", (code) => {
    if (stopping) return;
    stop();
    process.exitCode = code ?? 1;
  });

  const env = { ...process.env, IGT_DEV_API_PORT: api.port };
  frontend = process.platform === "win32"
    ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/c", `${vite} --config apps/web/vite.config.ts`], { cwd: root, env, stdio: "inherit" })
    : spawn(vite, ["--config", "apps/web/vite.config.ts"], { cwd: root, env, stdio: "inherit" });

  frontend.once("error", (error) => {
    console.error(`[IGT-DEV] Could not start Vite: ${error.message}`);
    stop();
    process.exitCode = 1;
  });
  frontend.once("exit", (code) => {
    if (stopping) return;
    stop();
    process.exitCode = code ?? 1;
  });
}
