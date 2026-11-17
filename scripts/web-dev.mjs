// Established entry point for managed development and preview instances.
import { main } from "./dev-runtime/manager.mjs";
main().catch(error => { console.error(`[IGT-DEV] ${error.message}`); process.exitCode = 1; });
