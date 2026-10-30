import { runHandbook } from "../lib/cli/commands/handbook.mjs";

process.exitCode = runHandbook(process.argv.slice(2));
