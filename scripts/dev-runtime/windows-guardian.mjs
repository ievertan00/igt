// Detach a Node host, not Windows PowerShell (which requires usable console setup).
// PowerShell then owns the native Job Object; either host dying tears down the job.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { root, locations } from "./shared.mjs";
const [instance, workerEntry, owner, background] = process.argv.slice(2);
const files = locations(instance);
const error = fs.openSync(files.guardian, "a");
let helper;
try {
  helper = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File",
    path.join(root, "scripts", "dev-runtime", "windows-job.ps1"), "-NodeExe", process.execPath,
    "-WorkerScript", workerEntry, "-Instance", instance, "-Directory", files.directory,
    "-OwnerId", owner, "-GuardianId", String(process.pid), ...(background === "true" ? ["-Background"] : [])],
  { cwd: root, windowsHide: true, stdio: ["ignore", "ignore", error] });
} finally { fs.closeSync(error); }
helper.on("error", error => { fs.appendFileSync(files.guardian, String(error)); process.exitCode = 1; });
helper.on("exit", code => { process.exitCode = code ?? 1; });
