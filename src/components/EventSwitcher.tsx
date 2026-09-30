import React, { useEffect, useState } from 'react';
import { syncEngine, type EventInfo } from '../sync/engine';

function useEvents() {
  const [events, setEvents] = useState<EventInfo[] | null>(null);
  const [error, setError] = useState(false);
  const reload = async () => {
    const list = await syncEngine.listEvents();
    setEvents(list);
    setError(list === null);
  };
  useEffect(() => {
    if (syncEngine.role === 'admin') void reload();
  }, []);
  return { events, error, reload };
}

/** Small pill with the current event's name (operator with a server only). */
export const EventNamePill: React.FC = () => {
  const { events } = useEvents();
  if (syncEngine.role !== 'admin' || !events) return null;
  const current = events.find((e) => e.id === syncEngine.eventId);
  return (
    <span className="px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/40 text-indigo-200 text-[11px] font-bold whitespace-nowrap max-w-[10rem] truncate" title="رویداد فعال">
      {current?.name ?? syncEngine.eventId}
    </span>
  );
};

/** Operator panel block: pick, create or rename the event (bootcamp) this browser works on. */
export const EventSwitcher: React.FC = () => {
  const { events, error, reload } = useEvents();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'idle' | 'create' | 'rename'>('idle');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (syncEngine.role !== 'admin') return null;
  const current = events?.find((e) => e.id === syncEngine.eventId);

  const submit = async () => {
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    setMessage(null);
    if (mode === 'create') {
      const created = await syncEngine.createEvent(clean);
      setBusy(false);
      if (!created) return setMessage('ساخت رویداد ناموفق بود؛ اتصال را بررسی کنید.');
      syncEngine.switchEvent(created.id);
      return;
    }
    const ok = await syncEngine.renameEvent(syncEngine.eventId, clean);
    setBusy(false);
    if (!ok) return setMessage('تغییر نام ناموفق بود.');
    setMode('idle');
    setName('');
    void reload();
  };

  return (
    <div className="bg-slate-950/70 border border-indigo-500/30 rounded-2xl p-4 space-y-2.5">
      <div className="text-xs font-black text-indigo-300">رویداد (بوت‌کمپ) فعال</div>
      {error && <p className="text-[11px] text-amber-300">فهرست رویدادها دریافت نشد (سرور در دسترس نیست).</p>}
      {events && (
        <select
          value={syncEngine.eventId}
          onChange={(e) => e.target.value !== syncEngine.eventId && syncEngine.switchEvent(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      )}
      {mode === 'idle' ? (
        <div className="flex gap-2">
          <button
            className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer"
            onClick={() => { setMode('create'); setName(''); }}
          >
            + رویداد جدید
          </button>
          <button
            className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
            onClick={() => { setMode('rename'); setName(current?.name ?? ''); }}
          >
            تغییر نام
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder={mode === 'create' ? 'نام رویداد جدید' : 'نام جدید'}
            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
          />
          <button disabled={busy} className="px-3 rounded-lg bg-emerald-500 text-slate-950 text-[11px] font-black cursor-pointer disabled:opacity-50" onClick={() => void submit()}>
            {mode === 'create' ? 'بساز' : 'ذخیره'}
          </button>
          <button className="px-2 rounded-lg bg-slate-800 text-slate-300 text-[11px] cursor-pointer" onClick={() => setMode('idle')}>×</button>
        </div>
      )}
      {message && <p className="text-[11px] text-rose-300">{message}</p>}
      <p className="text-[10px] text-slate-500 leading-relaxed">
        هر رویداد تیم‌ها، داوران و امتیازهای جدا دارد. لینک و QR داورها مخصوص رویداد فعال است.
      </p>
    </div>
  );
};
