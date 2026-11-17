import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fork } from "node:child_process";
import { once } from "node:events";
import { createServer, preview } from "vite";
import { root, locations, readRecord, writeRecord, sleep } from "./shared.mjs";

// Exported so lifecycle tests can use a controlled API without opening learner data.
export async function runWorker(instance, { apiEntry = path.join(root, "apps", "local", "server.mjs"), startupTimeoutMs = 30000 } = {}) {
  const files = locations(instance);
  const record = readRecord(files);
  let api, web, stopping, timer, stopWatcher;
  const sockets = new Set();
  const control = net.createServer(socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.setTimeout(1500, () => socket.destroy());
    let input = "";
    socket.on("data", chunk => {
      input += chunk;
      if (input.length > 2048) { socket.destroy(); return; }
      if (!input.includes("\n")) return;
      try {
        const message = JSON.parse(input);
        if (message.token !== record.token) throw new Error("Invalid instance token");
        if (!["status", "stop"].includes(message.action)) throw new Error("Unknown action");
        // Do not expose the control token in status output.
        const { token: _token, ...status } = record;
        socket.end(JSON.stringify({ ...status, started: new Date(record.startedAt).toISOString(), logs: files.directory }));
        if (message.action === "stop") void stop(0);
      } catch (error) { socket.end(JSON.stringify({ error: error.message })); }
    });
  });

  function stop(code = 0) {
    if (stopping) return stopping;
    record.status = "stopping";
    writeRecord(files, record);
    // A bounded graceful shutdown also works on Windows; kill() is only fallback.
    stopping = (async () => {
      clearTimeout(timer);
      clearInterval(stopWatcher);
      const forced = setTimeout(() => process.exit(code || 1), 6000);
      forced.unref();
      if (api?.connected) api.send({ type: "igt:shutdown" }, () => {});
      await web?.close();
      if (api && api.exitCode === null && api.signalCode === null) {
        await Promise.race([once(api, "exit"), sleep(3500)]).catch(() => {});
        if (api.exitCode === null && api.signalCode === null) {
          api.kill();
          await Promise.race([once(api, "exit"), sleep(500)]).catch(() => {});
        }
      }
      control.close();
      for (const socket of sockets) socket.destroy();
      // Windows guardian owns lock removal and job teardown, including descendants.
      if (process.platform !== "win32" && readRecord(files)?.token === record.token) fs.rmSync(files.lock, { recursive: true, force: true });
      process.exit(code);
    })().catch(error => { console.error(error); process.exit(1); });
    return stopping;
  }

  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
  process.on("SIGHUP", () => void stop());
  process.on("uncaughtException", error => { console.error(error); void stop(1); });
  process.on("unhandledRejection", error => { console.error(error); void stop(1); });
  if (process.send) process.on("disconnect", () => void stop());

  try {
    if (process.platform !== "win32") fs.rmSync(files.socket, { force: true });
    control.listen(files.socket);
    await once(control, "listening");
    record.pid = process.pid;
    record.status = "starting";
    writeRecord(files, record);
    stopWatcher = setInterval(() => {
      try { if (JSON.parse(fs.readFileSync(files.stop, "utf8").replace(/^\uFEFF/, "")).token === record.token) void stop(); }
      catch (error) { if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) console.error(error); }
    }, 250);
    timer = setTimeout(() => { console.error("[IGT-DEV] Startup timed out"); void stop(1); }, startupTimeoutMs);

    // Fail before loading the real API (and its DB startup work) if either fixed
    // port is already occupied. Actual binds still enforce this after the probe.
    for (const port of [record.webPort, ...(record.mode === "dev" ? [record.apiPort] : [])]) {
      if (port === 0) continue;
      await new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once("error", error => reject(new Error(`Port ${port} is already in use (${error.code}). Inspect npm run dev:status -- --legacy for old instances.`)));
        probe.listen(port, "127.0.0.1", () => probe.close(resolve));
      });
    }

    if (record.mode === "dev") {
      api = fork(apiEntry, record.skipSync ? ["--skip-vocabulary-sync"] : [], {
        cwd: root, env: { ...process.env, IGT_RUNTIME_MODE: "dev", IGT_SERVER_HOST: "127.0.0.1", IGT_SERVER_PORT: String(record.apiPort) },
        stdio: ["ignore", "pipe", "pipe", "ipc"],
      });
      record.apiPid = api.pid;
      writeRecord(files, record);
      const port = await new Promise((resolve, reject) => {
        let output = "";
        const onData = (destination, chunk) => {
          destination.write(chunk);
          output = (output + chunk.toString()).slice(-16000);
          const match = output.match(/\[IGT-SERVER\] Ready on http:\/\/127\.0\.0\.1:(\d+)/);
          if (match) resolve(Number(match[1]));
        };
        api.stdout.on("data", chunk => onData(process.stdout, chunk));
        api.stderr.on("data", chunk => onData(process.stderr, chunk));
        api.once("error", reject);
        api.once("exit", code => {
          reject(new Error(`API exited (${code}). ${output}`));
          if (!stopping) void stop(code || 1);
        });
      });
      if (stopping || api.exitCode !== null || api.signalCode !== null) return;
      record.apiPort = port;
      // Vite's config reads this when loaded, after the API has reported readiness.
      process.env.IGT_DEV_API_PORT = String(port);
    }

    const options = { configFile: path.join(root, "apps", "web", "vite.config.ts"),
      server: { host: "127.0.0.1", port: record.webPort, strictPort: true, open: false },
      preview: { host: "127.0.0.1", port: record.webPort, strictPort: true, open: false } };
    web = record.mode === "preview" ? await preview(options) : await createServer(options);
    if (record.mode === "dev") await web.listen();
    if (stopping) { await web.close(); return; }
    record.webPort = web.httpServer.address().port;
    record.url = `http://127.0.0.1:${record.webPort}`;
    record.status = "running";
    writeRecord(files, record);
    clearTimeout(timer);
    web.httpServer.once("error", error => { console.error(error); void stop(1); });
    console.log(`[IGT-DEV] ${instance} ready: ${record.url}`);
  } catch (error) {
    console.error(`[IGT-DEV] ${error.message}`);
    await stop(1);
  }
}

if (process.argv[1] === import.meta.filename) await runWorker(process.argv[2]);
