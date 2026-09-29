/**
 * Integration test of the Vercel/Neon code path against a real Postgres.
 * Runs only when TEST_DATABASE_URL is set, e.g.
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npx vitest run
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { ApiRequest, handleApi, Store } from './core';
import { createPostgresStore } from './store-postgres';
import { AppState, INITIAL_SETTINGS, INITIAL_SCORING } from '../src/store/state';

const URL = process.env.TEST_DATABASE_URL;
const ADMIN = 'test-admin-key-123456';

function eventState(): AppState {
  return {
    schemaVersion: 4,
    participants: [],
    teams: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, color: '', badgeBg: '', borderColor: '', textColor: '', memberIds: [] })),
    draftLog: [],
    runs: [],
    settings: INITIAL_SETTINGS,
    scoring: {
      ...INITIAL_SCORING,
      events: [{
        id: 'e1', name: 'ناهار', weight: 1, order: 1, status: 'active',
        indicators: Array.from({ length: 5 }, (_, i) => ({ id: `i${i}`, name: `i${i}`, maxScore: 10, weight: 1, order: i })),
      }],
      judges: [
        { id: 'j1', name: 'الف', accessCode: '1111', eventIds: [] },
        { id: 'j2', name: 'ب', accessCode: '2222', eventIds: [] },
      ],
    },
  };
}

function req(method: string, pathname: string, opts: { headers?: Record<string, string>; body?: unknown; query?: string; ip?: string } = {}): ApiRequest {
  const headers = Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method,
    pathname,
    query: new URLSearchParams(opts.query || ''),
    header: (n) => headers[n.toLowerCase()],
    json: async () => opts.body ?? {},
    ip: opts.ip || '10.0.0.1',
  };
}

describe.skipIf(!URL)('Postgres store (Vercel + Neon path)', () => {
  let pool: pg.Pool;
  let storeA: Store;
  let storeB: Store; // a second "serverless instance"
  const config = { adminKey: ADMIN, mode: 'online' as const };
  const call = (s: Store, r: ApiRequest) => handleApi(r, s, config);

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: URL });
    for (const t of ['teamkeshi_state', 'teamkeshi_meta', 'teamkeshi_backups', 'teamkeshi_login_failures']) {
      await pool.query(`drop table if exists ${t}`);
    }
    const exec = async (text: string, params?: unknown[]) => (await pool.query(text, params)).rows;
    storeA = createPostgresStore(exec);
    storeB = createPostgresStore(exec);
  });
  afterAll(async () => {
    await pool?.end();
  });

  it('runs the full operator + judge flow', async () => {
    let r = await call(storeA, req('GET', '/api/health'));
    expect(r.body).toMatchObject({ ok: true, ready: false });

    r = await call(storeA, req('PUT', '/api/state', { body: { state: eventState() } }));
    expect(r.status).toBe(401);

    r = await call(storeA, req('PUT', '/api/state', { headers: { 'X-Admin-Key': ADMIN }, body: { state: eventState() } }));
    expect(r.status).toBe(200);
    expect((r.body as { rev: number }).rev).toBe(1);

    r = await call(storeB, req('POST', '/api/judge/login', { body: { code: '2222' } }));
    expect(r.status).toBe(200);
    const login = r.body as { judgeId: string; state: AppState };
    expect(login.judgeId).toBe('j2');
    expect(JSON.stringify(login.state)).not.toContain('"1111"');

    r = await call(storeB, req('POST', '/api/judge/ops', {
      headers: { 'X-Judge-Code': '2222' },
      body: { ops: [{ kind: 'score', entry: { judgeId: 'j2', teamId: 'a', eventId: 'e1', indicatorId: 'i0', value: 8, updatedAt: '2026-01-01T10:00:00Z' } }] },
    }));
    expect(r.status).toBe(200);
    const rev = (r.body as { rev: number }).rev;

    r = await call(storeA, req('GET', '/api/judge/state', { headers: { 'X-Judge-Code': '2222' }, query: `rev=${rev}` }));
    expect(r.body).toEqual({ rev, unchanged: true });

    r = await call(storeA, req('GET', '/api/state', { headers: { 'X-Admin-Key': ADMIN } }));
    const full = r.body as { state: AppState };
    expect(full.state.scoring.scores['j2|a|i0'].value).toBe(8);

    // Operator pushes an older copy without the judge score: the score must survive
    r = await call(storeA, req('PUT', '/api/state', { headers: { 'X-Admin-Key': ADMIN }, body: { state: eventState() } }));
    expect((r.body as { state: AppState }).state.scoring.scores['j2|a|i0'].value).toBe(8);

    const backups = await pool.query('select count(*)::int as n from teamkeshi_backups');
    expect(backups.rows[0].n).toBeGreaterThanOrEqual(1);
  });

  it('loses nothing when two instances write at the same time', async () => {
    const ops = [];
    for (const team of ['a', 'b', 'c', 'd']) {
      for (let i = 0; i < 5; i++) {
        for (const [judgeId, code] of [['j1', '1111'], ['j2', '2222']] as const) {
          ops.push({ store: ops.length % 2 ? storeA : storeB, code, entry: { judgeId, teamId: team, eventId: 'e1', indicatorId: `i${i}`, value: i + 1, updatedAt: '2026-01-01T11:00:00Z' } });
        }
      }
    }
    const results = await Promise.all(ops.map((o) => call(o.store, req('POST', '/api/judge/ops', {
      headers: { 'X-Judge-Code': o.code },
      body: { ops: [{ kind: 'score', entry: o.entry }] },
    }))));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const r = await call(storeA, req('GET', '/api/state', { headers: { 'X-Admin-Key': ADMIN } }));
    expect(Object.keys((r.body as { state: AppState }).state.scoring.scores)).toHaveLength(40);
  });

  it('throttles repeated wrong codes per client address', async () => {
    for (let i = 0; i < 8; i++) {
      const r = await call(storeA, req('POST', '/api/judge/login', { body: { code: '9999' }, ip: '10.9.9.9' }));
      expect(r.status).toBe(401);
    }
    let r = await call(storeB, req('POST', '/api/judge/login', { body: { code: '1111' }, ip: '10.9.9.9' }));
    expect(r.status).toBe(429);
    r = await call(storeB, req('POST', '/api/judge/login', { body: { code: '1111' }, ip: '10.1.1.1' }));
    expect(r.status).toBe(200);
  });
});
