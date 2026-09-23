import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConfigLoader } from "../lib/shared/config-loader.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "igt-config-paths-"));
try {
  fs.writeFileSync(path.join(root, "igt_config.json"), "{}\n");
  fs.writeFileSync(path.join(root, ".env"), "IGT_DATA_DIR=data\nIGT_VOCAB_PATH=assets/vocabulary.md\nIGT_ASK_PATH=assets/asks\n");
  const config = new ConfigLoader(root).load();
  assert.equal(config.DataDir, "data");
  assert.equal(config.DbPath, path.join(root, "data", "igt_data.db"));
  assert.equal(config.ReviewPath, path.join(root, "data", "00_Review_logs.md"));
  assert.equal(config.VocabularyPath, "assets/vocabulary.md");
  assert.equal(config.AskPath, "assets/asks");
  console.log("config path smoke ok");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
