import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ConfigLoader } from "../lib/shared/config-loader.mjs";
import { registerFileSettingsRoutes } from "../lib/server/routes/file-settings.mjs";
import { dispatch } from "../lib/server/router.mjs";
import { resolveVocabularyPath } from "../lib/shared/vocabulary-source.mjs";
import { resolvePracticePath } from "../lib/application/practice.mjs";
import { resolveAskTargetDir } from "../lib/features/ask/save-handler.mjs";
import { resolveCoachReportsPath } from "../lib/application/coach-report-store.mjs";

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

  const loader = new ConfigLoader(root);
  const paths = {
    vaultDir: path.join(root, "vault"),
    reviewLog: path.join(root, "logs", "Review.md"),
    vocabularyFile: path.join(root, "Word #1.md"),
    practiceLog: path.join(root, "Practice.md"),
    askNotesDir: path.join(root, "Ask"),
    handbookReports: path.join(root, "Coach"),
  };
  fs.writeFileSync(loader.envPath, "");
  registerFileSettingsRoutes({ config: loader.load(), loader });
  async function request(method, body) {
    let status;
    let result;
    await dispatch({
      method, url: "/settings/files",
      on(event, reply) { if (event === "data") reply(JSON.stringify(body)); if (event === "end") reply(); },
    }, {
      writeHead(code) { status = code; },
      end(raw) { result = JSON.parse(raw); },
    });
    return { status, ...result };
  }
  assert.equal((await request("POST", { paths: { reviewLog: "Review.md" } })).status, 400);
  assert.equal(fs.readFileSync(loader.envPath, "utf8"), "");
  const defaults = (await request("GET")).paths;
  assert.deepEqual((await request("POST", { paths: { vaultDir: paths.vaultDir } })).paths, {
    ...defaults, vaultDir: paths.vaultDir,
  });
  const saved = await request("POST", { paths });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.paths, paths);
  assert.deepEqual(Object.keys(loader.env).sort(), [
    "IGT_ASK_PATH", "IGT_COACH_REPORTS_PATH", "IGT_PRACTICE_FILE",
    "IGT_REVIEW_FILE", "IGT_VAULT_PATH", "IGT_VOCABULARY_FILE",
  ]);
  const movedVault = { ...paths, vaultDir: path.join(root, "other-vault") };
  assert.deepEqual((await request("POST", { paths: { vaultDir: movedVault.vaultDir } })).paths, movedVault);
  assert.deepEqual((await request("GET")).paths, movedVault);
  const explicit = loader.load();
  assert.equal(resolveVocabularyPath(explicit), paths.vocabularyFile);
  assert.equal(resolvePracticePath(explicit), paths.practiceLog);
  assert.equal(resolveAskTargetDir(explicit), paths.askNotesDir);
  assert.equal(resolveCoachReportsPath(explicit), paths.handbookReports);
  console.log("config path smoke ok");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
