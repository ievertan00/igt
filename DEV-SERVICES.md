# Development services

Run these commands in the project directory from PowerShell or CMD.

| Command | Behavior |
| --- | --- |
| `npm run web:dev` or `npm run dev:start` | Start the `dev` instance in the foreground. Ctrl+C or closing its terminal stops the whole instance. |
| `npm run dev:status` | List registered instances, URLs, PIDs, state, and log locations. |
| `npm run dev:stop` | Stop `dev` from any new terminal; wait for ports and descendants to be released. |
| `npm run dev:restart` | Stop `dev` and start it again on its previous ports, in the foreground. |
| `npm run dev:start -- --background` | Explicitly keep `dev` running after the launching terminal exits. |
| `npm run dev:restart -- --background` | Restart `dev` and keep it in the background. |
| `npm run mobile:dev` | Start the standalone mobile client (`/mobile/`, default port `5174`) for hot-reloading the Android UI. It proxies the API to `IGT_DEV_API_PORT`; run `npm run web:dev` or the Local Runtime first. Not managed as a dev-runtime instance. |
| `npm run client:build` | Build the desktop bundle and the mobile bundle into `apps/web/dist/` in the correct order. |
| `npm run web:preview` | Start the built frontend as the managed `preview` instance. Requires `npm run client:build` (or `web:build` when the phone app is not needed). |
| `npm run dev:stop -- --instance preview` | Stop preview from another terminal. |
| `npm run test:dev-lifecycle` | Run isolated Windows/process lifecycle regressions; no learner DB or model calls. Build the Web client first for the preview CLI check. |

Repeated starts reuse the existing running instance. Starts that are still in progress
are rejected until they finish. Ports never silently change when occupied. Configure
`IGT_WEB_PORT`, `IGT_DEV_API_PORT`, and `IGT_PREVIEW_PORT` in `.env`.
An explicit port `0` requests an OS-assigned port for temporary test instances.
Use `--instance NAME` for intentionally separate instances with separately configured
ports; names allow letters, digits, underscores, and hyphens.

## Existing services from before this update

Old unregistered processes cannot be adopted automatically. On Windows, first inspect:

```powershell
npm run dev:status -- --legacy
```

To stop **all verified old development and preview instances of this checkout**:

```powershell
npm run dev:stop -- --legacy
npm run web:dev
```

The legacy command requires an absolute project-owned API/Vite descendant, checks
the process command and creation time again before stopping its specific process
tree, and leaves other projects and unrelated Node/CMD programs alone. It stops old
services immediately, so finish any in-flight requests first. It does not stop
standalone production runtimes or arbitrary processes solely because they use a port.

## Lifetime and recovery

The manager stores local instance records, authenticated control endpoints, and logs
under `.cache/dev-instances/`. This directory is ignored by Git. The control token
never appears in status output. `stop` communicates with the verified instance rather
than killing an arbitrary PID or port owner. An unresponsive Windows worker can also
be stopped through the guardian's token-checked stop request. A crashed guardian may
leave a stale lock; `dev:stop` recovers it after checking that its owners are gone.

On Windows, the guardian creates the worker suspended and attaches it to a native Job
Object before it runs. Vite, the API, and any TTS/helper children stay inside this job.
The guardian retains handles to the foreground owner and its terminal shell ancestors.
If a shell disappears, it requests a graceful stop, allows up to six seconds, then
terminates the job. If the guardian itself is killed, Windows closes its job handle
and terminates the job's processes. Background instances deliberately ignore terminal
closure and are managed with `status`, `stop`, and `restart`.

The frontend runs through Vite's Node API, avoiding its extra CMD wrapper. API shutdown
uses IPC and a bounded shutdown period, including on Windows. Startup port checks occur
before loading the real API, and every startup failure tears down the job.

This manager covers `web:dev` and `web:preview`. `web:start` remains the standalone
production runtime; it is not listed or stopped as a development instance.
The native Job Object guarantee is Windows-specific. Other systems use normal signals
and IPC for managed shutdown.
