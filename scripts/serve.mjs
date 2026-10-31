// Zero-dependency static dev server:  node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from './build-manifest.mjs';
import { writeFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.argv[2] || process.env.PORT || 5173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.md': 'text/markdown; charset=utf-8', '.fly': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.svg': 'image/svg+xml' };

writeFileSync(join(root, 'src/assets/manifest.json'), JSON.stringify(buildManifest(), null, 2) + '\n');

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
    if ((await stat(file)).isDirectory()) { res.writeHead(302, { Location: p + '/' }).end(); return; }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('not found'); }
}).listen(port, () => console.log(`Filmly Studio dev server: http://localhost:${port}`));
