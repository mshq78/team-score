import React, { useState } from 'react';
import { ScoringEvent } from '../../types';
import { toPersianDigits } from '../../utils/persian';
import { FileSpreadsheet, X, Check, AlertTriangle, Layers } from 'lucide-react';

interface ExcelImportModalProps {
  events: ScoringEvent[];
  existingEventsCount: number;
  onApply: (mode: 'replace' | 'append') => void;
  onClose: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  events,
  existingEventsCount,
  onApply,
  onClose,
}) => {
  const [mode, setMode] = useState<'replace' | 'append'>('replace');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg">پیش‌نمایش رویدادها از فایل اکسل</h3>
              <p className="text-xs text-slate-400">
                {toPersianDigits(events.length)} رویداد شناسایی شد
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/60">
          <label className="block text-xs font-bold text-slate-300 mb-2">
            نحوه اعمال رویدادها:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              onClick={() => setMode('replace')}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                mode === 'replace'
                  ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="importMode"
                checked={mode === 'replace'}
                onChange={() => setMode('replace')}
                className="mt-1 accent-cyan-500"
              />
              <div className="text-xs">
                <span className="font-bold block text-sm">جایگزینی کامل (Replace)</span>
                <span className="text-slate-400 block mt-0.5">
                  رویدادهای فعلی ({toPersianDigits(existingEventsCount)} عدد) حذف و این رویدادها جایگزین می‌شوند.
                </span>
              </div>
            </label>

            <label
              onClick={() => setMode('append')}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                mode === 'append'
                  ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300'
                  : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="importMode"
                checked={mode === 'append'}
                onChange={() => setMode('append')}
                className="mt-1 accent-indigo-500"
              />
              <div className="text-xs">
                <span className="font-bold block text-sm">افزودن به انتهای لیست (Append)</span>
                <span className="text-slate-400 block mt-0.5">
                  رویدادهای جدید به ادامه فهرست قبلی اضافه خواهند شد.
                </span>
              </div>
            </label>
          </div>

          {mode === 'replace' && existingEventsCount > 0 && (
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>توجه: با انتخاب جایگزینی، نمرات و یادداشت‌های مرتبط با رویدادهای قبلی نیز پاک خواهند شد.</span>
            </div>
          )}
        </div>

        {/* Events Preview List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mb-1">
            <Layers className="w-4 h-4" />
            <span>فهرست رویدادها و معیارهای استخراج‌شده:</span>
          </div>

          {events.map((ev, idx) => (
            <div
              key={ev.id}
              className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center font-mono">
                    {toPersianDigits(idx + 1)}
                  </span>
                  <span className="font-bold text-sm text-slate-100">{ev.name}</span>
                </div>
                <span className="text-xs text-slate-400">
                  {toPersianDigits(ev.indicators.length)} معیار
                </span>
              </div>

              {/* Indicator chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ev.indicators.map((ind, indIdx) => (
                  <span
                    key={ind.id}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 flex items-center gap-1"
                  >
                    <span className="text-slate-500 font-mono text-[10px]">
                      {toPersianDigits(indIdx + 1)}.
                    </span>
                    <span>{ind.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            انصراف
          </button>
          <button
            onClick={() => onApply(mode)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>تأیید و اعمال در سامانه</span>
          </button>
        </div>
      </div>
    </div>
  );
};
