import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import configLoader from '../lib/shared/config-loader.mjs';
import { exportGrowthData } from '../lib/application/growth-export.mjs';
import { closeAll } from '../lib/db/connection.mjs';

const root = path.resolve(import.meta.dirname, '../apps/growth/dist');
configLoader.load();
const port = Number(process.env.IGT_GROWTH_PORT || configLoader.env.IGT_GROWTH_PORT || 0);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('IGT_GROWTH_PORT must be an integer from 0 to 65535.');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (!/^((127\.0\.0\.1)|(localhost)):\d+$/.test(req.headers.host || '')) { res.writeHead(403); res.end(); return; }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/local-snapshot.json') {
      const snapshot = await exportGrowthData();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify(snapshot));
      return;
    }
    const target = path.resolve(root, '.' + decodeURIComponent(pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const body = fs.readFileSync(target);
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error.code === 'ENOENT' ? 'Not found' : 'Learning records could not be read. Check local configuration.');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`ClearWrite Growth: http://127.0.0.1:${server.address().port}`));
const stop = () => server.close(() => { closeAll(); process.exit(0); });
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
