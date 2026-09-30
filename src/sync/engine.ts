import { IS_OFFLINE } from '../offline/flag';
import { AppState } from '../store/state';
import { AppAction } from '../store/actions';
import { appReducer } from '../store/reducer';
import { JudgeOp, StaleRunError, isAppStateLike, mergeOperatorState, runIdOf, withRunDefaults } from './merge';

/**
 * Browser-side sync engine.
 *
 * Roles:
 * - 'admin': the operator laptop. Opened once with ?admin=KEY (the key is then
 *   remembered). Pushes its full state; receives judges' scores.
 * - 'judge': a judge's phone (?judge=1). Queues its own score/note changes in
 *   an outbox and sends them whenever the server is reachable.
 * - 'local': no server at all — the app works exactly as a standalone app.
 *
 * Everything is offline-first: the local state is always the source of what
 * is on screen, and nothing is lost while the server is unreachable.
 */

export type SyncRole = 'admin' | 'judge' | 'local';
export type SyncPhase = 'local' | 'connecting' | 'synced' | 'syncing' | 'offline' | 'unauthorized';

export interface SyncStatus {
  role: SyncRole;
  phase: SyncPhase;
  pending: number;
  lastSyncAt: number | null;
  serverMode: 'online' | 'offline' | null;
  /** One-off message for the user; the app shows it as a toast when noticeSeq changes */
  notice: string | null;
  noticeSeq: number;
}

export const STALE_RUN_NOTICE = 'اجرای جدیدتری روی سرور هست؛ اطلاعات از سرور بارگذاری شد';

const ADMIN_KEY_STORAGE = 'teamkeshi_admin_key';
const JUDGE_CODE_STORAGE = 'teamkeshi_judge_code';
const JUDGE_ID_STORAGE = 'teamkeshi_judge_id';
const OUTBOX_STORAGE = 'teamkeshi_judge_outbox';
const DIRTY_STORAGE = 'teamkeshi_sync_dirty';
const REV_STORAGE = 'teamkeshi_sync_rev';
const INSTANCE_STORAGE = 'teamkeshi_sync_instance';

export const OPERATOR_STATE_KEY = 'teamkeshi_state_v3';
export const JUDGE_STATE_KEY = 'teamkeshi_judge_state_v1';

const POLL_MS = 2000;
const PUSH_DEBOUNCE_MS = 400;
const REQUEST_TIMEOUT_MS = 8000;

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // storage unavailable — sync still works for this session
  }
}

/** Reads ?admin=KEY once, stores it and strips it from the address bar. */
function detectRole(): SyncRole {
  if (typeof window === 'undefined' || IS_OFFLINE) return 'local';
  const params = new URLSearchParams(window.location.search);
  if (params.get('judge') === '1') return 'judge';
  const adminParam = params.get('admin');
  if (adminParam) {
    lsSet(ADMIN_KEY_STORAGE, adminParam);
    params.delete('admin');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? `?${query}` : '') + window.location.hash);
  }
  return lsGet(ADMIN_KEY_STORAGE) ? 'admin' : 'local';
}

async function request(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method,
      headers: { ...headers, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data: data as Record<string, unknown> };
  } finally {
    clearTimeout(timer);
  }
}

type Replace = (state: AppState) => void;
type GetState = () => AppState;

class SyncEngine {
  readonly role: SyncRole = detectRole();
  private status: SyncStatus;
  private listeners = new Set<(s: SyncStatus) => void>();
  private getState: GetState | null = null;
  private replace: Replace | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private rev = Number(lsGet(REV_STORAGE)) || 0;
  private dirty = lsGet(DIRTY_STORAGE) === '1';
  private localVersion = 0;
  private outbox: JudgeOp[] = [];

  constructor() {
    try {
      const saved = JSON.parse(lsGet(OUTBOX_STORAGE) || '[]');
      if (Array.isArray(saved)) this.outbox = saved;
    } catch {
      this.outbox = [];
    }
    this.status = {
      role: this.role,
      phase: this.role === 'local' ? 'local' : 'connecting',
      pending: this.pendingCount(),
      lastSyncAt: null,
      serverMode: null,
      notice: null,
      noticeSeq: 0,
    };
  }

  /** localStorage key the app state is persisted under for this role. */
  get stateStorageKey(): string {
    return this.role === 'judge' ? JUDGE_STATE_KEY : OPERATOR_STATE_KEY;
  }

  get judgeCode(): string | null {
    return lsGet(JUDGE_CODE_STORAGE);
  }
  get judgeId(): string | null {
    return lsGet(JUDGE_ID_STORAGE);
  }

  subscribe(fn: (s: SyncStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }
  getStatus(): SyncStatus {
    return this.status;
  }

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch, pending: this.pendingCount() };
    for (const fn of this.listeners) fn(this.status);
  }

  private pendingCount(): number {
    if (this.role === 'judge') return this.outbox.length;
    if (this.role === 'admin') return this.dirty ? 1 : 0;
    return 0;
  }

  private started = false;
  private resolveReady: () => void = () => {};
  private ready = new Promise<void>((resolve) => {
    this.resolveReady = resolve;
  });

  start(getState: GetState, replace: Replace) {
    this.getState = getState;
    this.replace = replace;
    this.resolveReady();
    if (this.role === 'local' || this.started) return;
    this.started = true;
    window.addEventListener('online', () => this.kick(0));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.kick(0);
    });
    this.kick(0);
  }

  /** Called for every action the user dispatches (never for remote updates). */
  onLocalAction(action: AppAction) {
    if (this.role === 'admin') {
      if (action.type === 'IMPORT_BACKUP' && action.payload.fromSync) return;
      this.dirty = true;
      this.localVersion += 1;
      lsSet(DIRTY_STORAGE, '1');
      this.setStatus({});
      this.kick(PUSH_DEBOUNCE_MS);
    } else if (this.role === 'judge') {
      // Stamp with the run the judge is looking at, so a late upload can never
      // land in a run that started afterwards.
      const runId = this.getState ? runIdOf(this.getState()) : undefined;
      if (action.type === 'SET_SCORE') {
        const { source: _source, ...entry } = action.payload;
        void _source;
        this.enqueue({ kind: 'score', entry, runId });
      } else if (action.type === 'SET_NOTE' || action.type === 'SET_SCORE_NOTE') {
        this.enqueue({ kind: 'note', note: { ...action.payload }, runId });
      }
    }
  }

  private enqueue(op: JudgeOp) {
    // Only the latest change per cell matters
    const key = op.kind === 'score'
      ? `s|${op.entry.teamId}|${op.entry.indicatorId}`
      : `n|${op.note.teamId}|${op.note.eventId}`;
    this.outbox = this.outbox.filter((o) =>
      (o.kind === 'score' ? `s|${o.entry.teamId}|${o.entry.indicatorId}` : `n|${o.note.teamId}|${o.note.eventId}`) !== key
    );
    this.outbox.push(op);
    lsSet(OUTBOX_STORAGE, JSON.stringify(this.outbox));
    this.setStatus({});
    this.kick(PUSH_DEBOUNCE_MS);
  }

  private kick(delay: number) {
    if (this.role === 'local') return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), delay);
  }

  private async tick() {
    if (this.inFlight) {
      this.kick(PUSH_DEBOUNCE_MS);
      return;
    }
    this.inFlight = true;
    try {
      if (this.role === 'admin') await this.tickAdmin();
      else if (this.role === 'judge') await this.tickJudge();
    } catch {
      this.setStatus({ phase: 'offline' });
    } finally {
      this.inFlight = false;
      // Poll less often while hidden or offline
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      this.kick(this.status.phase === 'offline' || hidden ? POLL_MS * 3 : POLL_MS);
    }
  }

  private markSynced(rev: number, serverMode?: unknown) {
    this.rev = rev;
    lsSet(REV_STORAGE, String(rev));
    this.setStatus({
      phase: 'synced',
      lastSyncAt: Date.now(),
      serverMode: serverMode === 'offline' || serverMode === 'online' ? serverMode : this.status.serverMode,
    });
  }

  // ------------------------------------------------------------ operator
  private adminHeaders() {
    return { 'X-Admin-Key': lsGet(ADMIN_KEY_STORAGE) || '' };
  }

  private async tickAdmin() {
    if (!this.getState || !this.replace) return;
    if (this.status.serverMode === null) {
      const health = await request('GET', '/api/health', {});
      if (health.status !== 200) throw new Error('health_failed');
      const instanceId = String(health.data.instanceId || '');
      const knownInstance = lsGet(INSTANCE_STORAGE);
      if (knownInstance && knownInstance !== instanceId) {
        // Different server (e.g. switched between online and laptop): leftovers
        // from the previous one must not overwrite this server's data.
        this.dirty = false;
        lsSet(DIRTY_STORAGE, null);
        this.rev = 0;
      }
      lsSet(INSTANCE_STORAGE, instanceId);
      this.setStatus({ serverMode: health.data.mode === 'offline' ? 'offline' : 'online' });
    }

    if (this.dirty) {
      this.setStatus({ phase: 'syncing' });
      const sentVersion = this.localVersion;
      const res = await request('PUT', '/api/state', this.adminHeaders(), { state: this.getState() });
      if (res.status === 401) return this.setStatus({ phase: 'unauthorized' });
      if (res.status === 409 && res.data.error === 'stale_run') return this.adoptServerAfterStaleRun();
      if (res.status !== 200 || !isAppStateLike(res.data.state)) throw new Error('push_failed');
      const serverState = withRunDefaults(res.data.state);
      if (this.localVersion === sentVersion) {
        this.dirty = false;
        lsSet(DIRTY_STORAGE, null);
        this.replace(serverState);
      } else {
        // The user kept editing while we were pushing: keep their newer edits
        try {
          this.replace(mergeOperatorState(serverState, this.getState()));
        } catch (e) {
          if (!(e instanceof StaleRunError)) throw e;
          this.replace(serverState);
        }
      }
      this.markSynced(Number(res.data.rev));
      return;
    }

    const res = await request('GET', `/api/state?rev=${this.rev}`, this.adminHeaders());
    if (res.status === 401) return this.setStatus({ phase: 'unauthorized' });
    if (res.status !== 200) throw new Error('pull_failed');
    if (res.data.state === null) {
      // Fresh server: seed it with this laptop's data
      this.dirty = true;
      this.kick(0);
      return;
    }
    if (!res.data.unchanged && isAppStateLike(res.data.state) && !this.dirty) {
      this.replace(withRunDefaults(res.data.state));
    }
    this.markSynced(Number(res.data.rev));
  }

  /** The server is already on a newer run: drop local edits and take the server's state. */
  private async adoptServerAfterStaleRun() {
    const res = await request('GET', '/api/state', this.adminHeaders());
    if (res.status !== 200 || !isAppStateLike(res.data.state) || !this.replace) throw new Error('pull_failed');
    this.dirty = false;
    lsSet(DIRTY_STORAGE, null);
    this.replace(withRunDefaults(res.data.state));
    this.markSynced(Number(res.data.rev));
    this.setStatus({ notice: STALE_RUN_NOTICE, noticeSeq: this.status.noticeSeq + 1 });
  }

  // ------------------------------------------------------------ judge
  /** Logs a judge in against the server. Returns an error message or null. */
  async loginJudge(code: string): Promise<string | null> {
    // A QR auto-login can fire before the store has started the engine
    await this.ready;
    if (!this.replace) return 'سامانه هنوز آماده نیست';
    try {
      const res = await request('POST', '/api/judge/login', {}, { code });
      if (res.status === 401) return 'کد داوری نامعتبر است';
      if (res.status === 429) return 'تلاش‌های ناموفق زیاد بود؛ یک دقیقه صبر کنید';
      if (res.status === 503) return 'اپراتور هنوز اطلاعات مسابقه را روی سرور بارگذاری نکرده است';
      if (res.status !== 200 || !isAppStateLike(res.data.state)) return 'ارتباط با سرور برقرار نشد';
      lsSet(JUDGE_CODE_STORAGE, code);
      lsSet(JUDGE_ID_STORAGE, String(res.data.judgeId));
      this.replace(this.adoptServerState(res.data.state));
      this.markSynced(Number(res.data.rev));
      this.kick(POLL_MS);
      return null;
    } catch {
      this.setStatus({ phase: 'offline' });
      return 'ارتباط با سرور برقرار نشد. اتصال اینترنت/وای‌فای را بررسی کنید';
    }
  }

  logoutJudge() {
    lsSet(JUDGE_CODE_STORAGE, null);
    lsSet(JUDGE_ID_STORAGE, null);
    // Unsent scores are kept in the outbox and sent after the next login
  }

  private async tickJudge() {
    if (!this.getState || !this.replace) return;
    const code = this.judgeCode;
    if (!code) {
      this.setStatus({ phase: 'connecting' });
      return;
    }
    const headers = { 'X-Judge-Code': code };

    if (this.outbox.length > 0) {
      this.setStatus({ phase: 'syncing' });
      const sending = [...this.outbox];
      const res = await request('POST', '/api/judge/ops', headers, { ops: sending });
      if (res.status === 401) return this.setStatus({ phase: 'unauthorized' });
      if (res.status !== 200 || !isAppStateLike(res.data.state)) throw new Error('push_failed');
      // Drop exactly the ops that were sent (newer edits to the same cell stay queued)
      this.outbox = this.outbox.filter((o) => !sending.includes(o));
      lsSet(OUTBOX_STORAGE, JSON.stringify(this.outbox));
      this.replace(this.adoptServerState(res.data.state));
      this.markSynced(Number(res.data.rev));
      return;
    }

    const res = await request('GET', `/api/judge/state?rev=${this.rev}`, headers);
    if (res.status === 401) return this.setStatus({ phase: 'unauthorized' });
    if (res.status !== 200) throw new Error('pull_failed');
    if (!res.data.unchanged && isAppStateLike(res.data.state)) {
      this.replace(this.adoptServerState(res.data.state));
    }
    this.markSynced(Number(res.data.rev));
  }

  /**
   * Takes a server snapshot as the judge's local state. If it belongs to a
   * different run than the local one, the whole pending queue is dropped (it
   * can only contain scores of the finished run); otherwise queued ops that
   * are still unacknowledged are re-applied on top of it.
   */
  private adoptServerState(serverState: AppState): AppState {
    const state = withRunDefaults(serverState);
    const serverRun = runIdOf(state);
    const local = this.getState ? this.getState() : null;
    const runChanged = !!local && runIdOf(local) !== serverRun;
    const keep = runChanged ? [] : this.outbox.filter((op) => op.runId === undefined || op.runId === serverRun);
    if (keep.length !== this.outbox.length) {
      this.outbox = keep;
      lsSet(OUTBOX_STORAGE, JSON.stringify(this.outbox));
      this.setStatus({});
    }
    let next = state;
    for (const op of this.outbox) {
      next = op.kind === 'score'
        ? appReducer(next, { type: 'SET_SCORE', payload: { ...op.entry, source: 'judge' } })
        : appReducer(next, { type: 'SET_NOTE', payload: op.note });
    }
    return next;
  }

  // ------------------------------------------------------------ helpers for UI
  async fetchServerInfo(): Promise<{ mode: string; lanUrls: string[] } | null> {
    if (this.role !== 'admin') return null;
    try {
      const res = await request('GET', '/api/info', this.adminHeaders());
      if (res.status !== 200) return null;
      return { mode: String(res.data.mode), lanUrls: (res.data.lanUrls as string[]) || [] };
    } catch {
      return null;
    }
  }
}

export const syncEngine = new SyncEngine();
