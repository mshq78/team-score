import React, { useMemo, useState } from 'react';
import type { AppState } from '../../store/state';
import type { AppAction } from '../../store/actions';
import { computeIndividualStandings } from '../../scoring/individuals';
import { toPersianDigits } from '../../utils/persian';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onShowToast?: (message: string) => void;
}

const inputCls = 'bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white';

/** Operator tab: define the criteria for judging individual people (per event) and see the individual ranking. */
export const PeopleView: React.FC<Props> = ({ state, dispatch, onShowToast }) => {
  const criteria = state.scoring.personCriteria ?? [];
  const [name, setName] = useState('');
  const [max, setMax] = useState('10');
  const standings = useMemo(() => computeIndividualStandings(state), [state]);

  const add = () => {
    const maxScore = Number(max);
    if (!name.trim() || !Number.isInteger(maxScore) || maxScore < 1 || maxScore > 100) {
      return onShowToast?.('نام معیار و حداکثر امتیاز (۱ تا ۱۰۰) را درست وارد کنید');
    }
    dispatch({ type: 'ADD_PERSON_CRITERION', payload: { id: `pc-${Date.now().toString(36)}`, name, maxScore, order: 0 } });
    setName('');
  };

  const exportCsv = () => {
    const head = ['رتبه', 'نام', 'تیم', ...criteria.map((c) => c.name), 'مجموع', 'درصد', 'تعداد داور'];
    const rows = standings.map((r) => [
      r.rank ?? '', r.name, r.teamName, ...criteria.map((c) => r.perCriterion[c.id] ?? ''), r.total, r.percent, r.judgesCount,
    ]);
    const csv = '﻿' + [head, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `teamkeshi-individuals-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 500);
  };

  return (
    <div className="space-y-6 text-right">
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="text-base font-black text-white">معیارهای ارزیابی افراد</h2>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            معیارها مخصوص همین رویداد است (مثلاً اخلاق، مشارکت، رهبری). داورها در پنل خودشان به هر نفر برای هر معیار امتیاز می‌دهند.
            این امتیازها جدا از رتبه‌بندی تیم‌ها حساب می‌شود و برای تقدیر فردی است.
          </p>
        </div>

        {criteria.length === 0 && <p className="text-xs text-amber-300">هنوز معیاری تعریف نشده؛ داورها بخش «افراد» را نمی‌بینند.</p>}
        <ul className="space-y-2">
          {criteria.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2">
              <input
                defaultValue={c.name}
                maxLength={40}
                onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && dispatch({ type: 'UPDATE_PERSON_CRITERION', payload: { id: c.id, name: e.target.value } })}
                className={`${inputCls} flex-1 min-w-[8rem]`}
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                حداکثر
                <input
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={c.maxScore}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isInteger(v) && v >= 1 && v <= 100 && v !== c.maxScore) dispatch({ type: 'UPDATE_PERSON_CRITERION', payload: { id: c.id, maxScore: v } });
                  }}
                  className={`${inputCls} w-20`}
                />
              </label>
              <button
                onClick={() => window.confirm(`معیار «${c.name}» و امتیازهای آن حذف شود؟`) && dispatch({ type: 'DELETE_PERSON_CRITERION', payload: { id: c.id } })}
                className="px-3 py-2 rounded-lg bg-rose-950/50 border border-rose-900/60 text-rose-300 text-xs font-bold cursor-pointer"
              >
                حذف
              </button>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="نام معیار (مثلاً اخلاق)" className={`${inputCls} flex-1 min-w-[10rem]`} />
          <input type="number" min={1} max={100} value={max} onChange={(e) => setMax(e.target.value)} className={`${inputCls} w-20`} title="حداکثر امتیاز" />
          <button onClick={add} className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-black cursor-pointer">افزودن معیار</button>
        </div>
      </section>

      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-black text-white">رتبه‌بندی افراد</h2>
          <button onClick={exportCsv} disabled={!standings.length} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer disabled:opacity-50">
            خروجی CSV
          </button>
        </div>
        {criteria.length === 0 ? (
          <p className="text-xs text-slate-400">بعد از تعریف معیارها و امتیازدهی داورها، نتیجه اینجا می‌آید.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="py-2 px-2 text-right">رتبه</th>
                  <th className="py-2 px-2 text-right">نام</th>
                  <th className="py-2 px-2 text-right">تیم</th>
                  {criteria.map((c) => (
                    <th key={c.id} className="py-2 px-2 text-right whitespace-nowrap">{c.name} <span className="text-slate-600">/{toPersianDigits(c.maxScore)}</span></th>
                  ))}
                  <th className="py-2 px-2 text-right">مجموع</th>
                  <th className="py-2 px-2 text-right">داور</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((r) => (
                  <tr key={r.participantId} className={`border-b border-slate-800/60 ${r.rank === null ? 'text-slate-500' : 'text-slate-100'}`}>
                    <td className="py-1.5 px-2 font-mono font-bold text-amber-300">{r.rank === null ? '—' : toPersianDigits(r.rank)}</td>
                    <td className="py-1.5 px-2 font-bold">{r.name}</td>
                    <td className="py-1.5 px-2 text-slate-400">{r.teamName || '—'}</td>
                    {criteria.map((c) => (
                      <td key={c.id} className="py-1.5 px-2 font-mono">{r.perCriterion[c.id] === null ? '—' : toPersianDigits(r.perCriterion[c.id] as number)}</td>
                    ))}
                    <td className="py-1.5 px-2 font-mono font-black text-cyan-300">{r.judgesCount ? toPersianDigits(r.total) : '—'}</td>
                    <td className="py-1.5 px-2 font-mono">{toPersianDigits(r.judgesCount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
