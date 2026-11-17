// Migration runner: idempotent, applies SQL + .mjs, records schema_version, replays missing.
import { test } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runMigrations } from "../lib/db/migrations.mjs";

function tmpEnv() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-migrations-"));
  const dir = path.join(root, "migrations");
  fs.mkdirSync(dir);
  const dbPath = path.join(root, "test.db");
  return { root, dir, dbPath };
}

function cleanup(env, db) {
  if (db && db.open) db.close();
  fs.rmSync(env.root, { recursive: true, force: true });
}

test("applies a fresh SQL migration and records it", async () => {
  const env = tmpEnv();
  fs.writeFileSync(path.join(env.dir, "001_init.sql"), "CREATE TABLE foo (id INTEGER PRIMARY KEY, name TEXT);");
  const db = new Database(env.dbPath);

  const ran = await runMigrations(db, env.dir);
  assert.deepEqual(ran, ["001_init.sql"]);
  assert.equal(db.prepare("SELECT id FROM schema_version").get().id, 1);
  db.prepare("INSERT INTO foo (name) VALUES (?)").run("ok");

  cleanup(env, db);
});

test("re-running is a no-op (idempotent)", async () => {
  const env = tmpEnv();
  fs.writeFileSync(path.join(env.dir, "001_init.sql"), "CREATE TABLE foo (id INTEGER PRIMARY KEY);");
  const db = new Database(env.dbPath);
  await runMigrations(db, env.dir);
  const ran2 = await runMigrations(db, env.dir);
  assert.deepEqual(ran2, []);
  cleanup(env, db);
});

test("applies an .mjs migration via exported up(db)", async () => {
  const env = tmpEnv();
  fs.writeFileSync(path.join(env.dir, "001_init.sql"), "CREATE TABLE foo (id INTEGER PRIMARY KEY, n INTEGER);");
  fs.writeFileSync(
    path.join(env.dir, "002_seed.mjs"),
    `export function up(db) { db.prepare("INSERT INTO foo (n) VALUES (?)").run(42); }`
  );
  const db = new Database(env.dbPath);
  const ran = await runMigrations(db, env.dir);
  assert.deepEqual(ran, ["001_init.sql", "002_seed.mjs"]);
  assert.equal(db.prepare("SELECT n FROM foo WHERE id=1").get().n, 42);
  cleanup(env, db);
});

test("applies later migrations when earlier are already recorded (restore-from-backup)", async () => {
  const env = tmpEnv();
  fs.writeFileSync(path.join(env.dir, "001_init.sql"), "CREATE TABLE foo (id INTEGER PRIMARY KEY);");
  const db = new Database(env.dbPath);
  await runMigrations(db, env.dir);

  fs.writeFileSync(path.join(env.dir, "002_extra.sql"), "ALTER TABLE foo ADD COLUMN extra TEXT;");
  const ran = await runMigrations(db, env.dir);
  assert.deepEqual(ran, ["002_extra.sql"]);
  assert.equal(db.prepare("SELECT id FROM schema_version ORDER BY id").all().length, 2);
  cleanup(env, db);
});

test("missing .mjs up() throws", async () => {
  const env = tmpEnv();
  fs.writeFileSync(path.join(env.dir, "001_bad.mjs"), `export const meta = "no up()";`);
  const db = new Database(env.dbPath);
  await assert.rejects(() => runMigrations(db, env.dir), /missing exported up\(db\)/);
  cleanup(env, db);
});
