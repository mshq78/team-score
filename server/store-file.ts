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
import { LOGIN_BLOCK_MS, LOGIN_MAX_FAILURES, Store, StoredState } from './core';

const BACKUP_EVERY_MS = 5 * 60 * 1000;
const BACKUPS_TO_KEEP = 60;

export interface FileStore extends Store {
  /** Seeds an empty store (e.g. from a backup file). Returns false if data already exists. */
  seed(state: AppState): boolean;
  hasState(): boolean;
  flush(): void;
}

export function createFileStore(dataDir: string): FileStore {
  fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true });
  const stateFile = path.join(dataDir, 'state.json');
  const instanceFile = path.join(dataDir, 'instance-id.txt');

  let current: StoredState | null = null;
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (isAppStateLike(saved.state)) current = { rev: Number(saved.rev) || 1, state: saved.state };
  } catch {
    // first run
  }

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
    const dir = path.join(dataDir, 'backups');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(dir, `state-${stamp}.json`), JSON.stringify(current));
    const files = fs.readdirSync(dir).sort();
    for (const f of files.slice(0, Math.max(0, files.length - BACKUPS_TO_KEEP))) {
      fs.rmSync(path.join(dir, f), { force: true });
    }
  }, BACKUP_EVERY_MS).unref();

  const failures = new Map<string, { count: number; until: number }>();

  return {
    async getRev() {
      return current ? current.rev : null;
    },
    async load() {
      return current;
    },
    async loadJudges() {
      return current ? { rev: current.rev, judges: current.state.scoring.judges } : null;
    },
    async compareAndSwap(expectedRev, state) {
      if ((current ? current.rev : 0) !== expectedRev) return null;
      current = { rev: expectedRev + 1, state };
      persistSoon();
      return current.rev;
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
    seed(state) {
      if (current) return false;
      current = { rev: 1, state };
      flush();
      return true;
    },
    hasState() {
      return current !== null;
    },
    flush() {
      if (timer) clearTimeout(timer);
      timer = null;
      flush();
    },
  };
}
