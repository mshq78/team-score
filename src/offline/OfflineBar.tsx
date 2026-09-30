import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { AppState } from '../store/state';
import type { AppAction } from '../store/actions';
import { downloadBackupJson, validateAndSanitizeBackup } from '../utils/backup';
import { toPersianDigits } from '../utils/persian';
import { applyScores } from './applyScores';
import { folderStore } from './folderStore';
import { createServerEvent, getPushTarget, pushState, setPushTarget, stateHash, type PushTarget } from './pushToServer';
import { SERVER_KEY_KEY, SERVER_URL_KEY, fetchServerEvents, fetchServerScores, type ServerEvent } from './serverScores';

const SAVE_DEBOUNCE_MS = 800;

/** Headless: restores the remembered folder and writes state changes (debounced). Always mounted. */
export const OfflineAutosave: React.FC<{ state: AppState }> = ({ state }) => {
  useEffect(() => {
    void folderStore.init();
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void folderStore.save(state), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [state]);
  return null;
};

const lsGet = (k: string) => {
  try {
    return localStorage.getItem(k) || '';
  } catch {
    return '';
  }
};
const lsSet = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // ignore
  }
};

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (ts: number) => toPersianDigits(`${pad(new Date(ts).getHours())}:${pad(new Date(ts).getMinutes())}`);

interface Dialog {
  title: string;
  text: string;
  onOk?: () => void;
  onCancel?: () => void;
}

const btn =
  'px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer disabled:opacity-50';

export const OfflineBar: React.FC<{ state: AppState; dispatch: React.Dispatch<AppAction>; onToast: (m: string) => void }> = ({
  state,
  dispatch,
  onToast,
}) => {
  const fs = useSyncExternalStore(folderStore.subscribe, folderStore.getStatus);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [serverOpen, setServerOpen] = useState(false);
  const [url, setUrl] = useState(() => lsGet(SERVER_URL_KEY));
  const [key, setKey] = useState(() => lsGet(SERVER_KEY_KEY));
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<ServerEvent[] | null>(null);
  const [eventId, setEventId] = useState('default');
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- sending the draft (and judges/criteria) to the server
  const [target, setTarget] = useState<PushTarget | null>(() => getPushTarget());
  const [sendOpen, setSendOpen] = useState(false);
  const [sendEvents, setSendEvents] = useState<ServerEvent[] | null>(null);
  const [sendChoice, setSendChoice] = useState('__new__');
  const [newName, setNewName] = useState('');
  const currentHash = useMemo(() => stateHash(state), [state]);

  const send = async (t: { url: string; eventId: string; eventName: string }, adminKey: string) => {
    setBusy(true);
    const r = await pushState(t.url, adminKey, t.eventId, state);
    setBusy(false);
    if (!r.ok) return setDialog({ title: 'ارسال به سرور ناموفق بود', text: r.error });
    const saved: PushTarget = { ...t, sentHash: currentHash, sentAt: Date.now() };
    setPushTarget(saved);
    setTarget(saved);
    setSendOpen(false);
    onToast(`به سرور ارسال شد (${t.eventName})`);
  };

  const onSendClick = () => {
    const savedKey = lsGet(SERVER_KEY_KEY);
    if (target && savedKey) void send(target, savedKey);
    else openSendDialog();
  };

  const openSendDialog = () => {
    setUrl(target?.url || lsGet(SERVER_URL_KEY));
    setSendEvents(null);
    setSendOpen(true);
  };

  const connectForSend = async () => {
    lsSet(SERVER_URL_KEY, url.trim());
    lsSet(SERVER_KEY_KEY, key.trim());
    setBusy(true);
    const list = await fetchServerEvents(url, key);
    setBusy(false);
    if (!list.ok) return setDialog({ title: 'خطا در اتصال به سرور', text: list.error });
    setSendEvents(list.events);
    setSendChoice(list.events.some((e) => e.id === target?.eventId) ? (target as PushTarget).eventId : '__new__');
  };

  const confirmSend = async () => {
    const adminKey = key.trim();
    if (sendChoice === '__new__') {
      if (!newName.trim()) return setDialog({ title: 'نام رویداد', text: 'برای رویداد جدید یک نام وارد کنید.' });
      setBusy(true);
      const created = await createServerEvent(url, adminKey, newName.trim());
      setBusy(false);
      if (!created.ok) return setDialog({ title: 'خطا در ساخت رویداد', text: created.error });
      return void send({ url: url.trim(), eventId: created.event.id, eventName: created.event.name }, adminKey);
    }
    const ev = (sendEvents || []).find((e) => e.id === sendChoice);
    if (ev) void send({ url: url.trim(), eventId: ev.id, eventName: ev.name }, adminKey);
  };

  const loadState = (s: AppState) => dispatch({ type: 'IMPORT_BACKUP', payload: { state: s } });

  const pickFolder = async () => {
    const r = await folderStore.pick();
    if (!r.ok) return;
    if (r.existing) {
      let saved: AppState | null = null;
      try {
        saved = validateAndSanitizeBackup(JSON.parse(r.existing));
      } catch {
        saved = null;
      }
      if (saved) {
        const s = saved;
        setDialog({
          title: 'اطلاعات ذخیره‌شده در پوشه',
          text: `در این پوشه فایل teamkeshi-state.json با ${toPersianDigits(s.participants.length)} نفر و ${toPersianDigits(
            s.teams.length
          )} تیم پیدا شد. آن را بارگذاری کنم؟ (با «بله» اطلاعات فعلی برنامه جایگزین می‌شود؛ با «خیر» فایل پوشه با اطلاعات فعلی جایگزین می‌شود و نسخهٔ قبلی در backups می‌ماند.)`,
          onOk: () => loadState(s),
          onCancel: () => void folderStore.save(state),
        });
        void folderStore.keepAside(r.existing);
        return;
      }
      void folderStore.keepAside(r.existing);
    }
    void folderStore.save(state);
  };

  const exportTeams = () => {
    downloadBackupJson(state, `teamkeshi-teams-${new Date().toISOString().slice(0, 10)}-${pad(new Date().getHours())}${pad(new Date().getMinutes())}.json`);
    void folderStore.backup(state);
    onToast('فایل تیم‌ها دانلود شد');
  };

  const onScoresFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let incoming: AppState | null = null;
      try {
        incoming = validateAndSanitizeBackup(JSON.parse(String(reader.result)));
      } catch {
        incoming = null;
      }
      if (!incoming) return setDialog({ title: 'خطا', text: 'فایل انتخاب‌شده یک فایل پشتیبان معتبر نیست.' });
      applyIncoming(incoming);
    };
    reader.onerror = () => setDialog({ title: 'خطا', text: 'خواندن فایل ناموفق بود.' });
    reader.readAsText(file);
  };

  const applyIncoming = (incoming: AppState) => {
    const { state: next, mismatches } = applyScores(state, incoming);
    const apply = () => {
      loadState(next);
      onToast('امتیازات بارگذاری شد');
    };
    if (mismatches > 0) {
      setDialog({
        title: 'ناهماهنگی تیم‌ها',
        text: `${toPersianDigits(mismatches)} امتیاز/تعدیل به تیمی مربوط است که در تیم‌های فعلی نیست و در رتبه‌بندی حساب نمی‌شود. با این حال بارگذاری شود؟`,
        onOk: apply,
      });
    } else apply();
  };

  const fetchFromServer = async () => {
    lsSet(SERVER_URL_KEY, url.trim());
    lsSet(SERVER_KEY_KEY, key.trim());
    setBusy(true);
    // Step 1: several events on the server -> let the operator pick which one to read
    if (!events) {
      const list = await fetchServerEvents(url, key);
      if (!list.ok) {
        setBusy(false);
        return setDialog({ title: 'خطا در دریافت امتیازات', text: list.error });
      }
      if (list.events.length > 1) {
        setEvents(list.events);
        setEventId(list.events[0].id);
        setBusy(false);
        return;
      }
      setEventId(list.events[0].id);
      const one = await fetchServerScores(url, key, fetch, list.events[0].id);
      setBusy(false);
      if (!one.ok) return setDialog({ title: 'خطا در دریافت امتیازات', text: one.error });
      setServerOpen(false);
      return applyIncoming(one.state);
    }
    const r = await fetchServerScores(url, key, fetch, eventId);
    setBusy(false);
    if (!r.ok) return setDialog({ title: 'خطا در دریافت امتیازات', text: r.error });
    setServerOpen(false);
    applyIncoming(r.state);
  };

  let badge: string;
  if (!fs.supported) badge = 'فقط ذخیره در مرورگر (مرورگر پشتیبانی نمی‌کند)';
  else if (fs.phase === 'ready') badge = `ذخیره در پوشه: ${fs.folderName} ✓ ${fs.lastSavedAt ? hhmm(fs.lastSavedAt) : ''}`;
  else if (fs.phase === 'needs-permission') badge = `پوشه «${fs.folderName}» نیاز به اجازهٔ دوباره دارد`;
  else badge = 'فقط ذخیره در مرورگر (پوشه انتخاب نشده)';

  return (
    <div dir="rtl" className="bg-slate-900 border-b border-slate-800 px-3 sm:pl-56 sm:pr-6 py-2 flex flex-wrap items-center gap-2 text-xs text-slate-200">
      <span className={`px-2.5 py-1 rounded-full border font-bold ${fs.phase === 'ready' ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : 'border-amber-500/40 text-amber-300 bg-amber-500/10'}`}>
        {badge}
      </span>
      {fs.error && <span className="text-rose-300 font-bold">{fs.error}</span>}
      {fs.supported && fs.phase === 'needs-permission' && (
        <button className={btn} onClick={() => void folderStore.resume().then((ok) => ok && void folderStore.save(state))}>
          ادامه ذخیره در پوشه
        </button>
      )}
      {fs.supported && fs.phase !== 'ready' && fs.phase !== 'needs-permission' && (
        <button className={btn} onClick={() => void pickFolder()}>انتخاب پوشه ذخیره</button>
      )}
      {fs.supported && fs.phase !== 'none' && (
        <button className={btn} onClick={() => void pickFolder()}>تغییر پوشه</button>
      )}
      {target && (
        <span className={`px-2.5 py-1 rounded-full border font-bold ${target.sentHash === currentHash ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : 'border-amber-500/40 text-amber-300 bg-amber-500/10'}`}>
          {target.sentHash === currentHash
            ? `ارسال‌شده به «${target.eventName}» ✓ ${target.sentAt ? hhmm(target.sentAt) : ''}`
            : `تغییرات ارسال‌نشده به «${target.eventName}»`}
        </span>
      )}
      <span className="flex-1" />
      <button className={`${btn} !bg-emerald-600 !border-emerald-500 !text-white`} disabled={busy} onClick={onSendClick}>
        {busy ? 'در حال ارسال…' : 'ارسال به سرور'}
      </button>
      {target && <button className={btn} onClick={openSendDialog}>تغییر مقصد</button>}
      <button className={btn} onClick={exportTeams}>خروجی تیم‌ها برای امتیازدهی</button>
      <button className={btn} onClick={() => fileRef.current?.click()}>بارگذاری امتیازات</button>
      <button className={btn} onClick={() => setServerOpen(true)}>دریافت امتیازات از سرور</button>
      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onScoresFile} />

      {sendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full text-right space-y-3">
            <h3 className="text-base font-black text-white">ارسال به سرور</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              تیم‌ها، داورها و معیارها به رویداد انتخابی روی سرور می‌روند. امتیازهایی که داورها قبلاً ثبت کرده‌اند پاک نمی‌شوند. اگر اینترنت نبود، همه‌چیز روی همین دستگاه می‌ماند و بعداً دوباره بزنید.
            </p>
            <input dir="ltr" value={url} onChange={(e) => { setUrl(e.target.value); setSendEvents(null); }} placeholder="https://your-app.vercel.app"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            <input dir="ltr" type="password" autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); setSendEvents(null); }} placeholder="کلید اپراتور (ADMIN_KEY)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            {sendEvents && (
              <>
                <select value={sendChoice} onChange={(e) => setSendChoice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                  {sendEvents.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                  <option value="__new__">+ رویداد جدید…</option>
                </select>
                {sendChoice === '__new__' && (
                  <input value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} placeholder="نام رویداد جدید (مثلاً بوت‌کمپ شیراز)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
                )}
              </>
            )}
            <div className="flex justify-end gap-2">
              <button className={btn} onClick={() => setSendOpen(false)}>انصراف</button>
              {sendEvents ? (
                <button className={`${btn} !bg-emerald-600 !text-white`} disabled={busy} onClick={() => void confirmSend()}>
                  {busy ? 'در حال ارسال…' : 'ارسال'}
                </button>
              ) : (
                <button className={`${btn} !bg-amber-500 !text-slate-950`} disabled={busy} onClick={() => void connectForSend()}>
                  {busy ? 'در حال اتصال…' : 'اتصال و انتخاب رویداد'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {serverOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full text-right space-y-3">
            <h3 className="text-base font-black text-white">دریافت امتیازات از سرور</h3>
            <p className="text-xs text-slate-400">فقط خواندن؛ چیزی روی سرور نوشته نمی‌شود.</p>
            <input dir="ltr" value={url} onChange={(e) => { setUrl(e.target.value); setEvents(null); }} placeholder="https://your-app.vercel.app"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            <input dir="ltr" type="password" autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); setEvents(null); }} placeholder="کلید اپراتور (ADMIN_KEY)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" />
            {events && (
              <select value={eventId} onChange={(e) => setEventId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
            <div className="flex justify-end gap-2">
              <button className={btn} onClick={() => { setServerOpen(false); setEvents(null); }}>انصراف</button>
              <button className={`${btn} !bg-amber-500 !text-slate-950`} disabled={busy} onClick={() => void fetchFromServer()}>
                {busy ? 'در حال دریافت…' : events ? 'دریافت امتیازات این رویداد' : 'دریافت'}
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full text-right space-y-3">
            <h3 className="text-base font-black text-white">{dialog.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{dialog.text}</p>
            <div className="flex justify-end gap-2">
              <button className={btn} onClick={() => { setDialog(null); dialog.onCancel?.(); }}>
                {dialog.onOk ? 'خیر' : 'متوجه شدم'}
              </button>
              {dialog.onOk && (
                <button className={`${btn} !bg-amber-500 !text-slate-950`} onClick={() => { dialog.onOk?.(); setDialog(null); }}>
                  بله
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
