import path from "node:path";
import { runWorker } from "../worker.mjs";
await runWorker(process.argv[2], { apiEntry: path.join(import.meta.dirname, "timeout-api.mjs"), startupTimeoutMs: 500 });
