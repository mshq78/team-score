import React, { useEffect, useState } from 'react';
import { syncEngine } from '../sync/engine';
import { useSyncStatus } from './SyncBadge';

const ADMIN_KEY_STORAGE = 'teamkeshi_admin_key';
const VERIFIED_STORAGE = 'teamkeshi_admin_verified';

const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // storage unavailable
  }
};

type Gate = 'checking' | 'open' | 'locked' | 'unreachable';

/**
 * Shows the operator app only to someone holding the admin key (opened once with ?admin=KEY,
 * or typed below). Without a valid key nothing of the app or its data is rendered.
 * A key the server has already accepted keeps working without a connection.
 */
export const AdminGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [gate, setGate] = useState<Gate>(syncEngine.role === 'admin' ? 'checking' : 'locked');
  const status = useSyncStatus();

  useEffect(() => {
    const key = lsGet(ADMIN_KEY_STORAGE);
    if (syncEngine.role !== 'admin' || !key) return setGate('locked');
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch('/api/events', { headers: { 'X-Admin-Key': key }, cache: 'no-store', signal: controller.signal })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 401) {
          lsSet(ADMIN_KEY_STORAGE, null);
          lsSet(VERIFIED_STORAGE, null);
          setGate('locked');
        } else if (res.ok) {
          lsSet(VERIFIED_STORAGE, '1');
          setGate('open');
        } else {
          setGate(lsGet(VERIFIED_STORAGE) === '1' ? 'open' : 'unreachable');
        }
      })
      .catch(() => {
        // no connection: a key accepted earlier still opens the (offline-first) app
        if (!cancelled) setGate(lsGet(VERIFIED_STORAGE) === '1' ? 'open' : 'unreachable');
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // The key was changed on the server while the app was open
  useEffect(() => {
    if (gate === 'open' && status.phase === 'unauthorized') {
      lsSet(ADMIN_KEY_STORAGE, null);
      lsSet(VERIFIED_STORAGE, null);
      setGate('locked');
    }
  }, [gate, status.phase]);

  if (gate === 'open') return <>{children}</>;
  if (gate === 'checking') return <div className="min-h-screen bg-slate-950" />;
  return <Locked unreachable={gate === 'unreachable'} />;
};

const Locked: React.FC<{ unreachable: boolean }> = ({ unreachable }) => {
  const [value, setValue] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    lsSet(ADMIN_KEY_STORAGE, value.trim());
    lsSet(VERIFIED_STORAGE, null);
    window.location.replace(window.location.pathname);
  };
  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 font-['Vazirmatn',sans-serif] flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-3 text-center">
        <div className="text-4xl">🔒</div>
        {unreachable && <p className="text-xs text-amber-300">اتصال به سرور برقرار نشد؛ اینترنت را بررسی و دوباره تلاش کنید.</p>}
        <input
          type="password"
          dir="ltr"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="کلید اپراتور"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-center text-white focus:outline-none focus:border-cyan-500"
        />
        <button type="submit" className="w-full py-3 rounded-xl bg-cyan-500 text-slate-950 font-black cursor-pointer">
          ورود
        </button>
      </form>
    </div>
  );
};
