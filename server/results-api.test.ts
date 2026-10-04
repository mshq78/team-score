import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ApiRequest, handleApi } from './core';
import { createFileStore } from './store-file';
import { runningState } from '../src/testing/runFixture';
import type { AppState } from '../src/store/state';

const ADMIN = 'test-admin-key-123456';
const TOKEN = 'abcdef123456ghij';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamkeshi-results-'));
const store = createFileStore(dir);
const config = { adminKey: ADMIN, mode: 'online' as const };
afterAll(() => {
  store.flush();
  fs.rmSync(dir, { recursive: true, force: true });
});

const req = (method: string, pathname: string, query = '', body?: unknown, headers: Record<string, string> = {}): ApiRequest => ({
  method, pathname, query: new URLSearchParams(query), header: (n) => headers[n.toLowerCase()], json: async () => body ?? {}, ip: '10.0.0.5',
});
const put = (state: AppState, query = '') => handleApi(req('PUT', '/api/state', query, { state }, { 'x-admin-key': ADMIN }), store, config);
const results = (query: string) => handleApi(req('GET', '/api/results', query), store, config);

describe('public results link', () => {
  const state = runningState(true);

  it('is closed until the operator enables it, and a wrong token looks the same', async () => {
    await put(state);
    expect((await results('token=' + TOKEN)).status).toBe(404);
    await put({ ...state, scoring: { ...state.scoring, settings: { ...state.scoring.settings, publicToken: TOKEN } } });
    expect((await results('')).status).toBe(404);
    expect((await results('token=wrong-token-123456')).status).toBe(404);
    expect((await results('token=' + TOKEN + '&event=nope')).status).toBe(404);
  });

  it('serves only team results, in the entered points, without secrets', async () => {
    const res = await results('token=' + TOKEN);
    expect(res.status).toBe(200);
    const body = res.body as { teams: { name: string; total: number; rank: number }[]; totalMax: number; frozen: boolean };
    expect(body.totalMax).toBe(10); // the fixture's single indicator is 0–10
    expect(body.teams.map((t) => t.rank)).toEqual([1, 2]);
    const text = JSON.stringify(res.body);
    for (const secret of ['accessCode', '1111', 'phone', 'notes', 'judgeId', 'publicToken', TOKEN]) expect(text).not.toContain(secret);
  });

  it('works per event and can be switched off again', async () => {
    const created = await handleApi(req('POST', '/api/events', '', { name: 'دوم' }, { 'x-admin-key': ADMIN }), store, config);
    const id = (created.body as { event: { id: string } }).event.id;
    await put({ ...state, scoring: { ...state.scoring, settings: { ...state.scoring.settings, publicToken: 'second-event-token-1' } } }, 'event=' + id);
    expect((await results(`token=${TOKEN}&event=${id}`)).status).toBe(404); // the other event's token
    const ok = await results(`token=second-event-token-1&event=${id}`);
    expect(ok.status).toBe(200);
    expect((ok.body as { eventName: string }).eventName).toBe('دوم');
    await put({ ...state, scoring: { ...state.scoring, settings: { ...state.scoring.settings, publicToken: '' } } });
    expect((await results('token=' + TOKEN)).status).toBe(404);
  });
});
