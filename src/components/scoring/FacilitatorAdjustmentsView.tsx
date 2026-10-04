import React, { useState } from 'react';
import { AppState } from '../../store/state';
import { AppAction } from '../../store/actions';
import { ScoreAdjustment, BootcampTeam } from '../../types';
import { toPersianDigits } from '../../utils/persian';
import { sound } from '../../utils/sound';
import { getTotalScale, toScale } from '../../scoring/compute';
import { 
  ShieldAlert, 
  PlusCircle, 
  MinusCircle, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  Clock, 
  HelpCircle,
  Tag
} from 'lucide-react';

interface FacilitatorAdjustmentsViewProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onShowToast?: (message: string) => void;
}

const PRESET_REASONS = [
  'روحیه تیمی',
  'تأخیر',
  'رعایت نکردن قوانین',
  'کمک به تیم دیگر',
  'خلاقیت ویژه',
];


export const FacilitatorAdjustmentsView: React.FC<FacilitatorAdjustmentsViewProps> = ({
  state,
  dispatch,
  onShowToast,
}) => {
  const { teams } = state;
  const { events, adjustments } = state.scoring;
  // Bonus/penalty points are typed and shown on the same scale as the total (stored internally on 0–100)
  const scale = getTotalScale(state);
  const quickPoints = [-5, -2, -1, 1, 2, 5].map((v) => toScale(v, scale) || v);
  const show = (internal: number) => toScale(internal, scale);

  // Selected team for adjustment
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');
  
  // Selected points (can be from quick buttons or custom)
  const [points, setPoints] = useState<number>(1);
  const [customPointsInput, setCustomPointsInput] = useState<string>('1');

  // Optional link to event (empty string = overall adjustment)
  const [selectedEventId, setSelectedEventId] = useState<string>('');

  // Required reason
  const [reason, setReason] = useState<string>('');

  // Confirmation modal for deleting an adjustment
  const [adjustmentToDelete, setAdjustmentToDelete] = useState<ScoreAdjustment | null>(null);

  // Local toast fallback
  const [localToast, setLocalToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    if (onShowToast) {
      onShowToast(msg);
    } else {
      setLocalToast(msg);
      setTimeout(() => setLocalToast(null), 3500);
    }
  };

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) || teams[0];

  // Calculate sum of adjustments per team
  const teamAdjustmentTotals = React.useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of teams) {
      map[t.id] = 0;
    }
    for (const adj of adjustments) {
      if (map[adj.teamId] !== undefined) {
        map[adj.teamId] += adj.points; // internal; shown through show()
      }
    }
    return map;
  }, [teams, adjustments]);

  // Handle quick point button click
  const handleQuickPointClick = (val: number) => {
    setPoints(val);
    setCustomPointsInput(String(val));
    sound.playClick();
  };

  // Handle custom input change
  const handleCustomPointsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString()).replace(/[٫,]/g, '.');
    setCustomPointsInput(valStr);
    const num = parseFloat(valStr);
    if (!isNaN(num)) {
      setPoints(num);
    }
  };

  // Handle submitting adjustment
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      notify('وارد کردن دلیل امتیاز یا جریمه الزامی است');
      return;
    }

    if (points === 0) {
      notify('میزان امتیاز نمی‌تواند صفر باشد');
      return;
    }

    const newAdjustment: ScoreAdjustment = {
      id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      teamId: selectedTeam.id,
      eventId: selectedEventId ? selectedEventId : null,
      points: Math.round(((points * 100) / scale) * 10000) / 10000,
      reason: trimmedReason,
      createdAt: new Date().toISOString(),
    };

    dispatch({
      type: 'ADD_ADJUSTMENT',
      payload: newAdjustment,
    });

    // Audio cue
    if (points > 0) {
      sound.playFanfare();
    } else {
      sound.playWhistle();
    }

    const sign = points > 0 ? `+${points}` : `${points}`;
    notify(`تغییر امتیاز (${sign} امتیاز) برای «${selectedTeam.name}» به دلیل «${trimmedReason}» ثبت شد`);

    // Reset inputs
    setReason('');
    setPoints(1);
    setCustomPointsInput('1');
  };

  // Handle deletion of an adjustment
  const handleConfirmDelete = () => {
    if (!adjustmentToDelete) return;

    dispatch({
      type: 'REMOVE_ADJUSTMENT',
      payload: { id: adjustmentToDelete.id },
    });

    sound.playPop();
    notify('تعدیل امتیاز با موفقیت حذف شد');
    setAdjustmentToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">امتیاز مجری و سرپرست (بونوس و جریمه)</h2>
          </div>
          <p className="text-xs text-slate-400">
            ثبت امتیازات تشویقی، امتیاز اخلاق، کسر نمره به دلیل تأخیر یا تخلف به صورت مستقیم در سرجمع نمرات تیم
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 text-xs font-bold">
          <span className="text-slate-400">کل تعدیل‌های ثبت شده:</span>
          <span className="text-amber-400 font-mono text-sm">{toPersianDigits(adjustments.length)}</span>
        </div>
      </div>

      {/* Main Grid: Team Selector + Entry Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Big Team Cards (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>انتخاب تیم برای اعمال امتیاز / جریمه:</span>
            </h3>
            <span className="text-xs text-slate-500">برای انتخاب روی کارت تیم کلیک کنید</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {teams.map((team) => {
              const isSelected = selectedTeam?.id === team.id;
              const totalAdj = teamAdjustmentTotals[team.id] || 0;

              return (
                <div
                  key={team.id}
                  onClick={() => {
                    setSelectedTeamId(team.id);
                    sound.playClick();
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-400 ring-2 ring-cyan-500/30 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                  }`}
                >
                  {/* Top: Team Color & Name */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-4 h-4 rounded-full ${team.badgeBg} border border-white/20 flex-shrink-0`}
                      ></span>
                      <div>
                        <h4 className="font-bold text-sm sm:text-base text-white">{team.name}</h4>
                        {team.tableNumber && (
                          <span className="text-xs text-slate-400">
                            {toPersianDigits(team.tableNumber)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="bg-cyan-500 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black">
                        انتخاب شده
                      </span>
                    )}
                  </div>

                  {/* Bottom: Total adjustments badge */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-400 font-medium">مجموع تعدیل مجری:</span>
                    <span
                      className={`font-black px-2 py-0.5 rounded-lg text-xs font-mono ${
                        totalAdj > 0
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : totalAdj < 0
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {totalAdj > 0 ? `+${toPersianDigits(show(totalAdj))}` : toPersianDigits(show(totalAdj))} امتیاز
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Entry Action Form (lg:col-span-5) */}
        <div className="lg:col-span-5">
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 sticky top-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <span>ثبت برای:</span>
                <span className="text-cyan-400 underline underline-offset-4">
                  {selectedTeam?.name}
                </span>
              </h3>
              <span className="text-xs text-slate-400">مجری مسابقه</span>
            </div>

            {/* Quick point buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                انتخاب سریع مقدار امتیاز:
              </label>
              <div className="grid grid-cols-6 gap-1.5">
                {quickPoints.map((qp) => {
                  const isSelected = points === qp;
                  const isPositive = qp > 0;

                  return (
                    <button
                      key={qp}
                      type="button"
                      onClick={() => handleQuickPointClick(qp)}
                      className={`py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer border ${
                        isSelected
                          ? isPositive
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/30 scale-105'
                            : 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/30 scale-105'
                          : isPositive
                          ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/50'
                          : 'bg-rose-950/40 text-rose-400 border-rose-800/40 hover:bg-rose-900/50'
                      }`}
                    >
                      {isPositive ? `+${toPersianDigits(qp)}` : toPersianDigits(qp)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom points input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>یا مقدار دلخواه امتیاز (مثبت یا منفی):</span>
                <span className="text-[10px] text-slate-500">مثال: 3+ یا 4-</span>
              </label>
              <input
                type="text"
                value={customPointsInput}
                onChange={handleCustomPointsChange}
                placeholder="مثلا 3 یا -0.5"
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-center text-lg font-black text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Optional Event Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                وابستگی به رویداد خاص (اختیاری):
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="">بدون وابستگی (تعدیل کلی در سرجمع نهایی)</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    مربوط به رویداد: {ev.name}
                  </option>
                ))}
              </select>
            </div>

            {/* REQUIRED Reason Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1">
                  <span>دلیل ثبت امتیاز یا جریمه (الزامی):</span>
                  <span className="text-rose-500">*</span>
                </label>
                {!reason.trim() && (
                  <span className="text-[10px] text-amber-400">تکمیل الزامی است</span>
                )}
              </div>

              {/* Preset Reason Chips */}
              <div className="flex flex-wrap gap-1.5">
                {PRESET_REASONS.map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => {
                      setReason(pr);
                      sound.playClick();
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-xl border transition-all cursor-pointer font-bold ${
                      reason === pr
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                        : 'bg-slate-950/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {pr}
                  </button>
                ))}
              </div>

              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="دلیل یا شرح را بنویسید یا از گزینه‌های بالا انتخاب کنید..."
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!reason.trim() || points === 0}
              className={`w-full py-3.5 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                !reason.trim() || points === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  : points > 0
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                  : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
              }`}
            >
              {points > 0 ? (
                <>
                  <PlusCircle className="w-5 h-5" />
                  <span>
                    ثبت +{toPersianDigits(points)} امتیاز تشویقی برای «{selectedTeam?.name}»
                  </span>
                </>
              ) : (
                <>
                  <MinusCircle className="w-5 h-5" />
                  <span>
                    ثبت {toPersianDigits(points)} کسر نمره برای «{selectedTeam?.name}»
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* History of Adjustments */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-white">تاریخچه امتیازات و جریمه‌های ثبت‌شده</h3>
          </div>
          <span className="text-xs text-slate-400">
            {toPersianDigits(adjustments.length)} رکورد ثبت‌شده
          </span>
        </div>

        {adjustments.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            هنوز هیچ امتیاز یا کسر نمره‌ای توسط مجری ثبت نشده است.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold">
                  <th className="py-2.5 px-3">تیم</th>
                  <th className="py-2.5 px-3 text-center">مقدار امتیاز</th>
                  <th className="py-2.5 px-3">دلیل</th>
                  <th className="py-2.5 px-3">رویداد مربوطه</th>
                  <th className="py-2.5 px-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                {adjustments.map((adj) => {
                  const team = teams.find((t) => t.id === adj.teamId);
                  const linkedEvent = events.find((e) => e.id === adj.eventId);
                  const isPos = adj.points > 0;

                  return (
                    <tr key={adj.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3 h-3 rounded-full ${team?.badgeBg || 'bg-slate-500'}`}
                          ></span>
                          <span className="font-bold text-slate-200">
                            {team?.name || 'تیم نامشخص'}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block font-black px-2.5 py-1 rounded-xl text-xs font-mono border ${
                            isPos
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          }`}
                        >
                          {isPos ? `+${toPersianDigits(show(adj.points))}` : toPersianDigits(show(adj.points))}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-medium text-slate-200">
                        {adj.reason}
                      </td>

                      <td className="py-3 px-3 text-slate-400 text-xs">
                        {linkedEvent ? linkedEvent.name : 'تعدیل کلی (سرجمع)'}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => setAdjustmentToDelete(adj)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="حذف این تعدیل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Delete */}
      {adjustmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-base text-white">تأیید حذف تعدیل امتیاز</h4>
                <p className="text-xs text-slate-400">آیا از حذف این رکورد اطمینان دارید؟</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              تعدیل {adjustmentToDelete.points > 0 ? `+${toPersianDigits(show(adjustmentToDelete.points))}` : toPersianDigits(show(adjustmentToDelete.points))} امتیاز به دلیل «{adjustmentToDelete.reason}» پاک خواهد شد.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAdjustmentToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20 cursor-pointer"
              >
                حذف تعدیل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Local toast fallback if onShowToast not provided */}
      {localToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-cyan-500 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{localToast}</span>
        </div>
      )}
    </div>
  );
};
