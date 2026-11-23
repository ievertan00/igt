import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import configLoader from "../../lib/shared/config-loader.mjs";
import { runtimeLockPath } from "../../lib/db/runtime-lock.mjs";
import { getDb } from "../../lib/db/connection.mjs";

test("Local Runtime imports without startup and can retry after startup failures", async t => {
  const workspace = path.resolve(import.meta.dirname, "..", "..");
  const fixtureRoot = path.join(workspace, ".tmp");
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const fixture = fs.mkdtempDisposableSync(path.join(fixtureRoot, "runtime-lifecycle-"));
  assert.equal(path.dirname(path.resolve(fixture.path)), fixtureRoot);
  const dbPath = path.join(fixture.path, "runtime.db");
  const lockPath = runtimeLockPath(dbPath);
  const configPath = path.join(fixture.path, "config.json");
  const original = { envPath: configLoader.envPath, configPath: configLoader.configPath };
  configLoader.envPath = path.join(fixture.path, "missing.env");
  configLoader.configPath = configPath;
  t.after(() => {
    Object.assign(configLoader, original);
    fixture.remove();
  });

  const signals = ["SIGINT", "SIGTERM", "message", "disconnect", "uncaughtException"];
  const listenerCounts = signals.map(signal => process.listenerCount(signal));
  const { startRuntime } = await import("../../lib/server/index.mjs");
  await import("../../apps/local/server.mjs");
  assert.deepEqual(signals.map(signal => process.listenerCount(signal)), listenerCounts);
  assert.equal(fs.existsSync(dbPath), false);
  assert.equal(fs.existsSync(lockPath), false);

  fs.writeFileSync(configPath, JSON.stringify({ DbPath: dbPath, VocabularyPath: fixture.path }));
  fs.writeFileSync(dbPath, "Not a SQLite database");
  await assert.rejects(startRuntime({ port: 0 }), { code: "SQLITE_NOTADB" });
  assert.equal(fs.existsSync(lockPath), false);
  fs.unlinkSync(dbPath);

  // Reading a directory as Markdown fails after the migrations have completed.
  await assert.rejects(startRuntime({ port: 0 }), { code: "EISDIR" });
  assert.equal(fs.existsSync(lockPath), false);

  await assert.rejects(startRuntime({ port: -1, skipVocabularySync: true }), { code: "ERR_SOCKET_BAD_PORT" });
  assert.equal(fs.existsSync(lockPath), false);

  for (let run = 0; run < 2; run++) {
    const runtime = await startRuntime({ port: 0, skipVocabularySync: true });
    try {
      assert.equal(JSON.parse(fs.readFileSync(lockPath, "utf8")).port, runtime.port);
      await assert.rejects(startRuntime({ port: 0 }), /already starting or running in this process/);
      const response = await fetch(`http://127.0.0.1:${runtime.port}/health`);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).status, "ok");

      const db = await getDb();
      const closing = runtime.close();
      assert.equal(runtime.close(), closing);
      await closing;
      assert.equal(db.open, false);
      assert.equal(fs.existsSync(lockPath), false);
    } finally {
      await runtime.close();
    }
  }

  const settingsUrl = new URL("../../lib/shared/config-loader.mjs", import.meta.url);
  const preload = [
    `import configLoader from ${JSON.stringify(settingsUrl.href)};`,
    `Object.assign(configLoader, ${JSON.stringify({ configPath, envPath: configLoader.envPath })});`,
  ].join("\n");
  const execArgv = ["--import", `data:text/javascript;base64,${Buffer.from(preload).toString("base64")}`];
  for (const entry of ["lib/server/index.mjs", "apps/local/server.mjs"]) {
    const child = fork(path.join(workspace, entry), ["--skip-vocabulary-sync"], {
      execArgv,
      env: { ...process.env, IGT_SERVER_HOST: "127.0.0.1", IGT_SERVER_PORT: "0" },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    const exit = once(child, "exit");
    let output = "";
    let timer;
    try {
      const port = await Promise.race([
        new Promise((resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`${entry} did not report readiness.\n${output}`)), 5000);
          child.stderr.on("data", chunk => {
            output += chunk;
            const ready = output.match(/Ready on http:\/\/127\.0\.0\.1:(\d+)\r?\n/);
            if (ready) resolve(Number(ready[1]));
          });
        }),
        exit.then(([code]) => { throw new Error(`${entry} exited with code ${code}.\n${output}`); }),
      ]);
      const response = await fetch(`http://127.0.0.1:${port}/runtime`);
      assert.equal((await response.json()).runtime, "local");
      child.send({ type: "igt:shutdown" });
      assert.deepEqual(await exit, [0, null]);
      assert.equal(fs.existsSync(lockPath), false);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) child.kill();
      await exit;
    }
  }
});
