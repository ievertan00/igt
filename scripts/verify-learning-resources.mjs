import { RESOURCE_CATALOG } from "../lib/features/handbook/profile.mjs";
import { verifyResourceUrl } from "../lib/features/learning-diagnosis/resources.mjs";
import { getDb } from "../lib/db/connection.mjs";

let failed = 0;
const db = await getDb();
const saveCheck = db.prepare(`
  INSERT INTO learning_resource_checks (url, ok, status, final_url, reason, checked_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(url) DO UPDATE SET
    ok = excluded.ok,
    status = excluded.status,
    final_url = excluded.final_url,
    reason = excluded.reason,
    checked_at = excluded.checked_at
`);
for (const resource of RESOURCE_CATALOG) {
  const result = await verifyResourceUrl(resource.url);
  if (!result.ok) failed += 1;
  saveCheck.run(resource.url, result.ok ? 1 : 0, result.status, result.finalUrl, result.reason, new Date().toISOString());
  process.stdout.write(JSON.stringify({
    title: resource.title,
    url: resource.url,
    ...result,
    checkedAt: new Date().toISOString(),
  }) + "\n");
}
if (failed > 0) {
  process.stderr.write(`${failed} learning resource(s) need verification.\n`);
  process.exitCode = 1;
}
