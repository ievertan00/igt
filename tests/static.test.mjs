import { test } from "node:test";
import assert from "node:assert/strict";
import { serveStatic } from "../lib/server/static.mjs";

function response() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body) { this.body = body; },
  };
}

test("serves the web shell at root", () => {
  const res = response();
  assert.equal(serveStatic({ method: "GET", url: "/" }, res), true);
  assert.equal(res.status, 200);
  assert.match(String(res.body), /<title>ClearWrite/);
});

test("leaves API paths to the API router", () => {
  const res = response();
  assert.equal(serveStatic({ method: "GET", url: "/stats" }, res), false);
  assert.equal(res.status, null);
});
