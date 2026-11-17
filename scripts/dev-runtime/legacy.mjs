import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { root } from "./shared.mjs";
const execute = promisify(execFile);

async function snapshot() {
  const script = "$ErrorActionPreference = 'Stop'; $p = @(Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('node.exe','cmd.exe') } | Select-Object ProcessId,ParentProcessId,Name,CommandLine,@{n='Created';e={$_.CreationDate.ToUniversalTime().ToString('o')}}); $l = @(Get-NetTCPConnection -State Listen | Select-Object OwningProcess,LocalPort); @{processes=$p;listeners=$l} | ConvertTo-Json -Depth 4 -Compress";
  const { stdout } = await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(stdout.replace(/^\uFEFF/, ""));
}

// Require an absolute repository-owned descendant; relative command names alone
// cannot distinguish this checkout from a different project's npm process.
export function classifyLegacy({ processes, listeners }, projectRoot = root) {
  const normalized = projectRoot.replaceAll("/", "\\").toLowerCase();
  const entries = new Map(processes.map(process => [process.ProcessId, process]));
  const command = process => (process.CommandLine || "").replaceAll("/", "\\").toLowerCase();
  const candidates = new Map();
  for (const process of processes) {
    const text = command(process);
    let candidate;
    if (text.includes(`${normalized}\\apps\\local\\server.mjs`) || text.includes(`${normalized}\\lib\\server\\index.mjs`)) {
      const parent = entries.get(process.ParentProcessId);
      if (parent?.Name === "node.exe" && /scripts[\\/]web-dev\.mjs\b/i.test(parent.CommandLine || "")) candidate = parent;
    } else if (text.includes(`${normalized}\\node_modules\\`) && /vite\.js\"?\s+preview\b/i.test(process.CommandLine || "")) {
      candidate = process;
    }
    if (!candidate) continue;
    const visited = new Set();
    while (!visited.has(candidate.ProcessId)) {
      visited.add(candidate.ProcessId);
      const parent = entries.get(candidate.ParentProcessId);
      if (!parent || parent.Created > candidate.Created) break;
      const parentCommand = parent.CommandLine || "";
      if (parent.Name === "cmd.exe" && /\b(?:web-dev\.mjs|vite preview)\b/i.test(parentCommand)
        || parent.Name === "node.exe" && /npm-cli\.js\"?\s+run\s+web:(?:dev|preview)\b/i.test(parentCommand)) candidate = parent;
      else break;
    }
    candidates.set(candidate.ProcessId, candidate);
  }
  return [...candidates.values()].map(candidate => {
    const descendants = new Set([candidate.ProcessId]);
    for (let changed = true; changed;) {
      changed = false;
      for (const process of processes) {
        const parent = entries.get(process.ParentProcessId);
        if (!descendants.has(process.ProcessId) && descendants.has(process.ParentProcessId) && parent.Created <= process.Created) {
          descendants.add(process.ProcessId); changed = true;
        }
      }
    }
    return { pid: candidate.ProcessId, created: candidate.Created, command: candidate.CommandLine,
      ports: [...new Set(listeners.filter(listener => descendants.has(listener.OwningProcess)).map(listener => listener.LocalPort))],
      processes: descendants.size };
  });
}

export async function legacy(action) {
  if (process.platform !== "win32") throw new Error("Legacy discovery is currently Windows-only.");
  const instances = classifyLegacy(await snapshot());
  if (!instances.length) { console.log("[IGT-DEV] No verified legacy instances in this checkout."); return; }
  for (const instance of instances) {
    console.log(JSON.stringify({ status: "legacy", ...instance }));
    if (action === "stop") {
      const current = (await snapshot()).processes.find(process => process.ProcessId === instance.pid);
      if (!current) continue;
      if (current.Created !== instance.created || current.CommandLine !== instance.command) throw new Error(`PID ${instance.pid} changed identity; refusing to stop it.`);
      await execute("taskkill.exe", ["/PID", String(instance.pid), "/T", "/F"], { windowsHide: true });
      console.log(`[IGT-DEV] Stopped verified legacy tree ${instance.pid}`);
    }
  }
}
