import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, KeyRound, Laptop } from 'lucide-react';
import { syncEngine, SyncStatus } from '../sync/engine';
import { IS_OFFLINE } from '../offline/flag';
import { toPersianDigits } from '../utils/persian';

export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());
  useEffect(() => syncEngine.subscribe(setStatus), []);
  return status;
}

/** Small always-visible indicator of the sync state. Hidden in standalone mode. */
export const SyncBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const status = useSyncStatus();
  if (IS_OFFLINE || status.role === 'local') return null;

  const pending = status.pending > 0 && status.role === 'judge'
    ? ` (${toPersianDigits(status.pending)} امتیاز در صف)`
    : status.pending > 0 ? ' (تغییرات در صف)' : '';

  let tone = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
  let icon = <Cloud className="w-3.5 h-3.5" />;
  let label = status.serverMode === 'offline' ? 'همگام با لپ‌تاپ' : 'همگام';

  switch (status.phase) {
    case 'connecting':
      tone = 'bg-slate-700/40 border-slate-600 text-slate-300';
      icon = <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
      label = 'در حال اتصال…';
      break;
    case 'syncing':
      tone = 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300';
      icon = <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
      label = 'در حال ارسال…';
      break;
    case 'offline':
      tone = 'bg-amber-500/15 border-amber-500/50 text-amber-300';
      icon = <CloudOff className="w-3.5 h-3.5" />;
      label = 'بدون اتصال — ذخیره روی همین دستگاه' + pending;
      break;
    case 'unauthorized':
      tone = 'bg-rose-500/15 border-rose-500/50 text-rose-300';
      icon = <KeyRound className="w-3.5 h-3.5" />;
      label = status.role === 'admin' ? 'کلید اپراتور نامعتبر است' : 'کد داور نامعتبر است';
      break;
    default:
      if (status.serverMode === 'offline') icon = <Laptop className="w-3.5 h-3.5" />;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${tone}`}
      title={status.lastSyncAt ? `آخرین همگام‌سازی: ${new Date(status.lastSyncAt).toLocaleTimeString('fa-IR')}` : undefined}
    >
      {icon}
      {!compact || status.phase === 'offline' || status.phase === 'unauthorized' ? <span>{label}</span> : null}
    </span>
  );
};
