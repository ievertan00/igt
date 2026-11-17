import { spawn } from "node:child_process";
const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
console.log(`[FIXTURE] grandchild=${child.pid}`);
// Deliberately never report readiness. The guardian must bound and reclaim this.
setInterval(() => {}, 1000);
