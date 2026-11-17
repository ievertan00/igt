// A real HTTP child and grandchild, with no learner DB, migrations, or providers.
import http from "node:http";
import { spawn } from "node:child_process";
const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
console.log(`[FIXTURE] grandchild=${child.pid}`);
const server = http.createServer((_req, res) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ runtime: "local", fixture: true })); });
server.listen(Number(process.env.IGT_SERVER_PORT), "127.0.0.1", () => console.error(`[IGT-SERVER] Ready on http://127.0.0.1:${server.address().port}`));
server.on("error", error => { console.error(error); child.kill(); process.exit(1); });
function stop() { child.kill(); server.close(() => process.exit()); }
process.on("message", message => { if (message?.type === "igt:shutdown") stop(); });
process.on("disconnect", stop);
