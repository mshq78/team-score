import { describe, it, expect, vi } from 'vitest';
import { fetchServerScores, normalizeServerUrl } from './serverScores';
import { INITIAL_STATE } from '../store/state';

const reply = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('fetchServerScores', () => {
  it('normalizes urls', () => {
    expect(normalizeServerUrl('localhost:3000/')).toBe('http://localhost:3000');
    expect(normalizeServerUrl('x.vercel.app/api')).toBe('https://x.vercel.app');
  });
  it('sends a single GET with the admin key', async () => {
    const f = reply(200, { rev: 1, state: INITIAL_STATE });
    const r = await fetchServerScores('https://x.app', ' k ', f);
    expect(r.ok).toBe(true);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://x.app/api/state');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['x-admin-key']).toBe('k');
  });
  it('maps 401, empty state, network error', async () => {
    expect(await fetchServerScores('https://x.app', 'k', reply(401, {}))).toMatchObject({ ok: false, error: expect.stringContaining('۴۰۱') });
    expect(await fetchServerScores('https://x.app', 'k', reply(200, { rev: 0, state: null }))).toMatchObject({ ok: false, error: expect.stringContaining('خالی') });
    const down = vi.fn(async () => { throw new TypeError('fail'); }) as unknown as typeof fetch;
    expect(await fetchServerScores('https://x.app', 'k', down)).toMatchObject({ ok: false, error: expect.stringContaining('اتصال') });
  });
});
