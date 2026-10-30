import { spawnSync } from "node:child_process";
import path from "node:path";

const result = spawnSync(process.execPath, ["--test", "--test-name-pattern=Coach detail|failed or fabricated", path.join(import.meta.dirname, "..", "tests", "my-learning.test.mjs")], { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
