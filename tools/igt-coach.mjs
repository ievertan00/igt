import { runCoach } from "../lib/cli/commands/learning.mjs";

process.exitCode = await runCoach(process.argv.slice(2));
