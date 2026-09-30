/**
 * Single-process store for the Node server (operator laptop or a VPS):
 * state in memory, persisted to DATA_DIR/state.json with atomic writes and
 * rolling backups in DATA_DIR/backups/.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AppState } from '../src/store/state';
import { isAppStateLike } from '../src/sync/merge';
import {
  DEFAULT_EVENT_ID,
  DEFAULT_EVENT_NAME,
  LOGIN_BLOCK_MS,
  LOGIN_MAX_FAILURES,
  type EventMeta,
  type EventStore,
  type Store,
  type StoredState,
} from './core';

const BACKUP_EVERY_MS = 5 * 60 * 1000;
const BACKUPS_TO_KEEP = 60;

export interface FileStore extends EventStore {
  /** Seeds an empty store (e.g. from a backup file). Returns false if data already exists. */
  seed(state: AppState): boolean;
  hasState(): boolean;
  flush(): void;
}

/** One event's state on disk: <dir>/state.json plus rolling backups in <dir>/backups/. */
interface EventFile {
  load(): StoredState | null;
  compareAndSwap(expectedRev: number, state: AppState): number | null;
  seed(state: AppState): boolean;
  flush(): void;
}

function createEventFile(dir: string): EventFile {
  fs.mkdirSync(path.join(dir, 'backups'), { recursive: true });
  const stateFile = path.join(dir, 'state.json');

  let current: StoredState | null = null;
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (isAppStateLike(saved.state)) current = { rev: Number(saved.rev) || 1, state: saved.state };
  } catch {
    // first run
  }

  const flush = () => {
    if (!current) return;
    const tmp = stateFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(current));
    fs.renameSync(tmp, stateFile);
  };
  let timer: NodeJS.Timeout | null = null;
  const persistSoon = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, 200);
  };

  let lastBackupRev = -1;
  setInterval(() => {
    if (!current || current.rev === lastBackupRev) return;
    lastBackupRev = current.rev;
    const backups = path.join(dir, 'backups');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(backups, `state-${stamp}.json`), JSON.stringify(current));
    const files = fs.readdirSync(backups).sort();
    for (const f of files.slice(0, Math.max(0, files.length - BACKUPS_TO_KEEP))) {
      fs.rmSync(path.join(backups, f), { force: true });
    }
  }, BACKUP_EVERY_MS).unref();

  return {
    load: () => current,
    compareAndSwap(expectedRev, state) {
      if ((current ? current.rev : 0) !== expectedRev) return null;
      current = { rev: expectedRev + 1, state };
      persistSoon();
      return current.rev;
    },
    seed(state) {
      if (current) return false;
      current = { rev: 1, state };
      flush();
      return true;
    },
    flush() {
      if (timer) clearTimeout(timer);
      timer = null;
      flush();
    },
  };
}

/**
 * The default event keeps its files at the top of dataDir (as before events existed);
 * other events live in dataDir/events/<id>/, listed in dataDir/events.json.
 */
export function createFileStore(dataDir: string): FileStore {
  fs.mkdirSync(dataDir, { recursive: true });
  const instanceFile = path.join(dataDir, 'instance-id.txt');
  const eventsFile = path.join(dataDir, 'events.json');

  let instance = '';
  try {
    instance = fs.readFileSync(instanceFile, 'utf8').trim();
  } catch {
    // created below
  }
  if (!instance) {
    instance = crypto.randomBytes(8).toString('hex');
    fs.writeFileSync(instanceFile, instance + '\n');
  }

  let extra: EventMeta[] = [];
  try {
    const saved = JSON.parse(fs.readFileSync(eventsFile, 'utf8'));
    if (Array.isArray(saved)) extra = saved;
  } catch {
    // no extra events yet
  }
  let defaultName = DEFAULT_EVENT_NAME;
  try {
    const n = JSON.parse(fs.readFileSync(path.join(dataDir, 'default-event.json'), 'utf8'))?.name;
    if (typeof n === 'string' && n) defaultName = n;
  } catch {
    // keep the default name
  }
  const saveEvents = () => fs.writeFileSync(eventsFile, JSON.stringify(extra));

  const files = new Map<string, EventFile>();
  const fileFor = (id: string) => {
    let f = files.get(id);
    if (!f) {
      f = createEventFile(id === DEFAULT_EVENT_ID ? dataDir : path.join(dataDir, 'events', id));
      files.set(id, f);
    }
    return f;
  };

  const failures = new Map<string, { count: number; until: number }>();

  const scoped = (id: string): Store => {
    const file = () => fileFor(id);
    return {
      async getRev() {
        return file().load()?.rev ?? null;
      },
      async load() {
        return file().load();
      },
      async loadJudges() {
        const c = file().load();
        return c ? { rev: c.rev, judges: c.state.scoring.judges } : null;
      },
      async compareAndSwap(expectedRev, state) {
        return file().compareAndSwap(expectedRev, state);
      },
      async instanceId() {
        return instance;
      },
      async isLoginBlocked(ip) {
        const f = failures.get(ip);
        return !!f && f.count >= LOGIN_MAX_FAILURES && f.until > Date.now();
      },
      async recordLoginFailure(ip) {
        const f = failures.get(ip);
        const now = Date.now();
        if (!f || f.until < now) failures.set(ip, { count: 1, until: now + LOGIN_BLOCK_MS });
        else f.count += 1;
      },
      async clearLoginFailures(ip) {
        failures.delete(ip);
      },
    };
  };

  const defaultMeta = (): EventMeta => ({ id: DEFAULT_EVENT_ID, name: defaultName, createdAt: '' });

  return {
    ...scoped(DEFAULT_EVENT_ID),
    forEvent: scoped,
    async eventExists(id) {
      return id === DEFAULT_EVENT_ID || extra.some((e) => e.id === id);
    },
    async listEvents() {
      return [defaultMeta(), ...extra];
    },
    async createEvent(name) {
      const event: EventMeta = { id: crypto.randomBytes(4).toString('hex'), name, createdAt: new Date().toISOString() };
      extra.push(event);
      saveEvents();
      return event;
    },
    async deleteEvent(id) {
      if (id === DEFAULT_EVENT_ID) return false;
      const i = extra.findIndex((e) => e.id === id);
      if (i < 0) return false;
      extra.splice(i, 1);
      saveEvents();
      const f = files.get(id);
      if (f) f.flush();
      files.delete(id);
      // moved aside instead of erased, so an accidental delete can be recovered by hand
      const from = path.join(dataDir, 'events', id);
      if (fs.existsSync(from)) {
        const to = path.join(dataDir, 'events-deleted');
        fs.mkdirSync(to, { recursive: true });
        fs.renameSync(from, path.join(to, `${id}-${Date.now()}`));
      }
      return true;
    },
    async renameEvent(id, name) {
      if (id === DEFAULT_EVENT_ID) {
        defaultName = name;
        fs.writeFileSync(path.join(dataDir, 'default-event.json'), JSON.stringify({ name }));
        return defaultMeta();
      }
      const event = extra.find((e) => e.id === id);
      if (!event) return null;
      event.name = name;
      saveEvents();
      return event;
    },
    seed(state) {
      return fileFor(DEFAULT_EVENT_ID).seed(state);
    },
    hasState() {
      return fileFor(DEFAULT_EVENT_ID).load() !== null;
    },
    flush() {
      for (const f of files.values()) f.flush();
    },
  };
}
