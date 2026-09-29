/**
 * Teamkeshi Node server — zero runtime dependencies (node:http only).
 *
 * Use it for the offline fallback on the operator's laptop
 * (`start-offline.bat` / `start-offline.command`), or on any VPS.
 * The online default on Vercel uses api/index.ts instead; both share
 * server/core.ts, so the API behaves identically.
 *
 * It serves the built app (dist/) and the JSON API; state lives in
 * DATA_DIR/state.json with rolling backups.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { isAppStateLike } from '../src/sync/merge';
import { ApiRequest, handleApi } from './core';
import { createFileStore } from './store-file';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || 'dist');
const MODE = process.env.MODE === 'offline' || process.argv.includes('--offline') ? 'offline' : 'online';
const MAX_BODY = 5 * 1024 * 1024;

fs.mkdirSync(DATA_DIR, { recursive: true });
const store = createFileStore(DATA_DIR);

// ---------------------------------------------------------------- admin key
function loadAdminKey(): string {
  if (process.env.ADMIN_KEY && process.env.ADMIN_KEY.length >= 12) return process.env.ADMIN_KEY;
  const file = path.join(DATA_DIR, 'admin-key.txt');
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing.length >= 12) return existing;
  } catch {
    // create below
  }
  const key = crypto.randomBytes(12).toString('base64url');
  fs.writeFileSync(file, key + '\n', { mode: 0o600 });
  return key;
}
const ADMIN_KEY = loadAdminKey();

// ---------------------------------------------------------------- offline seeding
/**
 * Offline fallback: seed an empty laptop server from a backup file the
 * operator downloaded from the online app («پشتیبان → دانلود فایل پشتیبان»).
 * Uses --seed <file>, or the newest teamkeshi-backup-*.json in Downloads.
 */
function findSeedFile(): string | null {
  const idx = process.argv.indexOf('--seed');
  if (idx !== -1 && process.argv[idx + 1]) return path.resolve(process.argv[idx + 1]);
  if (MODE !== 'offline') return null;
  const dirs = [path.join(os.homedir(), 'Downloads'), process.cwd()];
  let best: { file: string; mtime: number } | null = null;
  for (const dir of dirs) {
    let names: string[] = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/^teamkeshi-backup-.*\.json$/.test(name)) continue;
      const file = path.join(dir, name);
      const mtime = fs.statSync(file).mtimeMs;
      if (!best || mtime > best.mtime) best = { file, mtime };
    }
  }
  return best ? best.file : null;
}

let seededFrom: string | null = null;
if (!store.hasState()) {
  const seedFile = findSeedFile();
  if (seedFile) {
    try {
      const parsed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
      if (isAppStateLike(parsed) && store.seed(parsed)) seededFrom = seedFile;
    } catch {
      console.warn(`Could not read backup file: ${seedFile}`);
    }
  }
}

// ---------------------------------------------------------------- helpers
function lanUrls(): string[] {
  const urls: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) urls.push(`http://${i.address}:${PORT}`);
    }
  }
  return urls;
}

function clientIp(req: http.IncomingMessage): string {
  const remote = req.socket.remoteAddress || 'unknown';
  // Behind a local reverse proxy (Caddy/nginx) every request comes from
  // loopback; use the forwarded client address so one person's typos don't
  // lock out every judge.
  const forwarded = req.headers['x-forwarded-for'];
  const isLoopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  if (isLoopback && typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return remote;
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('bad_json'));
      }
    });
    req.on('error', reject);
  });
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

// ---------------------------------------------------------------- static files
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const urlPath = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
  let file = path.normalize(path.join(STATIC_DIR, urlPath));
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // SPA fallback
    file = path.join(STATIC_DIR, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('dist/ not found — run `npm run build` first.');
      return;
    }
  }
  const ext = path.extname(file);
  const immutable = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

// ---------------------------------------------------------------- server
const config = {
  adminKey: ADMIN_KEY,
  mode: MODE as 'online' | 'offline',
  info: () => ({ lanUrls: lanUrls(), port: PORT }),
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://x');
  if (!url.pathname.startsWith('/api/')) {
    serveStatic(req, res);
    return;
  }
  const apiReq: ApiRequest = {
    method: req.method || 'GET',
    pathname: url.pathname,
    query: url.searchParams,
    header: (name) => {
      const v = req.headers[name.toLowerCase()];
      return Array.isArray(v) ? v[0] : v;
    },
    json: () => readBody(req),
    ip: clientIp(req),
  };
  try {
    const result = await handleApi(apiReq, store, config);
    send(res, result.status, result.body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error';
    if (!res.headersSent) send(res, msg === 'too_large' ? 413 : msg === 'busy' ? 503 : 400, { error: msg });
  }
});

function shutdown() {
  store.flush();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, HOST, () => {
  const line = '─'.repeat(60);
  console.log(line);
  console.log(`  Teamkeshi server (${MODE === 'offline' ? 'OFFLINE / laptop' : 'online'}) — port ${PORT}`);
  console.log(line);
  console.log(`  Operator (open on THIS laptop):  http://localhost:${PORT}/?admin=${ADMIN_KEY}`);
  for (const u of lanUrls()) {
    console.log(`  Judges on the same Wi-Fi:        ${u}/?judge=1`);
  }
  console.log(`  Data folder: ${DATA_DIR}`);
  if (seededFrom) console.log(`  Loaded event data from backup: ${seededFrom}`);
  else if (!store.hasState()) console.log('  No event data yet: the operator page will upload its data on first open.');
  console.log(line);

  if (process.argv.includes('--open')) {
    const url = `http://localhost:${PORT}/?admin=${ADMIN_KEY}`;
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => undefined);
  }
});
