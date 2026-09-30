import React, { useEffect, useState } from 'react';
import { syncEngine, type EventInfo } from '../sync/engine';
import { IS_OFFLINE } from '../offline/flag';

type LoadError = null | 'unauthorized' | 'unreachable';

function useEvents() {
  const [events, setEvents] = useState<EventInfo[] | null>(null);
  const [error, setError] = useState<LoadError>(null);
  const reload = async () => {
    const list = await syncEngine.listEvents();
    if (list === 'unauthorized') {
      setEvents(null);
      setError('unauthorized');
    } else {
      setEvents(list);
      setError(list === null ? 'unreachable' : null);
    }
  };
  useEffect(() => {
    if (syncEngine.role === 'admin') void reload();
  }, []);
  return { events, error, reload };
}

/** Always-visible button with the current event's name; opens the operator panel where events are managed. */
export const EventNamePill: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const { events, error } = useEvents();
  if (syncEngine.role !== 'admin') return null;
  const current = events?.find((e) => e.id === syncEngine.eventId);
  const label = error === 'unauthorized' ? 'کلید اپراتور نامعتبر' : current?.name ?? (events ? syncEngine.eventId : 'رویدادها');
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold whitespace-nowrap max-w-[10rem] truncate cursor-pointer ${
        error === 'unauthorized' ? 'bg-rose-500/15 border-rose-500/40 text-rose-200' : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
      }`}
      title="رویداد فعال — برای مدیریت رویدادها کلیک کنید"
    >
      🗂 {label}
    </button>
  );
};

/** Operator panel block: pick, create or rename the event (bootcamp) this browser works on. */
export const EventSwitcher: React.FC = () => {
  const { events, error, reload } = useEvents();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'idle' | 'create' | 'rename'>('idle');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (syncEngine.role !== 'admin') {
    if (IS_OFFLINE) return null;
    return (
      <div className="bg-slate-950/70 border border-slate-700 rounded-2xl p-4 text-[11px] text-slate-400 leading-relaxed">
        برای مدیریت رویدادها (ساخت، تغییر نام، حذف) با «لینک اپراتور» وارد شوید:
        <span dir="ltr" className="block mt-1 font-mono text-slate-300">{window.location.origin}/?admin=کلید</span>
      </div>
    );
  }
  const current = events?.find((e) => e.id === syncEngine.eventId);

  const remove = async () => {
    if (!current || current.id === 'default') return;
    const typed = window.prompt(`رویداد «${current.name}» با همه‌ی تیم‌ها، داوران و امتیازهایش حذف می‌شود.\nبرای تأیید نام رویداد را دقیقاً بنویسید:`);
    if (typed === null) return;
    if (typed.trim() !== current.name) return setMessage('نام درست وارد نشد؛ چیزی حذف نشد.');
    setBusy(true);
    const ok = await syncEngine.deleteEvent(current.id);
    setBusy(false);
    if (!ok) return setMessage('حذف ناموفق بود.');
    syncEngine.switchEvent('default');
  };

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
      {error === 'unauthorized' && (
        <p className="text-[11px] text-rose-300">کلید اپراتور در این لینک با کلید سرور یکی نیست؛ با لینک درست وارد شوید.</p>
      )}
      {error === 'unreachable' && <p className="text-[11px] text-amber-300">فهرست رویدادها دریافت نشد (سرور در دسترس نیست).</p>}
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
          {current && current.id !== 'default' && (
            <button
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-900/60 text-rose-300 text-[11px] font-bold cursor-pointer disabled:opacity-50"
              onClick={() => void remove()}
            >
              حذف
            </button>
          )}
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
