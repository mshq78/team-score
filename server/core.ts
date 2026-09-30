/**
 * Storage-agnostic sync API, shared by:
 * - api/index.ts      (Vercel serverless function + Neon Postgres)
 * - server/server.ts  (Node server on a VPS or the operator laptop + JSON file)
 */
import crypto from 'node:crypto';
import type { AppState } from '../src/store/state';
import type { Judge } from '../src/types';
import {
  type JudgeOp,
  applyJudgeOps,
  StaleRunError,
  isAppStateLike,
  mergeOperatorState,
  redactForJudge,
} from '../src/sync/merge.js';

export interface StoredState {
  rev: number;
  state: AppState;
}

export interface Store {
  /** Current revision, or null when no event data has been uploaded yet. */
  getRev(): Promise<number | null>;
  load(): Promise<StoredState | null>;
  /** Cheap read for polling judges: revision + judge list only. */
  loadJudges(): Promise<{ rev: number; judges: Judge[] } | null>;
  /**
   * Atomically replaces the state if the stored revision still equals
   * `expectedRev` (0 = nothing stored yet). Returns the new revision, or null
   * when someone else wrote first (the caller retries).
   */
  compareAndSwap(expectedRev: number, state: AppState): Promise<number | null>;
  instanceId(): Promise<string>;
  isLoginBlocked(ip: string): Promise<boolean>;
  recordLoginFailure(ip: string): Promise<void>;
  clearLoginFailures(ip: string): Promise<void>;
}

export const DEFAULT_EVENT_ID = 'default';
export const DEFAULT_EVENT_NAME = 'رویداد اصلی';
const EVENT_ID_RE = /^[a-z0-9_-]{1,40}$/i;

export interface EventMeta {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * A store that hosts several independent events (bootcamps). The Store methods
 * of the hub itself act on the default event; `forEvent` gives an event-scoped
 * Store. Plain Stores (single event) keep working: they serve only 'default'.
 */
export interface EventStore extends Store {
  forEvent(eventId: string): Store;
  eventExists(eventId: string): Promise<boolean>;
  listEvents(): Promise<EventMeta[]>;
  createEvent(name: string): Promise<EventMeta>;
  renameEvent(eventId: string, name: string): Promise<EventMeta | null>;
}

const isEventStore = (s: Store): s is EventStore => typeof (s as EventStore).forEvent === 'function';

export function cleanEventName(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
}

export interface ApiRequest {
  method: string;
  pathname: string;
  query: URLSearchParams;
  /** Lower-cased header lookup */
  header(name: string): string | undefined;
  /** Parsed JSON body ({} when empty); throws on invalid JSON */
  json(): Promise<unknown>;
  ip: string;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface ApiConfig {
  adminKey: string;
  mode: 'online' | 'offline';
  /** Extra info for the operator (LAN addresses on the laptop server) */
  info?: () => Record<string, unknown>;
}

export const LOGIN_MAX_FAILURES = 8;
export const LOGIN_BLOCK_MS = 60_000;

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function findJudgeIdIn(judges: Judge[], code: unknown): string | null {
  if (typeof code !== 'string' || !code.trim()) return null;
  const judge = judges.find((j) => safeEqual(String(j.accessCode), code.trim()));
  return judge ? judge.id : null;
}

function findJudgeId(state: AppState, code: unknown): string | null {
  return findJudgeIdIn(state.scoring.judges, code);
}

/** Read-modify-write with optimistic concurrency (safe across serverless instances). */
async function mutate(
  store: Store,
  fn: (current: AppState | null) => AppState | null
): Promise<StoredState | null> {
  for (let attempt = 0; attempt < 25; attempt++) {
    if (attempt > 0) {
      // Randomized backoff so simultaneous writers stop colliding
      await new Promise((r) => setTimeout(r, Math.random() * 20 * Math.min(attempt, 8)));
    }
    const current = await store.load();
    const next = fn(current ? current.state : null);
    if (!next) return current;
    if (current && next === current.state) return current;
    const rev = await store.compareAndSwap(current ? current.rev : 0, next);
    if (rev !== null) return { rev, state: next };
  }
  // The caller keeps its change queued and retries, so nothing is lost
  throw new Error('busy');
}

const ok = (body: unknown): ApiResponse => ({ status: 200, body });
const err = (status: number, error: string): ApiResponse => ({ status, body: { error } });

export async function handleApi(req: ApiRequest, hub: Store, config: ApiConfig): Promise<ApiResponse> {
  const route = `${req.method} ${req.pathname}`;
  const sinceRev = Number(req.query.get('rev'));

  if (route === 'GET /api/health') {
    const rev = await hub.getRev();
    return ok({ ok: true, mode: config.mode, rev: rev ?? 0, ready: rev !== null, instanceId: await hub.instanceId() });
  }

  // ---------------------------------------------------------------- events (operator)
  if (req.pathname === '/api/events' || req.pathname === '/api/events/rename') {
    const key = req.header('x-admin-key');
    if (!config.adminKey) return err(500, 'admin_key_not_configured');
    if (!key || !safeEqual(key, config.adminKey)) return err(401, 'unauthorized');
    if (route === 'GET /api/events') {
      const events = isEventStore(hub)
        ? await hub.listEvents()
        : [{ id: DEFAULT_EVENT_ID, name: DEFAULT_EVENT_NAME, createdAt: '' }];
      return ok({ events });
    }
    if (!isEventStore(hub)) return err(501, 'events_not_supported');
    const body = (await req.json()) as { id?: unknown; name?: unknown };
    const name = cleanEventName(body.name);
    if (!name) return err(400, 'invalid_name');
    if (route === 'POST /api/events') return ok({ event: await hub.createEvent(name) });
    if (route === 'POST /api/events/rename') {
      const event = typeof body.id === 'string' ? await hub.renameEvent(body.id, name) : null;
      return event ? ok({ event }) : err(404, 'unknown_event');
    }
  }

  // Every other route works on one event (default when no ?event= is given)
  const eventId = (req.query.get('event') || DEFAULT_EVENT_ID).trim();
  if (!EVENT_ID_RE.test(eventId)) return err(400, 'invalid_event');
  let store: Store = hub;
  if (isEventStore(hub)) {
    if (eventId !== DEFAULT_EVENT_ID && !(await hub.eventExists(eventId))) return err(404, 'unknown_event');
    store = hub.forEvent(eventId);
  } else if (eventId !== DEFAULT_EVENT_ID) {
    return err(404, 'unknown_event');
  }

  // ---------------------------------------------------------------- operator
  if (req.pathname === '/api/state' || req.pathname === '/api/info') {
    const key = req.header('x-admin-key');
    if (!config.adminKey) return err(500, 'admin_key_not_configured');
    if (!key || !safeEqual(key, config.adminKey)) return err(401, 'unauthorized');

    if (route === 'GET /api/info') {
      return ok({ mode: config.mode, lanUrls: [], ...(config.info ? config.info() : {}) });
    }
    if (route === 'GET /api/state') {
      const rev = await store.getRev();
      if (rev === null) return ok({ rev: 0, state: null });
      if (sinceRev === rev) return ok({ rev, unchanged: true });
      const current = await store.load();
      return ok(current ? { rev: current.rev, state: current.state } : { rev: 0, state: null });
    }
    if (route === 'PUT /api/state') {
      const body = (await req.json()) as { state?: unknown };
      const incoming = body.state;
      if (!isAppStateLike(incoming)) return err(400, 'invalid_state');
      try {
        const result = await mutate(store, (current) => (current ? mergeOperatorState(current, incoming) : incoming));
        return ok(result);
      } catch (e) {
        // The operator is still on a run that the server has already moved past
        if (e instanceof StaleRunError) return err(409, 'stale_run');
        throw e;
      }
    }
  }

  // ---------------------------------------------------------------- judges
  if (route === 'POST /api/judge/login') {
    if (await store.isLoginBlocked(req.ip)) return err(429, 'too_many_attempts');
    const current = await store.load();
    if (!current) return err(503, 'not_ready');
    const body = (await req.json()) as { code?: unknown };
    const judgeId = findJudgeId(current.state, body.code);
    if (!judgeId) {
      await store.recordLoginFailure(req.ip);
      return err(401, 'invalid_code');
    }
    await store.clearLoginFailures(req.ip);
    return ok({ judgeId, rev: current.rev, state: redactForJudge(current.state, judgeId) });
  }

  if (req.pathname === '/api/judge/state' || req.pathname === '/api/judge/ops') {
    const code = req.header('x-judge-code');

    if (route === 'GET /api/judge/state') {
      const meta = await store.loadJudges();
      if (!meta) return err(503, 'not_ready');
      const judgeId = findJudgeIdIn(meta.judges, code);
      if (!judgeId) return err(401, 'invalid_code');
      if (sinceRev === meta.rev) return ok({ rev: meta.rev, unchanged: true });
      const current = await store.load();
      if (!current) return err(503, 'not_ready');
      return ok({ rev: current.rev, state: redactForJudge(current.state, judgeId) });
    }

    if (route === 'POST /api/judge/ops') {
      const body = (await req.json()) as { ops?: unknown };
      if (!Array.isArray(body.ops)) return err(400, 'invalid_ops');
      const ops = body.ops as JudgeOp[];
      let judgeId: string | null = null;
      const result = await mutate(store, (current) => {
        if (!current) return null;
        judgeId = findJudgeId(current, code);
        return judgeId ? applyJudgeOps(current, judgeId, ops) : null;
      });
      if (!result) return err(503, 'not_ready');
      if (!judgeId) return err(401, 'invalid_code');
      return ok({ rev: result.rev, state: redactForJudge(result.state, judgeId) });
    }
  }

  return err(404, 'not_found');
}
