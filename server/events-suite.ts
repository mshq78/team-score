/** Shared checks for stores that host several events; run against the file store and Postgres. */
import { expect, it } from 'vitest';
import { ApiRequest, handleApi, type Store } from './core';
import { runningState } from '../src/testing/runFixture';

const ADMIN = 'test-admin-key-123456';
const config = { adminKey: ADMIN, mode: 'online' as const };

function req(method: string, pathname: string, opts: { headers?: Record<string, string>; body?: unknown; query?: string; ip?: string } = {}): ApiRequest {
  const headers = Object.fromEntries(Object.entries(opts.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return { method, pathname, query: new URLSearchParams(opts.query || ''), header: (n) => headers[n.toLowerCase()], json: async () => opts.body ?? {}, ip: opts.ip || '10.0.0.9' };
}
const admin = { 'X-Admin-Key': ADMIN };

export function eventsSuite(getStore: () => Store) {
  const call = (r: ApiRequest) => handleApi(r, getStore(), config);
  let second = '';

  it('lists the default event and requires the admin key', async () => {
    expect((await call(req('GET', '/api/events'))).status).toBe(401);
    const res = await call(req('GET', '/api/events', { headers: admin }));
    expect(res.status).toBe(200);
    const events = (res.body as { events: { id: string }[] }).events;
    expect(events.map((e) => e.id)).toContain('default');
  });

  it('creates and renames events; unknown or invalid ids are rejected', async () => {
    const created = await call(req('POST', '/api/events', { headers: admin, body: { name: '  بوت‌کمپ  دوم ' } }));
    expect(created.status).toBe(200);
    const ev = (created.body as { event: { id: string; name: string } }).event;
    expect(ev.name).toBe('بوت‌کمپ دوم');
    second = ev.id;
    expect((await call(req('POST', '/api/events/rename', { headers: admin, body: { id: second, name: 'شهر دوم' } }))).status).toBe(200);
    expect((await call(req('POST', '/api/events/rename', { headers: admin, body: { id: 'nope', name: 'x' } }))).status).toBe(404);
    expect((await call(req('POST', '/api/events', { headers: admin, body: { name: '  ' } }))).status).toBe(400);
    expect((await call(req('GET', '/api/state', { headers: admin, query: 'event=nope' }))).status).toBe(404);
    expect((await call(req('GET', '/api/state', { headers: admin, query: 'event=../x' }))).status).toBe(400);
  });

  it('deletes an event (not the default one) and its data', async () => {
    const created = await call(req('POST', '/api/events', { headers: admin, body: { name: 'موقت' } }));
    const id = (created.body as { event: { id: string } }).event.id;
    await call(req('PUT', '/api/state', { headers: admin, body: { state: runningState(false) }, query: `event=${id}` }));
    expect((await call(req('POST', '/api/events/delete', { body: { id } }))).status).toBe(401);
    expect((await call(req('POST', '/api/events/delete', { headers: admin, body: { id: 'default' } }))).status).toBe(400);
    expect((await call(req('POST', '/api/events/delete', { headers: admin, body: { id: 'nope' } }))).status).toBe(404);
    expect((await call(req('POST', '/api/events/delete', { headers: admin, body: { id } }))).status).toBe(200);
    expect((await call(req('GET', '/api/state', { headers: admin, query: `event=${id}` }))).status).toBe(404);
    const ids = ((await call(req('GET', '/api/events', { headers: admin }))).body as { events: { id: string }[] }).events.map((e) => e.id);
    expect(ids).not.toContain(id);
    expect(ids).toContain('default');
  });

  it('keeps state, revisions and judge codes separate per event', async () => {
    const a = runningState(true);
    const b = runningState(false);
    b.scoring.judges = [{ id: 'jb', name: 'داور دوم', accessCode: '7777', eventIds: [] }];
    b.scoring.runName = 'رویداد دوم';

    expect((await call(req('PUT', '/api/state', { headers: admin, body: { state: a } }))).status).toBe(200);
    expect((await call(req('PUT', '/api/state', { headers: admin, body: { state: b }, query: `event=${second}` }))).status).toBe(200);

    const ra = (await call(req('GET', '/api/state', { headers: admin }))).body as { state: typeof a };
    const rb = (await call(req('GET', '/api/state', { headers: admin, query: `event=${second}` }))).body as { state: typeof b };
    expect(ra.state.scoring.runName).toBe(a.scoring.runName);
    expect(Object.keys(ra.state.scoring.scores).length).toBeGreaterThan(0);
    expect(rb.state.scoring.runName).toBe('رویداد دوم');
    expect(Object.keys(rb.state.scoring.scores)).toHaveLength(0);

    // judge codes only work in their own event
    const loginA = (code: string, q = '') => call(req('POST', '/api/judge/login', { body: { code }, query: q, ip: `10.1.${Math.random()}` }));
    expect((await loginA('1111')).status).toBe(200);
    expect((await loginA('7777')).status).toBe(401);
    expect((await loginA('7777', `event=${second}`)).status).toBe(200);
    expect((await loginA('1111', `event=${second}`)).status).toBe(401);
  });
}
