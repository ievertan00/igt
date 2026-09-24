import { RESOURCE_CATALOG } from "../lib/features/handbook/profile.mjs";
import { verifyResourceUrl } from "../lib/features/learning-diagnosis/resources.mjs";
import { beijingISO } from "../lib/shared/timezone.mjs";

let failed = 0;
for (const resource of RESOURCE_CATALOG) {
  const result = await verifyResourceUrl(resource.url);
  if (!result.ok) failed += 1;
  process.stdout.write(JSON.stringify({
    title: resource.title,
    url: resource.url,
    ...result,
    checkedAt: beijingISO(),
  }) + "\n");
}
if (failed > 0) {
  process.stderr.write(`${failed} learning resource(s) need verification.\n`);
  process.exitCode = 1;
}
