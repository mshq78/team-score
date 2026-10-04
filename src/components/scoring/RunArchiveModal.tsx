import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { AppState } from '../../store/state';
import { AppAction } from '../../store/actions';
import { RunArchive } from '../../types';
import { toPersianDigits } from '../../utils/persian';
import { sound } from '../../utils/sound';
import { toScale } from '../../scoring/compute';
import {
  X,
  Archive,
  Calendar,
  Users,
  Trophy,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FolderArchive,
  CheckCircle2,
  FileSpreadsheet
} from 'lucide-react';

interface RunArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onSuccess?: (message: string) => void;
}

export const RunArchiveModal: React.FC<RunArchiveModalProps> = ({
  isOpen,
  onClose,
  state,
  dispatch,
  onSuccess,
}) => {
  const runs = state.runs || [];

  // Expanded runs for showing team tables
  const [expandedRunIds, setExpandedRunIds] = useState<Record<string, boolean>>({});
  // Confirm delete dialog for a specific run
  const [confirmDeleteRun, setConfirmDeleteRun] = useState<RunArchive | null>(null);

  if (!isOpen) return null;

  const toggleExpandRun = (runId: string) => {
    setExpandedRunIds((prev) => ({
      ...prev,
      [runId]: !prev[runId],
    }));
    sound.playClick();
  };

  const handleDeleteRun = (run: RunArchive) => {
    dispatch({
      type: 'DELETE_RUN_ARCHIVE',
      payload: { runId: run.id },
    });
    sound.playPop();
    setConfirmDeleteRun(null);
    if (onSuccess) {
      onSuccess(`اجرای «${run.name}» از آرشیو حذف شد`);
    }
  };

  const handleExportRunExcel = (run: RunArchive) => {
    sound.playFanfare();

    const wb = XLSX.utils.book_new();

    const eventIds = Object.keys(run.eventNames || {});
    const eventHeaders = eventIds.map((id) => run.eventNames[id] || id);

    const sheetData: Array<Array<string | number>> = [
      ['نام اجرا', run.name],
      ['تاریخ شروع', formatPersianDate(run.startedAt)],
      ['تاریخ پایان', formatPersianDate(run.endedAt)],
      ['تعداد داوران', run.judgesCount],
      ['تعداد تیم‌ها', run.teams.length],
      [],
      ['رتبه', 'نام تیم', 'تعداد اعضا', ...eventHeaders, 'درصد تکمیل', 'امتیاز نهایی'],
    ];

    for (const t of run.teams) {
      const row: Array<string | number> = [
        t.rank,
        t.name,
        t.memberCount,
      ];
      for (const eId of eventIds) {
        const score = t.eventScores?.[eId];
        row.push(score !== null && score !== undefined ? toScale(score, run.eventScales?.[eId] ?? 100) : '—');
      }
      row.push(`${Math.round(t.completionPercentage)}%`);
      row.push(toScale(t.grandTotal, run.totalScale ?? 100));
      sheetData.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'نتایج اجرا');

    const safeName = run.name.replace(/[/\\?%*:|"<>]/g, '-').trim() || 'archive';
    XLSX.writeFile(wb, `${safeName}.xlsx`);
  };

  function formatPersianDate(isoString: string): string {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-white">آرشیو اجراهای گذشته</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-cyan-300 border border-slate-700">
                  {toPersianDigits(runs.length)} اجرا
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                مشاهده نتایج نهایی، رتبه‌بندی تیم‌ها و خروجی اکسل دوره‌های قبلی
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {runs.length === 0 ? (
            <div className="text-center py-16 px-4 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-slate-700/80 text-slate-500 flex items-center justify-center mx-auto shadow-inner">
                <Archive className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-bold text-slate-300">
                  هیچ اجرای آرشیو‌شده‌ای وجود ندارد
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  هنگامی که یک دوره بوت‌کمپ تمام می‌شود، با کلیک بر روی دکمه «شروع اجرای جدید»، اطلاعات و نمرات دوره فعلی به صورت خودکار در این بخش آرشیو و نگهداری خواهند شد.
                </p>
              </div>
            </div>
          ) : (
            runs.map((run, runIndex) => {
              const isExpanded = !!expandedRunIds[run.id];
              const winner = run.teams && run.teams.length > 0 ? run.teams[0] : null;
              const eventIds = Object.keys(run.eventNames || {});

              return (
                <div
                  key={run.id || runIndex}
                  className="bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 rounded-2xl overflow-hidden transition-all shadow-md"
                >
                  {/* Run Card Summary */}
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-sm sm:text-base text-white truncate">
                          {run.name}
                        </span>
                        {runIndex === 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            آخرین اجرا
                          </span>
                        )}
                      </div>

                      {/* Dates and metadata */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>پایان: {formatPersianDate(run.endedAt)}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>{toPersianDigits(run.teams.length)} تیم</span>
                        </span>
                        <span className="text-slate-500">•</span>
                        <span>{toPersianDigits(run.judgesCount)} داور</span>
                      </div>

                      {/* Winner highlight */}
                      {winner && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <div className="flex items-center gap-1 text-xs text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl">
                            <Trophy className="w-3.5 h-3.5" />
                            <span>قهرمان:</span>
                            <span
                              className="inline-block w-2.5 h-2.5 rounded-full mx-1"
                              style={{ backgroundColor: winner.color }}
                            />
                            <span className="text-white">{winner.name}</span>
                            <span className="text-slate-400 text-[11px] font-mono mr-1">
                              ({toPersianDigits(toScale(winner.grandTotal, run.totalScale ?? 100))} امتیاز)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      {/* Excel Export Button */}
                      <button
                        onClick={() => handleExportRunExcel(run)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                        title="دانلود خروجی اکسل این اجرا"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="hidden sm:inline">خروجی اکسل</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => setConfirmDeleteRun(run)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-all cursor-pointer"
                        title="حذف این اجرا از آرشیو"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span className="hidden sm:inline">حذف</span>
                      </button>

                      {/* Expand / Collapse Details Button */}
                      <button
                        onClick={() => toggleExpandRun(run.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                      >
                        <span>{isExpanded ? 'بستن ریز جدول' : 'مشاهده جدول رده‌بندی'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Rankings Table */}
                  {isExpanded && (
                    <div className="border-t border-slate-800 bg-slate-900/90 p-4 sm:p-5 overflow-x-auto animate-in fade-in duration-150">
                      <table className="w-full text-right text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                            <th className="py-2.5 px-3 font-bold w-14 text-center">رتبه</th>
                            <th className="py-2.5 px-3 font-bold">نام تیم</th>
                            <th className="py-2.5 px-3 font-bold text-center">اعضا</th>
                            {eventIds.map((eId) => (
                              <th key={eId} className="py-2.5 px-3 font-bold text-center">
                                {run.eventNames[eId] || eId}
                              </th>
                            ))}
                            <th className="py-2.5 px-3 font-bold text-center">درصد تکمیل</th>
                            <th className="py-2.5 px-3 font-bold text-center font-black text-cyan-300">
                              امتیاز کل
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-medium">
                          {run.teams.map((t) => (
                            <tr
                              key={t.teamId}
                              className={`hover:bg-slate-800/40 transition-colors ${
                                t.rank === 1 ? 'bg-amber-500/5' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-xs font-black ${
                                    t.rank === 1
                                      ? 'bg-amber-500 text-slate-950 font-black'
                                      : t.rank === 2
                                      ? 'bg-slate-300 text-slate-950 font-bold'
                                      : t.rank === 3
                                      ? 'bg-amber-700 text-amber-100 font-bold'
                                      : 'text-slate-400 font-mono'
                                  }`}
                                >
                                  {toPersianDigits(t.rank)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                    style={{ backgroundColor: t.color }}
                                  />
                                  <span className="font-bold text-slate-200">{t.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                {toPersianDigits(t.memberCount)}
                              </td>
                              {eventIds.map((eId) => {
                                const sc = t.eventScores?.[eId];
                                return (
                                  <td
                                    key={eId}
                                    className="py-2.5 px-3 text-center font-mono text-slate-300"
                                  >
                                    {sc !== null && sc !== undefined
                                      ? toPersianDigits(toScale(sc, run.eventScales?.[eId] ?? 100))
                                      : '—'}
                                  </td>
                                );
                              })}
                              <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                                {toPersianDigits(Math.round(t.completionPercentage))}%
                              </td>
                              <td className="py-2.5 px-3 text-center font-mono font-black text-cyan-400 text-sm">
                                {toPersianDigits(toScale(t.grandTotal, run.totalScale ?? 100))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-end bg-slate-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>

      {/* Confirm Delete Submodal */}
      {confirmDeleteRun && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-white">حذف اجرای آرشیو‌شده</h4>
                <p className="text-xs text-slate-400">این عملیات غیرقابل بازگشت است</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              آیا از حذف اطلاعات و رده‌بندی اجرای «{confirmDeleteRun.name}» از آرشیو اطمینان دارید؟
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDeleteRun(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={() => handleDeleteRun(confirmDeleteRun)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20 cursor-pointer transition-colors"
              >
                تأیید و حذف از آرشیو
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
