/**
 * Vercel Function: the online sync API, backed by Neon Postgres.
 *
 * vercel.json rewrites every /api/* request here and passes the original
 * sub-path in `__path`, so the same core as the laptop server handles it.
 *
 * Required environment variables (Vercel → Project → Settings → Environment Variables):
 * - DATABASE_URL  set automatically by the Vercel ↔ Neon integration
 * - ADMIN_KEY     long random secret; the operator opens the app once with ?admin=<ADMIN_KEY>
 */
import { neon } from '@neondatabase/serverless';
import { handleApi, type ApiRequest, type Store } from '../server/core.js';
import { createPostgresStore } from '../server/store-postgres.js';
import { CORS_HEADERS } from '../server/cors.js';

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const MAX_BODY = 4 * 1024 * 1024;

let store: Store | null = null;
function getStore(): Store {
  if (!store) {
    const sql = neon(DATABASE_URL);
    store = createPostgresStore(
      (text, params) => sql.query(text, params ?? []) as Promise<Record<string, unknown>[]>
    );
  }
  return store;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS_HEADERS },
  });
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (!DATABASE_URL) return json(500, { error: 'database_not_configured' });

  const url = new URL(request.url);
  const subPath = url.searchParams.get('__path');
  url.searchParams.delete('__path');
  const pathname = subPath !== null ? `/api/${subPath.replace(/^\/+/, '')}` : url.pathname;

  const apiReq: ApiRequest = {
    method: request.method,
    pathname,
    query: url.searchParams,
    header: (name) => request.headers.get(name) ?? undefined,
    json: async () => {
      const text = await request.text();
      if (text.length > MAX_BODY) throw new Error('too_large');
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        throw new Error('bad_json');
      }
    },
    ip:
      (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown',
  };

  try {
    const result = await handleApi(apiReq, getStore(), {
      adminKey: process.env.ADMIN_KEY || '',
      mode: 'online',
    });
    return json(result.status, result.body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error';
    const status = msg === 'too_large' ? 413 : msg === 'bad_json' ? 400 : 503;
    return json(status, { error: msg === 'too_large' || msg === 'bad_json' ? msg : 'server_error' });
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const OPTIONS = handle;
