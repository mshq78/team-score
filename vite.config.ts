import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, Plugin } from 'vite';
import { handleApi, ApiRequest } from './server/core';
import { createFileStore } from './server/store-file';
import { CORS_HEADERS } from './server/cors';

function teamkeshiApiPlugin(): Plugin {
  return {
    name: 'teamkeshi-api',
    configureServer(server) {
      const dataDir = path.resolve('data');
      fs.mkdirSync(dataDir, { recursive: true });
      const store = createFileStore(dataDir);

      function loadAdminKey(): string {
        if (process.env.ADMIN_KEY && process.env.ADMIN_KEY.length >= 12) return process.env.ADMIN_KEY;
        const file = path.join(dataDir, 'admin-key.txt');
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

      const adminKey = loadAdminKey();
      const config = {
        adminKey,
        mode: 'online' as const,
        info: () => ({ lanUrls: [], port: 3000 }),
      };

      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost:3000');
        if (!url.pathname.startsWith('/api/')) {
          return next();
        }

        if (req.method === 'OPTIONS') {
          res.writeHead(204, CORS_HEADERS).end();
          return;
        }

        const readBody = (req: http.IncomingMessage): Promise<unknown> => {
          return new Promise((resolve, reject) => {
            let size = 0;
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => {
              size += c.length;
              if (size > 5 * 1024 * 1024) {
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
        };

        const apiReq: ApiRequest = {
          method: req.method || 'GET',
          pathname: url.pathname,
          query: url.searchParams,
          header: (name) => {
            const v = req.headers[name.toLowerCase()];
            return Array.isArray(v) ? v[0] : v;
          },
          json: () => readBody(req),
          ip: req.socket.remoteAddress || '127.0.0.1',
        };

        try {
          const result = await handleApi(apiReq, store, config);
          res.writeHead(result.status, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...CORS_HEADERS,
          });
          res.end(JSON.stringify(result.body));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'error';
          if (!res.headersSent) {
            res.writeHead(msg === 'too_large' ? 413 : msg === 'busy' ? 503 : 400, {
              'Content-Type': 'application/json; charset=utf-8',
              ...CORS_HEADERS,
            });
            res.end(JSON.stringify({ error: msg }));
          }
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), teamkeshiApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // Vite's own CORS layer would answer /api preflights first; the API plugin sets its own headers.
      cors: false as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
