import path from "node:path";
import { start } from "../manager.mjs";
await start({ instance: process.argv[2], mode: "dev", apiPort: 0, webPort: 0, background: process.argv.includes("--background") },
  { workerEntry: path.join(import.meta.dirname, "worker.mjs") });
