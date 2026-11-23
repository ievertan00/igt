import test from "node:test";
import assert from "node:assert/strict";
import { guardRequest, isRemoteMode } from "../lib/server/request-guard.mjs";
import { dispatch, register } from "../lib/server/router.mjs";

function capture() {
  const res = { status: null, headers: null, body: "" };
  res.writeHead = (status, headers) => { res.status = status; res.headers = headers; };
  res.end = (value) => { res.body = value || ""; };
  return res;
}

test("header-less clients and loopback hosts pass the guard", () => {
  assert.equal(guardRequest({}, capture()), true);
  assert.equal(guardRequest({ headers: { host: "127.0.0.1:8787" } }, capture()), true);
  assert.equal(guardRequest({ headers: { host: "localhost:5173" } }, capture()), true);
});

test("unknown hosts and cross-origin browser requests are rejected", () => {
  const rebinding = capture();
  assert.equal(guardRequest({ headers: { host: "attacker.example:8787" } }, rebinding), false);
  assert.equal(rebinding.status, 403);

  const crossOrigin = capture();
  assert.equal(guardRequest({ headers: { host: "127.0.0.1:8787", origin: "http://attacker.example" } }, crossOrigin), false);
  assert.equal(crossOrigin.status, 403);

  const malformed = capture();
  assert.equal(guardRequest({ headers: { host: "127.0.0.1:8787", origin: "not-a-url" } }, malformed), false);
  assert.equal(malformed.status, 403);
});

test("same-origin browser requests pass and preflight echoes only the caller origin", async () => {
  assert.equal(guardRequest({ headers: { host: "127.0.0.1:8787", origin: "http://127.0.0.1:8787" } }, capture()), true);

  const res = capture();
  await dispatch({ method: "OPTIONS", url: "/grammar", headers: { origin: "http://127.0.0.1:8787" } }, res);
  assert.equal(res.status, 200);
  assert.equal(res.headers["Access-Control-Allow-Origin"], "http://127.0.0.1:8787");

  const bare = capture();
  await dispatch({ method: "OPTIONS", url: "/grammar", headers: {} }, bare);
  assert.equal(bare.headers["Access-Control-Allow-Origin"], undefined);
});

test("remote mode follows the configured listen host", () => {
  const previous = process.env.IGT_SERVER_HOST;
  try {
    process.env.IGT_SERVER_HOST = "0.0.0.0";
    assert.equal(isRemoteMode(), true);
    assert.equal(isRemoteMode("127.0.0.1"), false);
    process.env.IGT_SERVER_HOST = "127.0.0.1";
    assert.equal(isRemoteMode(), false);
    delete process.env.IGT_SERVER_HOST;
    assert.equal(isRemoteMode(), false);
  } finally {
    if (previous === undefined) delete process.env.IGT_SERVER_HOST;
    else process.env.IGT_SERVER_HOST = previous;
  }
});

test("POST bodies above the 2 MB limit are rejected with 413", async () => {
  register("POST", "/guard-test-echo", async (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
  });
  const chunk = "x".repeat(64 * 1024);
  const req = {
    method: "POST", url: "/guard-test-echo", headers: {},
    setTimeout() {}, destroy() { this.destroyed = true; },
    on(event, cb) {
      if (event === "data") { for (let i = 0; i < 40; i++) cb(chunk); }
      if (event === "end") cb();
    },
  };
  const res = capture();
  await dispatch(req, res);
  assert.equal(res.status, 413);
  assert.equal(JSON.parse(res.body).error.code, "BODY_TOO_LARGE");
});
