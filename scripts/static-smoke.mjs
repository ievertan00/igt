import assert from "node:assert/strict";
import path from "node:path";
import { serveStatic } from "../lib/server/static.mjs";

function response() {
  return { status: null, body: "", writeHead(status) { this.status = status; }, end(body) { this.body = body?.toString() || ""; } };
}

const apiResponse = response();
assert.equal(serveStatic({ method: "GET", url: "/dashboard" }, apiResponse), false);
const pageResponse = response();
assert.equal(serveStatic({ method: "GET", url: "/" }, pageResponse), true);
assert.equal(pageResponse.status, 200);
const missingResponse = response();
assert.equal(serveStatic({ method: "GET", url: "/nested/route" }, missingResponse), true);
assert.equal(missingResponse.status, 200);
const traversalResponse = response();
assert.equal(serveStatic({ method: "GET", url: "/../package.json" }, traversalResponse), true);
assert.equal(traversalResponse.status, 404);
const missingBuildResponse = response();
assert.equal(serveStatic({ method: "GET", url: "/" }, missingBuildResponse, {
  root: path.join(process.cwd(), "apps", "web", "__missing-dist__"),
}), true);
assert.equal(missingBuildResponse.status, 503);
assert.match(missingBuildResponse.body, /Web build is not available/);
console.log("static smoke ok");
