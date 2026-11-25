import fs from 'node:fs';
import path from 'node:path';
import { exportGrowthData } from '../lib/application/growth-export.mjs';
import { closeAll } from '../lib/db/connection.mjs';

const target = path.resolve(process.argv[2] || '.cache/tmp/clearwrite-growth.json');
try {
  const data = await exportGrowthData();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(data), 'utf8');
  fs.renameSync(temporary, target);
  console.log(JSON.stringify({ file: target, exportedAt: data.exportedAt, coverage: data.coverage }));
} finally { closeAll(); }
