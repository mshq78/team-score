import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { X, Printer, Wifi, Globe, AlertTriangle } from 'lucide-react';
import { Judge } from '../../types';
import { toPersianDigits } from '../../utils/persian';
import { syncEngine } from '../../sync/engine';

interface JudgeQrModalProps {
  judges: Judge[];
  onClose: () => void;
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function judgeUrl(base: string, judge: Judge) {
  return `${base.replace(/\/$/, '')}/?judge=1&code=${encodeURIComponent(judge.accessCode)}`;
}

/**
 * Printable QR cards: scanning a card opens the judge panel already logged in.
 * Online the address is this site; on the laptop server (offline mode) it is
 * the laptop's Wi-Fi address, which phones on its hotspot can reach.
 */
export const JudgeQrModal: React.FC<JudgeQrModalProps> = ({ judges, onClose }) => {
  const [lanUrls, setLanUrls] = useState<string[]>([]);
  const [serverMode, setServerMode] = useState<string | null>(null);
  const [base, setBase] = useState<string>(window.location.origin);
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const isAdmin = syncEngine.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    void syncEngine.fetchServerInfo().then((info) => {
      if (!info) return;
      setServerMode(info.mode);
      setLanUrls(info.lanUrls);
      const onLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      if (info.mode === 'offline' && onLocalhost && info.lanUrls.length > 0) {
        // Windows hotspot adapters use 192.168.137.x — prefer it when present
        const hotspot = info.lanUrls.find((u) => u.includes('192.168.137.'));
        setBase(hotspot || info.lanUrls[0]);
      }
    });
  }, [isAdmin]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      judges.map(async (j) => [j.id, await QRCode.toDataURL(judgeUrl(base, j), { margin: 1, width: 320 })] as const)
    ).then((entries) => {
      if (!cancelled) setQrs(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [judges, base]);

  const baseOptions = useMemo(() => {
    const options = new Set<string>([window.location.origin, ...lanUrls]);
    return [...options];
  }, [lanUrls]);

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const cards = judges
      .map(
        (j) => `<div class="card"><img src="${qrs[j.id] ?? ''}" /><div class="name">${escapeHtml(j.name)}</div>
        <div class="code">کد: ${toPersianDigits(j.accessCode)}</div><div class="url">${escapeHtml(judgeUrl(base, j))}</div></div>`
      )
      .join('');
    w.document.write(`<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><title>کارت داوران</title>
      <style>body{font-family:Vazirmatn,Tahoma,sans-serif;margin:16px}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
      .card{border:2px dashed #999;border-radius:12px;padding:16px;text-align:center;break-inside:avoid}
      img{width:200px;height:200px}.name{font-size:20px;font-weight:800;margin-top:8px}
      .code{font-size:16px;margin-top:4px}.url{font-size:10px;color:#555;direction:ltr;margin-top:6px;word-break:break-all}</style>
      </head><body><div class="grid">${cards}</div><script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-white">کارت QR داوران</h3>
            <p className="text-xs text-slate-400">داور کارت را با دوربین گوشی اسکن می‌کند و بدون تایپ کد وارد پنل خودش می‌شود.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-950/60 space-y-2 text-xs">
          {!isAdmin && (
            <div className="flex items-start gap-2 text-amber-300">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                اپ الان بدون سرور (فقط روی همین دستگاه) اجرا می‌شود؛ گوشی داورها به آن وصل نمی‌شوند. اپ را با «لینک اپراتور» سرور باز کنید.
              </span>
            </div>
          )}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 text-slate-300">
              {serverMode === 'offline' ? <Wifi className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 text-emerald-400" />}
              <span>{serverMode === 'offline' ? 'حالت بدون اینترنت (سرور لپ‌تاپ) — آدرس وای‌فای:' : 'آدرس:'}</span>
              <select
                value={base}
                onChange={(e) => setBase(e.target.value)}
                dir="ltr"
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 font-mono text-white"
              >
                {baseOptions.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {judges.length === 0 && <div className="text-center text-slate-500 text-sm col-span-full py-8">هنوز داوری تعریف نشده است.</div>}
          {judges.map((j) => (
            <div key={j.id} className="bg-white rounded-2xl p-4 text-center text-slate-900">
              {qrs[j.id] ? <img src={qrs[j.id]} alt={j.name} className="w-44 h-44 mx-auto" /> : <div className="w-44 h-44 mx-auto" />}
              <div className="font-black text-lg mt-2">{j.name}</div>
              <div className="text-sm">کد: <span className="font-mono font-bold">{toPersianDigits(j.accessCode)}</span></div>
              <div className="text-[10px] text-slate-500 mt-1 break-all" dir="ltr">{judgeUrl(base, j)}</div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={handlePrint}
            disabled={judges.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ کارت‌ها</span>
          </button>
        </div>
      </div>
    </div>
  );
};
