import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApiRequest, handleApi } from './core';
import { createFileStore } from './store-file';
import { StaleRunError, mergeOperatorState, JudgeOp } from '../src/sync/merge';
import { AppState } from '../src/store/state';
import { runningState, scoreEntry, startNewRun } from '../src/testing/runFixture';

const ADMIN = 'test-admin-key-123456';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamkeshi-run-'));
const store = createFileStore(dir);
const config = { adminKey: ADMIN, mode: 'offline' as const };

afterAll(() => {
  store.flush();
  fs.rmSync(dir, { recursive: true, force: true });
});

function req(method: string, pathname: string, opts: { headers?: Record<string, string>; body?: unknown } = {}): ApiRequest {
  const headers = Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return { method, pathname, query: new URLSearchParams(), header: (n) => headers[n.toLowerCase()], json: async () => opts.body ?? {}, ip: '10.0.0.1' };
}
const admin = { 'X-Admin-Key': ADMIN };
const put = (state: AppState) => handleApi(req('PUT', '/api/state', { headers: admin, body: { state } }), store, config);
const getState = async () => (await handleApi(req('GET', '/api/state', { headers: admin }), store, config)).body as { rev: number; state: AppState };
const scoreOp = (teamId: string, value: number, runId?: string): JudgeOp => ({ kind: 'score', entry: scoreEntry(teamId, value, new Date().toISOString()), ...(runId ? { runId } : {}) });

describe('run-scoped sync through the API', () => {
  const base = runningState(false);
  base.scoring.events[0].status = 'active';

  it('a stale operator (older run) gets 409 stale_run and the server keeps the newer run', async () => {
    expect((await put(base)).status).toBe(200);
    const newer = startNewRun(base, { clearParticipants: false });
    expect((await put(newer)).status).toBe(200);
    const rev = (await getState()).rev;

    const stale = await put(base); // operator that never saw the new run
    expect(stale).toEqual({ status: 409, body: { error: 'stale_run' } });
    expect(() => mergeOperatorState(newer, base)).toThrow(StaleRunError);
    const after = await getState();
    expect(after.rev).toBe(rev);
    expect(after.state.scoring.runId).toBe('run-2');
  });

  it('old-run judge ops are rejected after a new run, new-run ops are accepted', async () => {
    // fresh run-1 state on the server for a clean scenario
    const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'teamkeshi-run2-'));
    const s = createFileStore(dir2);
    const call = (r: ApiRequest) => handleApi(r, s, config);
    const gs = async () => (await call(req('GET', '/api/state', { headers: admin }))).body as { rev: number; state: AppState };
    const ops = (ops: JudgeOp[]) => call(req('POST', '/api/judge/ops', { headers: { 'X-Judge-Code': '1111' }, body: { ops } }));
    try {
      await call(req('PUT', '/api/state', { headers: admin, body: { state: base } }));

      // 1) judge scores in run-1
      expect((await ops([scoreOp('a', 7, 'run-1')])).status).toBe(200);
      expect(Object.keys((await gs()).state.scoring.scores)).toEqual(['j1|a|i1']);

      // 2) operator starts a new run and pushes
      const newer = startNewRun((await gs()).state, { clearParticipants: false });
      expect((await call(req('PUT', '/api/state', { headers: admin, body: { state: newer } }))).status).toBe(200);
      const afterReset = await gs();
      expect(afterReset.state.scoring.runId).toBe('run-2');
      expect(afterReset.state.scoring.scores).toEqual({});
      expect(afterReset.state.runs).toHaveLength(1);

      // 3) a queued op stamped with the OLD run arrives late: rejected, nothing changes
      const late = await ops([scoreOp('b', 9, 'run-1')]);
      expect(late.status).toBe(200);
      const afterLate = await gs();
      expect(afterLate.state.scoring.scores).toEqual({});
      expect(afterLate.rev).toBe(afterReset.rev);

      // 4) an op stamped with the NEW run is accepted; the judge never receives the archive
      const fresh = await ops([scoreOp('b', 9, 'run-2')]);
      expect(Object.keys((await gs()).state.scoring.scores)).toEqual(['j1|b|i1']);
      expect((fresh.body as { state: AppState }).state.runs).toEqual([]);
    } finally {
      s.flush();
      fs.rmSync(dir2, { recursive: true, force: true });
    }
  });
});
