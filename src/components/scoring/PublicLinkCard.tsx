import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { AppState } from '../../store/state';
import type { AppAction } from '../../store/actions';
import { copyTextToClipboard } from '../../utils/clipboard';
import { syncEngine } from '../../sync/engine';
import { IS_OFFLINE } from '../../offline/flag';
import { getPushTarget } from '../../offline/pushToServer';
import { publicTokenOf } from '../../scoring/publicResults';

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

/** Operator card: switch the public, read-only results link on/off (one secret link per event). */
export const PublicLinkCard: React.FC<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onShowToast?: (m: string) => void;
}> = ({ state, dispatch, onShowToast }) => {
  const token = publicTokenOf(state);
  const target = IS_OFFLINE ? getPushTarget() : null;
  const base = IS_OFFLINE ? target?.url ?? '' : window.location.origin;
  const eventId = IS_OFFLINE ? target?.eventId ?? 'default' : syncEngine.eventId;
  const link = token && base ? `${base.replace(/\/$/, '')}/?results=${token}${eventId !== 'default' ? `&event=${encodeURIComponent(eventId)}` : ''}` : '';
  const [qr, setQr] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!link) return setQr('');
    void QRCode.toDataURL(link, { margin: 1, width: 240 }).then((u) => !cancelled && setQr(u));
    return () => {
      cancelled = true;
    };
  }, [link]);

  const set = (publicToken: string) => dispatch({ type: 'UPDATE_SCORING_SETTINGS', payload: { publicToken } });

  return (
    <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 text-right">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-white">لینک عمومی نتایج</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            هر کسی با این لینک فقط رتبه و امتیاز تیم‌ها را روی گوشی می‌بیند (بدون ورود، بدون داور و یادداشت). برای هر رویداد یک لینک جدا دارد و هر زمان خاموش شود از کار می‌افتد.
            هنگام «اعلام نتایج» (قفل جدول) همان نمره‌های قفل‌شده نمایش داده می‌شود.
          </p>
        </div>
        <button
          onClick={() => set(token ? '' : newToken())}
          className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black cursor-pointer ${token ? 'bg-rose-950/60 border border-rose-900/60 text-rose-300' : 'bg-emerald-500 text-slate-950'}`}
        >
          {token ? 'خاموش کردن' : 'فعال‌سازی'}
        </button>
      </div>

      {token && !base && (
        <p className="text-xs text-amber-300">آدرس سرور هنوز مشخص نیست؛ اول یک بار «ارسال به سرور» را بزنید.</p>
      )}
      {link && (
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          {qr && <img src={qr} alt="QR" className="w-28 h-28 rounded-xl bg-white p-1 flex-shrink-0" />}
          <div className="min-w-0 flex-1 space-y-2">
            <div dir="ltr" className="text-[11px] font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 break-all select-all">{link}</div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => onShowToast?.((await copyTextToClipboard(link)) ? 'لینک کپی شد' : 'کپی نشد؛ لینک را دستی انتخاب کنید')}
                className="px-3 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-black cursor-pointer"
              >
                کپی لینک
              </button>
              <a href={link} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold">
                باز کردن
              </a>
              <button
                onClick={() => window.confirm('لینک قبلی از کار می‌افتد و لینک جدید ساخته می‌شود. ادامه؟') && set(newToken())}
                className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold cursor-pointer"
              >
                ساخت لینک جدید
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {IS_OFFLINE ? 'بعد از فعال‌سازی یا تغییر لینک، «ارسال به سرور» را بزنید تا لینک کار کند.' : 'تغییرها خودکار روی سرور می‌روند.'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
