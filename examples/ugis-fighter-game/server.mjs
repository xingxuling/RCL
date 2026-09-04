import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

function safePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^([.][.][/\\])+/, '');
  const relative = clean === '/' ? 'index.html' : clean.replace(/^[/\\]+/, '');
  const candidate = join(root, relative);
  if (!candidate.startsWith(root)) return null;
  return candidate;
}

function sendFile(res, filePath) {
  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end();
    return;
  }

  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify({ ok: true, app: 'ugis-fighter-game' }));
    return;
  }

  const requested = safePath(req.url || '/');
  if (requested && existsSync(requested) && statSync(requested).isFile()) {
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'content-type': MIME[extname(requested).toLowerCase()] || 'application/octet-stream' });
      res.end();
    } else {
      sendFile(res, requested);
    }
    return;
  }

  const index = join(root, 'index.html');
  if (!existsSync(index)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('build not found');
    return;
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
    res.end();
  } else {
    sendFile(res, index);
  }
});

server.listen(port, host, () => {
  console.log(`UGIS fighter game serving ${root} on http://${host}:${port}`);
});
