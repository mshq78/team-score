import { describe, it, expect, vi } from 'vitest';
import { createServerEvent, pushState, stateHash } from './pushToServer';
import { INITIAL_STATE } from '../store/state';

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
const lastCall = (f: typeof fetch) => (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];

describe('pushState', () => {
  it('PUTs the state to the chosen event with the admin key', async () => {
    const f = reply(200, { rev: 7 });
    expect(await pushState('https://x.app/', ' k ', 'abc', INITIAL_STATE, f)).toEqual({ ok: true, rev: 7 });
    const [url, init] = lastCall(f);
    expect(url).toBe('https://x.app/api/state?event=abc');
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>)['x-admin-key']).toBe('k');
    expect(JSON.parse(String(init.body)).state.schemaVersion).toBe(4);
  });
  it('uses no query for the default event', async () => {
    const f = reply(200, { rev: 1 });
    await pushState('https://x.app', 'k', 'default', INITIAL_STATE, f);
    expect(lastCall(f)[0]).toBe('https://x.app/api/state');
  });
  it('maps offline, 401, 409, 404 to Persian messages', async () => {
    const down = vi.fn(async () => { throw new TypeError('x'); }) as unknown as typeof fetch;
    expect(await pushState('https://x.app', 'k', 'a', INITIAL_STATE, down)).toMatchObject({ ok: false, error: expect.stringContaining('ذخیره است') });
    expect(await pushState('https://x.app', 'k', 'a', INITIAL_STATE, reply(401, {}))).toMatchObject({ error: expect.stringContaining('۴۰۱') });
    expect(await pushState('https://x.app', 'k', 'a', INITIAL_STATE, reply(409, { error: 'stale_run' }))).toMatchObject({ error: expect.stringContaining('جدیدتری') });
    expect(await pushState('https://x.app', 'k', 'a', INITIAL_STATE, reply(404, {}))).toMatchObject({ error: expect.stringContaining('پیدا نشد') });
  });
});

describe('createServerEvent / stateHash', () => {
  it('creates an event', async () => {
    const f = reply(200, { event: { id: 'e1', name: 'ب' } });
    expect(await createServerEvent('https://x.app', 'k', 'ب', f)).toEqual({ ok: true, event: { id: 'e1', name: 'ب' } });
    expect(lastCall(f)[0]).toBe('https://x.app/api/events');
  });
  it('hash changes with the state', () => {
    expect(stateHash(INITIAL_STATE)).toBe(stateHash({ ...INITIAL_STATE }));
    expect(stateHash(INITIAL_STATE)).not.toBe(stateHash({ ...INITIAL_STATE, participants: [] }));
  });
});
