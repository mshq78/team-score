import type { AppState } from '../store/state';
import { generateBackupFilename } from '../utils/backup';

/**
 * Optional autosave into a user-chosen folder (File System Access API, Chrome/Edge).
 * Everything here is best-effort and never throws; localStorage autosave stays the primary store.
 * Only the AppState is written — never the admin key or server URL.
 */

interface DirHandle {
  name: string;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{
    createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }>;
    getFile(): Promise<File>;
  }>;
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
}

export const STATE_FILE = 'teamkeshi-state.json';
const BACKUP_EVERY_MS = 5 * 60 * 1000;
const DB_NAME = 'teamkeshi-offline';
const STORE = 'handles';

export interface FolderStatus {
  supported: boolean;
  folderName: string | null;
  /** 'ready' = writing; 'needs-permission' = handle remembered, needs a click */
  phase: 'none' | 'needs-permission' | 'ready';
  lastSavedAt: number | null;
  error: string | null;
}

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(): Promise<DirHandle | null> {
  try {
    const db = await idb();
    return await new Promise((resolve) => {
      const r = db.transaction(STORE).objectStore(STORE).get('dir');
      r.onsuccess = () => resolve((r.result as DirHandle) ?? null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
async function idbPut(h: DirHandle): Promise<void> {
  try {
    const db = await idb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(h, 'dir');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

async function writeText(dir: DirHandle, name: string, text: string) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}

class FolderStore {
  private dir: DirHandle | null = null;
  private lastBackupAt = 0;
  private listeners = new Set<() => void>();
  private status: FolderStatus = {
    supported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
    folderName: null,
    phase: 'none',
    lastSavedAt: null,
    error: null,
  };

  getStatus = () => this.status;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  private set(p: Partial<FolderStatus>) {
    this.status = { ...this.status, ...p };
    this.listeners.forEach((f) => f());
  }

  /** Restores the remembered folder on page open (no user gesture needed for the query). */
  async init() {
    if (!this.status.supported) return;
    const h = await idbGet();
    if (!h) return;
    this.dir = h;
    try {
      const perm = (await h.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt';
      this.set({ folderName: h.name, phase: perm === 'granted' ? 'ready' : 'needs-permission' });
    } catch {
      this.set({ folderName: h.name, phase: 'needs-permission' });
    }
  }

  /** Must be called from a click. Returns the saved state text if the folder already has one. */
  async pick(): Promise<{ ok: boolean; existing?: string }> {
    try {
      const picker = (window as unknown as { showDirectoryPicker: (o: { mode: 'readwrite' }) => Promise<DirHandle> })
        .showDirectoryPicker;
      const h = await picker({ mode: 'readwrite' });
      let existing: string | undefined;
      try {
        existing = await (await (await h.getFileHandle(STATE_FILE)).getFile()).text();
      } catch {
        existing = undefined;
      }
      this.dir = h;
      await idbPut(h);
      this.lastBackupAt = 0;
      this.set({ folderName: h.name, phase: 'ready', error: null });
      return { ok: true, existing };
    } catch {
      return { ok: false }; // cancelled or blocked
    }
  }

  /** Must be called from a click. */
  async resume(): Promise<boolean> {
    if (!this.dir) return false;
    try {
      const perm = await this.dir.requestPermission?.({ mode: 'readwrite' });
      if (perm === 'granted') {
        this.set({ phase: 'ready', error: null });
        return true;
      }
    } catch {
      // fall through
    }
    return false;
  }

  /** Keeps the old state file in backups/ before it gets overwritten. */
  async keepAside(text: string) {
    try {
      const b = await this.dir!.getDirectoryHandle('backups', { create: true });
      await writeText(b, generateBackupFilename().replace('backup', 'replaced'), text);
    } catch {
      // ignore
    }
  }

  async save(state: AppState) {
    if (!this.dir || this.status.phase !== 'ready') return;
    try {
      const text = JSON.stringify(state, null, 2);
      await writeText(this.dir, STATE_FILE, text);
      if (Date.now() - this.lastBackupAt >= BACKUP_EVERY_MS) await this.writeBackupText(text);
      this.set({ lastSavedAt: Date.now(), error: null });
    } catch {
      this.set({ error: 'نوشتن در پوشه ناموفق بود؛ ذخیره در مرورگر ادامه دارد.', phase: 'needs-permission' });
    }
  }

  /** Called on every export/download. */
  async backup(state: AppState) {
    if (!this.dir || this.status.phase !== 'ready') return;
    try {
      await this.writeBackupText(JSON.stringify(state, null, 2));
    } catch {
      // ignore
    }
  }

  private async writeBackupText(text: string) {
    const b = await this.dir!.getDirectoryHandle('backups', { create: true });
    await writeText(b, generateBackupFilename(), text);
    this.lastBackupAt = Date.now();
  }
}

export const folderStore = new FolderStore();
