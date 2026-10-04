import React, { useEffect, useState } from 'react';
import type { PublicResults as Results } from '../scoring/publicResults';
import { toPersianDigits } from '../utils/persian';
import geraLogo from '../assets/gera-logo.png';

const POLL_MS = 5000;
const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

type Load = { kind: 'loading' } | { kind: 'ok'; data: Results; at: number } | { kind: 'closed' } | { kind: 'offline'; data?: Results; at?: number };

/** Read-only results page for the public link (?results=<token>[&event=<id>]). Made for phones. */
export const PublicResults: React.FC<{ token: string; eventId: string }> = ({ token, eventId }) => {
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: { data: Results; at: number } | undefined;
    const tick = async () => {
      if (document.visibilityState !== 'hidden') {
        try {
          const q = new URLSearchParams({ token });
          if (eventId && eventId !== 'default') q.set('event', eventId);
          const res = await fetch(`/api/results?${q}`, { cache: 'no-store' });
          if (stop) return;
          if (res.status === 404) setLoad({ kind: 'closed' });
          else if (res.ok) {
            last = { data: (await res.json()) as Results, at: Date.now() };
            setLoad({ kind: 'ok', ...last });
          } else setLoad({ kind: 'offline', ...last });
        } catch {
          if (!stop) setLoad({ kind: 'offline', ...last });
        }
      }
      if (!stop) timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [token, eventId]);

  const data = load.kind === 'ok' || load.kind === 'offline' ? load.data : undefined;
  const at = load.kind === 'ok' || load.kind === 'offline' ? load.at : undefined;
  const time = at ? toPersianDigits(new Date(at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })) : '';

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-slate-100 font-['Vazirmatn',sans-serif] max-w-lg mx-auto pb-10">
      <header className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center gap-3">
        <img src={geraLogo} alt="" className="w-9 h-9 object-contain" draggable={false} />
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-black text-white truncate">{data?.eventName || 'نتایج مسابقات'}</h1>
          <p className="text-[11px] text-slate-400 truncate">{data?.runName || 'گرابرد'}</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className={`w-2 h-2 rounded-full ${load.kind === 'ok' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          {time || '…'}
        </span>
      </header>

      {load.kind === 'loading' && <p className="p-8 text-center text-sm text-slate-400">در حال دریافت نتایج…</p>}

      {load.kind === 'closed' && (
        <div className="m-4 p-6 rounded-3xl border border-slate-800 bg-slate-900 text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <p className="text-sm font-bold text-white">این لینک معتبر نیست یا نمایش عمومی نتایج غیرفعال شده است.</p>
          <p className="text-xs text-slate-400">از اپراتور لینک جدید بخواهید.</p>
        </div>
      )}

      {load.kind === 'offline' && (
        <div className="mx-4 mt-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
          ارتباط قطع است؛ {data ? 'آخرین نتایج دریافت‌شده نمایش داده می‌شود و دوباره تلاش می‌کنیم.' : 'دوباره تلاش می‌کنیم…'}
        </div>
      )}

      {data && (
        <main className="p-4 space-y-3">
          {data.frozen && (
            <div className="px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200">
              نتایج در حال اعلام است؛ امتیازها پس از اعلام نهایی به‌روز می‌شوند.
            </div>
          )}
          {data.teams.length === 0 && <p className="p-6 text-center text-sm text-slate-400">هنوز نتیجه‌ای ثبت نشده است.</p>}
          {data.teams.map((t) => {
            const expanded = open === t.teamId;
            return (
              <button
                key={t.teamId}
                onClick={() => setOpen(expanded ? null : t.teamId)}
                className={`w-full text-right rounded-3xl border p-4 transition-colors cursor-pointer ${
                  t.rank === 1 ? 'border-amber-400/60 bg-amber-500/5' : 'border-slate-800 bg-slate-900/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-slate-800 flex items-center justify-center text-lg font-black font-mono flex-shrink-0">
                    {MEDAL[t.rank] ?? toPersianDigits(t.rank)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || '#64748b' }} />
                      <h2 className="text-base font-black text-white truncate">{t.name}</h2>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{toPersianDigits(t.memberCount)} نفر</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <div className="text-2xl font-black font-mono text-cyan-300 leading-none">{toPersianDigits(t.total)}</div>
                    <div className="text-[10px] text-slate-500 mt-1">از {toPersianDigits(data.totalMax)}</div>
                  </div>
                </div>

                {expanded && data.events.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-2.5">
                    {data.events.map((ev) => {
                      const v = t.eventScores[ev.id];
                      return (
                        <div key={ev.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-bold">{ev.name}</span>
                            <span className="font-mono text-slate-200">
                              {v === null || v === undefined ? '—' : toPersianDigits(v)} <span className="text-slate-500">/ {toPersianDigits(ev.max)}</span>
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-cyan-500" style={{ width: `${v ? Math.min(100, (v / ev.max) * 100) : 0}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
          <p className="pt-2 text-center text-[11px] text-slate-600">برای دیدن امتیاز هر رویداد روی تیم بزنید</p>
        </main>
      )}
    </div>
  );
};
