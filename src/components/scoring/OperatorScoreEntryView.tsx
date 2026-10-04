import React, { useState, useMemo, useRef } from 'react';
import { AppState } from '../../store/state';
import { AppAction } from '../../store/actions';
import { ScoringEvent, Judge, BootcampTeam } from '../../types';
import { computeEventScore, getEventMax, roundToOneDecimal } from '../../scoring/compute';
import { toPersianDigits } from '../../utils/persian';
import { 
  Users, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  Grid, 
  Table, 
  HelpCircle,
  FileCheck,
  Lock,
  Flame,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

interface OperatorScoreEntryViewProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export const OperatorScoreEntryView: React.FC<OperatorScoreEntryViewProps> = ({ state, dispatch }) => {
  const { events, judges, scores } = state.scoring;
  const teams = state.teams;

  // Selected event (default to first active event or first event)
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    const active = events.find((e) => e.status === 'active');
    return active ? active.id : events[0]?.id || '';
  });

  // Selected judge
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>(() => {
    return judges[0]?.id || '';
  });

  // View mode: 'grid' (numeric entry) or 'matrix' (completion overview)
  const [viewMode, setViewMode] = useState<'grid' | 'matrix'>('grid');

  // Input draft values to allow typing invalid numbers temporarily without saving
  const [cellDrafts, setCellDrafts] = useState<Record<string, string>>({});

  const selectedEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) || events[0] || null;
  }, [events, selectedEventId]);

  // Judges eligible for this event
  const eligibleJudges = useMemo(() => {
    if (!selectedEvent) return judges;
    return judges.filter(
      (j) => j.eventIds.length === 0 || j.eventIds.includes(selectedEvent.id)
    );
  }, [judges, selectedEvent]);

  // Ensure selected judge is valid
  const currentJudge = useMemo(() => {
    return judges.find((j) => j.id === selectedJudgeId) || eligibleJudges[0] || judges[0] || null;
  }, [judges, selectedJudgeId, eligibleJudges]);

  // Calculate completion percentage for the selected judge on this event
  const judgeProgress = useMemo(() => {
    if (!selectedEvent || !currentJudge || teams.length === 0 || selectedEvent.indicators.length === 0) {
      return { total: 0, filled: 0, percentage: 0 };
    }

    const total = selectedEvent.indicators.length * teams.length;
    let filled = 0;

    for (const team of teams) {
      for (const ind of selectedEvent.indicators) {
        const key = `${currentJudge.id}|${team.id}|${ind.id}`;
        const entry = scores[key];
        if (entry && entry.value !== null && entry.value !== undefined) {
          filled++;
        }
      }
    }

    const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
    return { total, filled, percentage };
  }, [selectedEvent, currentJudge, teams, scores]);

  // Cell key helper
  const getCellKey = (judgeId: string, teamId: string, indicatorId: string) =>
    `${judgeId}|${teamId}|${indicatorId}`;

  // Handle cell input change
  const handleCellChange = (
    teamId: string,
    indicatorId: string,
    rawText: string,
    maxScore: number
  ) => {
    if (!selectedEvent || !currentJudge) return;

    const cellKey = getCellKey(currentJudge.id, teamId, indicatorId);
    
    // Convert Persian digits to English
    const normalized = rawText.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());

    setCellDrafts((prev) => ({ ...prev, [cellKey]: normalized }));

    // Empty input -> clear score (dispatch value: null)
    if (normalized.trim() === '') {
      dispatch({
        type: 'SET_SCORE',
        payload: {
          judgeId: currentJudge.id,
          teamId,
          eventId: selectedEvent.id,
          indicatorId,
          value: null,
          updatedAt: new Date().toISOString(),
          source: 'operator',
        },
      });
      return;
    }

    const num = Number(normalized);
    // Only save if valid integer from 0 to maxScore
    if (!isNaN(num) && Number.isInteger(num) && num >= 0 && num <= maxScore) {
      dispatch({
        type: 'SET_SCORE',
        payload: {
          judgeId: currentJudge.id,
          teamId,
          eventId: selectedEvent.id,
          indicatorId,
          value: num,
          updatedAt: new Date().toISOString(),
          source: 'operator',
        },
      });
    }
  };

  // Keyboard navigation between cells respecting RTL
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number,
    numRows: number,
    numCols: number
  ) => {
    let nextRow = rowIndex;
    let nextCol = colIndex;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        nextRow = Math.max(0, rowIndex - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        nextRow = Math.min(numRows - 1, rowIndex + 1);
        break;
      case 'ArrowLeft':
        // In RTL, moving left moves to next column (colIndex + 1)
        e.preventDefault();
        nextCol = Math.min(numCols - 1, colIndex + 1);
        break;
      case 'ArrowRight':
        // In RTL, moving right moves to previous column (colIndex - 1)
        e.preventDefault();
        nextCol = Math.max(0, colIndex - 1);
        break;
      case 'Enter':
        e.preventDefault();
        // Move down row; if at bottom, move to next column first row
        if (rowIndex < numRows - 1) {
          nextRow = rowIndex + 1;
        } else if (colIndex < numCols - 1) {
          nextRow = 0;
          nextCol = colIndex + 1;
        }
        break;
      default:
        return;
    }

    const nextId = `score-cell-${nextRow}-${nextCol}`;
    const nextElem = document.getElementById(nextId) as HTMLInputElement | null;
    if (nextElem) {
      nextElem.focus();
      nextElem.select();
    }
  };

  if (events.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
        <Award className="w-16 h-16 text-slate-600 mx-auto" />
        <h3 className="text-lg font-bold text-slate-300">هیچ رویدادی تعریف نشده است</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          برای ثبت نمرات، ابتدا از تب «تنظیمات» رویدادها و معیارهای سنجش را ایجاد کنید یا نمونه آماده را بارگذاری نمایید.
        </p>
      </div>
    );
  }

  if (judges.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-4">
        <Users className="w-16 h-16 text-slate-600 mx-auto" />
        <h3 className="text-lg font-bold text-slate-300">هیچ داوری ثبت نشده است</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          برای ثبت نمرات توسط اپراتور یا ورود داوران، ابتدا در تب «تنظیمات» داوران را با نام و کد ورود اضافه کنید.
        </p>
      </div>
    );
  }

  const indicators = selectedEvent?.indicators || [];

  return (
    <div className="space-y-6">
      {/* Top Header & Selector Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
              <h2 className="text-lg sm:text-xl font-black text-white">ثبت امتیاز اپراتور (نسخه لپ‌تاپ)</h2>
            </div>
            <p className="text-xs text-slate-400">
              ثبت مستقیم نمرات داوران توسط اپراتور مسابقه (مناسب برای فرم‌های کاغذی یا بازبینی نمرات)
            </p>
          </div>

          {/* View Mode Toggle: Grid vs Matrix */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid className="w-4 h-4" />
              <span>شبکه ثبت نمرات</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>ماتریس تکمیل داوران</span>
            </button>
          </div>
        </div>

        {/* Event and Judge selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-800/80">
          {/* Select Event */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>انتخاب رویداد / مسابقه:</span>
              {selectedEvent && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    selectedEvent.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : selectedEvent.status === 'closed'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {selectedEvent.status === 'active'
                    ? 'در جریان'
                    : selectedEvent.status === 'closed'
                    ? 'بسته‌شده (فقط اپراتور مجاز است)'
                    : 'پیش‌رو'}
                </span>
              )}
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} (ضریب {toPersianDigits(ev.weight)})
                </option>
              ))}
            </select>
          </div>

          {/* Select Judge */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>انتخاب داور (ورود به نیابت):</span>
              {currentJudge && (
                <span className="text-[10px] text-cyan-400 font-mono bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-800/50">
                  کد: {currentJudge.accessCode}
                </span>
              )}
            </label>
            <select
              value={currentJudge?.id || ''}
              onChange={(e) => setSelectedJudgeId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-2xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {eligibleJudges.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name} {j.eventIds.length === 0 ? '(همه رویدادها)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Completion Progress Bar */}
          <div className="space-y-2 md:col-span-2 lg:col-span-1 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 flex flex-col justify-center">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300">پیشرفت ثبت نمرات داور:</span>
              <span className="text-cyan-400">
                {toPersianDigits(judgeProgress.filled)} از {toPersianDigits(judgeProgress.total)} نمره (
                {toPersianDigits(judgeProgress.percentage)}٪)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${judgeProgress.percentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* MATRIX VIEW */}
      {viewMode === 'matrix' && selectedEvent && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Table className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-base text-white">
                ماتریس تکمیل داوران در رویداد «{selectedEvent.name}»
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              برای ثبت نمرات هر داور، روی ردیف یا درصد مربوطه کلیک کنید
            </span>
          </div>

          <div className="overflow-x-auto pb-2">
            <table className="w-full text-right border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold">
                  <th className="py-3 px-4 w-48 bg-slate-950/60 rounded-r-xl">نام داور</th>
                  {teams.map((t) => (
                    <th key={t.id} className="py-3 px-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`w-3.5 h-3.5 rounded-full ${t.badgeBg} border border-white/20`}></span>
                        <span className="text-xs text-slate-200 truncate max-w-[100px]">{t.name}</span>
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-4 text-center bg-slate-950/60 rounded-l-xl w-32">مجموع تکمیل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {eligibleJudges.map((judge) => {
                  let judgeTotalFilled = 0;
                  const judgeTotalCells = teams.length * indicators.length;

                  return (
                    <tr
                      key={judge.id}
                      onClick={() => {
                        setSelectedJudgeId(judge.id);
                        setViewMode('grid');
                      }}
                      className={`hover:bg-slate-800/50 transition-colors cursor-pointer ${
                        currentJudge?.id === judge.id ? 'bg-indigo-950/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                          <span>{judge.name}</span>
                        </div>
                      </td>

                      {teams.map((team) => {
                        let teamFilled = 0;
                        for (const ind of indicators) {
                          const key = `${judge.id}|${team.id}|${ind.id}`;
                          if (scores[key]?.value !== null && scores[key]?.value !== undefined) {
                            teamFilled++;
                            judgeTotalFilled++;
                          }
                        }
                        const teamPercent =
                          indicators.length > 0
                            ? Math.round((teamFilled / indicators.length) * 100)
                            : 0;

                        return (
                          <td key={team.id} className="py-2 px-2 text-center">
                            <span
                              className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border ${
                                teamPercent === 100
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                  : teamPercent > 0
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-slate-800/80 text-slate-500 border-slate-700/60'
                              }`}
                            >
                              {teamPercent === 100 && <CheckCircle2 className="w-3 h-3" />}
                              <span>{toPersianDigits(teamPercent)}٪</span>
                            </span>
                          </td>
                        );
                      })}

                      <td className="py-3 px-4 text-center">
                        {(() => {
                          const totalPct =
                            judgeTotalCells > 0
                              ? Math.round((judgeTotalFilled / judgeTotalCells) * 100)
                              : 0;
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-black border ${
                                totalPct === 100
                                  ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
                                  : totalPct > 0
                                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                  : 'bg-slate-800 text-slate-500 border-slate-700'
                              }`}
                            >
                              {toPersianDigits(totalPct)}٪
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRID VIEW: NUMERIC SCORE ENTRY */}
      {viewMode === 'grid' && selectedEvent && currentJudge && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  جدول ورود نمرات داور «{currentJudge.name}»
                </h3>
                <p className="text-xs text-slate-400">
                  برای حرکت سریع بین خانه‌ها از کلیدهای جهت‌نما (↑ ↓ → ←) یا Enter و Tab استفاده کنید.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-800 border border-slate-700"></span>
                <span>خالی</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-cyan-950/60 border border-cyan-500/50"></span>
                <span>ثبت‌شده</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-950/60 border border-rose-500"></span>
                <span>غیرمجاز (بیش از سقف)</span>
              </div>
            </div>
          </div>

          {/* Grid Table */}
          <div className="overflow-x-auto pb-4">
            <table className="w-full text-right border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b-2 border-slate-800">
                  <th className="py-3 px-4 w-64 bg-slate-950/70 text-slate-300 font-bold text-xs rounded-tr-2xl">
                    معیارها / تیم‌ها
                  </th>
                  {teams.map((team, cIdx) => (
                    <th
                      key={team.id}
                      className="py-3 px-3 text-center bg-slate-950/50 border-r border-slate-800/80"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`w-3.5 h-3.5 rounded-full ${team.badgeBg} border border-white/20`}
                        ></span>
                        <span className="font-bold text-xs text-slate-100 truncate max-w-[120px]">
                          {team.name}
                        </span>
                        {team.tableNumber && (
                          <span className="text-[10px] text-slate-500">
                            {toPersianDigits(team.tableNumber)}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {indicators.map((indicator, rIdx) => {
                  return (
                    <tr key={indicator.id} className="hover:bg-slate-800/20">
                      {/* Indicator header cell */}
                      <td className="py-3 px-4 bg-slate-950/40 border-l border-slate-800/60">
                        <div className="space-y-0.5">
                          <div className="font-bold text-xs sm:text-sm text-slate-200">
                            {indicator.name}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>سقف نمره: {toPersianDigits(indicator.maxScore)}</span>
                            <span>•</span>
                            <span>ضریب: {toPersianDigits(indicator.weight)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Team score inputs */}
                      {teams.map((team, cIdx) => {
                        const cellKey = getCellKey(currentJudge.id, team.id, indicator.id);
                        const storeEntry = scores[cellKey];
                        const storeValue = storeEntry?.value;
                        const hasDraft = cellDrafts[cellKey] !== undefined;
                        const displayVal = hasDraft
                          ? cellDrafts[cellKey]
                          : storeValue !== null && storeValue !== undefined
                          ? String(storeValue)
                          : '';

                        const isInvalid =
                          displayVal.trim() !== '' &&
                          (isNaN(Number(displayVal)) ||
                            !Number.isInteger(Number(displayVal)) ||
                            Number(displayVal) < 0 ||
                            Number(displayVal) > indicator.maxScore);

                        const isFilled =
                          displayVal.trim() !== '' && !isInvalid;

                        return (
                          <td
                            key={team.id}
                            className="p-2 text-center border-r border-slate-800/60 align-middle"
                          >
                            <div className="relative flex items-center justify-center">
                              <input
                                id={`score-cell-${rIdx}-${cIdx}`}
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={displayVal}
                                onChange={(e) =>
                                  handleCellChange(
                                    team.id,
                                    indicator.id,
                                    e.target.value,
                                    indicator.maxScore
                                  )
                                }
                                onKeyDown={(e) =>
                                  handleKeyDown(
                                    e,
                                    rIdx,
                                    cIdx,
                                    indicators.length,
                                    teams.length
                                  )
                                }
                                placeholder="—"
                                className={`w-16 h-10 text-center font-black text-sm rounded-xl border transition-all outline-none ${
                                  isInvalid
                                    ? 'bg-rose-950/70 border-rose-500 text-rose-300 ring-2 ring-rose-500/50'
                                    : isFilled
                                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30'
                                    : 'bg-slate-950/60 border-slate-800 text-slate-300 placeholder-slate-600 focus:border-cyan-500 focus:bg-slate-900'
                                }`}
                              />

                              {isInvalid && (
                                <div className="absolute -bottom-5 z-10 text-[9px] font-bold text-rose-400 bg-slate-950 px-1.5 py-0.5 rounded border border-rose-800/50 shadow whitespace-nowrap">
                                  حداکثر {toPersianDigits(indicator.maxScore)}
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* BOTTOM ROW: LIVE TEAM EVENT SCORE (0-100) */}
                <tr className="bg-slate-950/90 border-t-2 border-slate-700 font-bold">
                  <td className="py-3 px-4 text-xs font-black text-cyan-400 rounded-br-2xl">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-cyan-400" />
                      <span>نمره زنده رویداد (جمع امتیازها، تا {toPersianDigits(getEventMax(selectedEvent))})</span>
                    </div>
                  </td>
                  {teams.map((team) => {
                    const eventScore = computeEventScore(state, selectedEvent.id, team.id);
                    return (
                      <td
                        key={team.id}
                        className="py-3 px-2 text-center border-r border-slate-800"
                      >
                        {eventScore !== null ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="text-sm font-black text-cyan-300">
                              {toPersianDigits(roundToOneDecimal(eventScore))}
                            </span>
                            <span className="text-[10px] text-slate-500">از {toPersianDigits(getEventMax(selectedEvent))}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600 font-mono">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
