import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { AppState } from '../../store/state';
import { AppAction } from '../../store/actions';
import { TeamStanding, ScoringEvent, BootcampTeam } from '../../types';
import { computeStandings, getEventScale, getTotalScale, toScale } from '../../scoring/compute';
import { toPersianDigits } from '../../utils/persian';
import { sound } from '../../utils/sound';
import { RankOverTimeChart } from './RankOverTimeChart';
import {
  FileSpreadsheet,
  Printer,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Award,
  Trophy,
  Users,
  ShieldAlert,
  FileText,
  CheckCircle2,
  Calendar
} from 'lucide-react';

interface FinalReportViewProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onOpenSmsResultModal: (resultsMap: Record<string, { rank: number; totalTeams: number; grandTotal: number }>) => void;
}

export const FinalReportView: React.FC<FinalReportViewProps> = ({
  state,
  dispatch,
  onOpenSmsResultModal,
}) => {
  const { teams, participants, scoring } = state;
  const { events, judges, scores, notes, adjustments } = scoring;

  // Standings
  const standings = useMemo(() => computeStandings(state), [state]);

  // Expanded teams map for accordion
  const [expandedTeamIds, setExpandedTeamIds] = useState<Record<string, boolean>>({});

  const toggleExpandTeam = (teamId: string) => {
    setExpandedTeamIds((prev) => ({
      ...prev,
      [teamId]: !prev[teamId],
    }));
    sound.playClick();
  };

  // Expand all / Collapse all
  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    teams.forEach((t) => {
      next[t.id] = true;
    });
    setExpandedTeamIds(next);
    sound.playClick();
  };

  const handleCollapseAll = () => {
    setExpandedTeamIds({});
    sound.playClick();
  };

  // Print Report Card
  const handlePrint = () => {
    sound.playClick();
    window.print();
  };

  // Results Map for SMS
  const resultsMap = useMemo(() => {
    const map: Record<string, { rank: number; totalTeams: number; grandTotal: number }> = {};
    standings.forEach((st) => {
      map[st.teamId] = {
        rank: st.rank,
        totalTeams: teams.length,
        grandTotal: toScale(st.grandTotal, getTotalScale(state)),
      };
    });
    return map;
  }, [standings, teams]);

  // Excel Export with 3 sheets: summary, detailed scores, adjustments
  const handleExportExcel = () => {
    sound.playFanfare();

    const wb = XLSX.utils.book_new();

    // 1. Sheet 1: Summary (خلاصه رده‌بندی)
    const summaryHeader = [
      'رتبه',
      'نام تیم',
      'سرگروه',
      'تعداد اعضا',
      ...events.map((e) => `نمره ${e.name} (ضریب ${e.weight})`),
      'تعدیلات مجری',
      'سرجمع نهایی',
      'درصد تکمیل ارزیابی',
    ];

    const summaryRows = standings.map((st) => {
      const team = teams.find((t) => t.id === st.teamId);
      const members = participants.filter((p) => team?.memberIds.includes(p.id));
      const leader = members[0];

      return [
        st.rank,
        team?.name || '',
        leader?.name || '',
        members.length,
        ...events.map((e) => {
          const val = st.eventScores[e.id];
          return val !== null && val !== undefined ? toScale(val, getEventScale(e)) : '—';
        }),
        toScale(st.adjustmentsTotal, getTotalScale(state)),
        toScale(st.grandTotal, getTotalScale(state)),
        `${st.completionPercentage}%`,
      ];
    });

    const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows]);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'خلاصه رده‌بندی');

    // 2. Sheet 2: Detailed Scores (ریز نمرات داوری)
    const detailHeader = [
      'نام رویداد',
      'معیار ارزیابی',
      'ضریب معیار',
      'سقف نمره',
      'نام تیم',
      'نام داور',
      'نمره داده شده',
      'تاریخ ثبت',
    ];

    const detailRows: Array<Array<string | number>> = [];
    for (const ev of events) {
      for (const ind of ev.indicators) {
        for (const team of teams) {
          for (const judge of judges) {
            // Check if judge was allowed
            if (judge.eventIds.length > 0 && !judge.eventIds.includes(ev.id)) continue;

            const key = `${judge.id}|${team.id}|${ind.id}`;
            const entry = scores[key];

            detailRows.push([
              ev.name,
              ind.name,
              ind.weight,
              ind.maxScore,
              team.name,
              judge.name,
              entry?.value !== null && entry?.value !== undefined ? entry.value : 'ثبت نشده',
              entry?.updatedAt ? new Date(entry.updatedAt).toLocaleString('fa-IR') : '—',
            ]);
          }
        }
      }
    }

    const detailWs = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
    XLSX.utils.book_append_sheet(wb, detailWs, 'ریز نمرات داوران');

    // 3. Sheet 3: Adjustments (تعدیلات و امتیاز مجری)
    const adjHeader = [
      'نام تیم',
      'رویداد مربوطه',
      'مقدار امتیاز / جریمه',
      'دلیل',
      'تاریخ ثبت',
    ];

    const adjRows = adjustments.map((adj) => {
      const team = teams.find((t) => t.id === adj.teamId);
      const linkedEvent = events.find((e) => e.id === adj.eventId);
      return [
        team?.name || '',
        linkedEvent ? linkedEvent.name : 'تعدیل سراسری',
        adj.points,
        adj.reason,
        new Date(adj.createdAt).toLocaleString('fa-IR'),
      ];
    });

    const adjWs = XLSX.utils.aoa_to_sheet([adjHeader, ...adjRows]);
    XLSX.utils.book_append_sheet(wb, adjWs, 'امتیازات و جریمه‌های مجری');

    XLSX.writeFile(wb, 'karname-natayej-bootcamp.xlsx');
  };

  return (
    <div className="space-y-6">
      {/* Print Stylesheet */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .team-report-card {
            page-break-after: always;
            break-after: page;
            background-color: #ffffff !important;
            color: #000000 !important;
            border: 1px solid #cbd5e1 !important;
            padding: 24px !important;
            margin-bottom: 24px !important;
            border-radius: 16px !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen Toolbar: Export Excel, Print / PDF, SMS */}
      <div className="no-print bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Trophy className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white">گزارش نهایی و کارنامه مسابقات</h2>
          </div>
          <p className="text-xs text-slate-400">
            خروجی جامع اکسل، چاپ و PDF کارنامه تیم‌ها، ارسال نتایج از طریق پیامک و جزئیات ارزیابی داوران
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* SMS Results button */}
          <button
            onClick={() => {
              sound.playClick();
              onOpenSmsResultModal(resultsMap);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs transition-all cursor-pointer shadow-sm"
          >
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span>پیامک نتیجه به سرگروه‌ها</span>
          </button>

          {/* Excel Export */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>خروجی اکسل (۳ شیت)</span>
          </button>

          {/* Print / PDF */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-cyan-600/20"
          >
            <Printer className="w-4 h-4" />
            <span>چاپ / PDF کارنامه</span>
          </button>
        </div>
      </div>

      {/* Rank Over Time SVG Chart (on screen) */}
      <div className="no-print">
        <RankOverTimeChart state={state} height={340} />
      </div>

      {/* Screen Overview Table: Full Standings with Expandable Detail */}
      <div className="no-print bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-cyan-400" />
            <h3 className="font-bold text-base text-white">جدول تفصیلی نتایج و کارنامه تیم‌ها</h3>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleExpandAll}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              باز کردن همه جزئیات
            </button>
            <span className="text-slate-600">•</span>
            <button
              onClick={handleCollapseAll}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              بستن همه
            </button>
          </div>
        </div>

        {/* Full Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs font-bold bg-slate-950/60">
                <th className="py-3 px-3 w-16 text-center">رتبه</th>
                <th className="py-3 px-3">نام تیم</th>
                <th className="py-3 px-3">سرگروه و اعضا</th>
                {events.map((ev) => (
                  <th key={ev.id} className="py-3 px-2 text-center">
                    <span className="truncate max-w-[90px] block mx-auto">{ev.name}</span>
                  </th>
                ))}
                <th className="py-3 px-3 text-center">تعدیل مجری</th>
                <th className="py-3 px-3 text-center">سرجمع نهایی</th>
                <th className="py-3 px-3 text-center w-20">جزئیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
              {standings.map((st) => {
                const team = teams.find((t) => t.id === st.teamId);
                if (!team) return null;

                const members = participants.filter((p) => team.memberIds.includes(p.id));
                const leader = members[0];
                const isExpanded = !!expandedTeamIds[team.id];

                // Filter notes and adjustments for this team
                const teamNotes = Object.values(notes).filter((n) => n.teamId === team.id);
                const teamAdjs = adjustments.filter((a) => a.teamId === team.id);

                return (
                  <React.Fragment key={team.id}>
                    {/* Main Team Row */}
                    <tr
                      onClick={() => toggleExpandTeam(team.id)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      {/* Rank */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs ${
                            st.rank === 1
                              ? 'bg-amber-400 text-slate-950 font-mono shadow-md shadow-amber-400/20'
                              : st.rank === 2
                              ? 'bg-slate-300 text-slate-950 font-mono'
                              : st.rank === 3
                              ? 'bg-amber-700 text-white font-mono'
                              : 'bg-slate-800 text-slate-400 font-mono'
                          }`}
                        >
                          {toPersianDigits(st.rank)}
                        </span>
                      </td>

                      {/* Team Name */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3.5 h-3.5 rounded-full ${team.badgeBg || ''} border border-white/20`}
                          />
                          <div>
                            <span className="font-bold text-white block">{team.name}</span>
                            {team.tableNumber && (
                              <span className="text-[10px] text-slate-500">
                                {toPersianDigits(team.tableNumber)}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Leader & Members count */}
                      <td className="py-3 px-3 text-slate-300">
                        <div className="text-xs">
                          <span className="font-bold text-slate-200">
                            {leader ? leader.name : '—'}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {toPersianDigits(members.length)} عضو
                          </span>
                        </div>
                      </td>

                      {/* Per Event Scores */}
                      {events.map((ev) => {
                        const evScore = st.eventScores[ev.id];
                        return (
                          <td key={ev.id} className="py-3 px-2 text-center font-mono">
                            {evScore !== null && evScore !== undefined ? (
                              <span className="font-bold text-slate-200">
                                {toPersianDigits(toScale(evScore, getEventScale(ev)))}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Adjustments Total */}
                      <td className="py-3 px-3 text-center font-mono">
                        {st.adjustmentsTotal !== 0 ? (
                          <span
                            className={`font-black text-xs px-2 py-0.5 rounded-lg ${
                              st.adjustmentsTotal > 0
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {st.adjustmentsTotal > 0 ? '+' : ''}
                            {toPersianDigits(toScale(st.adjustmentsTotal, getTotalScale(state)))}
                          </span>
                        ) : (
                          <span className="text-slate-600">۰</span>
                        )}
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-3 text-center font-mono font-black text-cyan-300 text-base">
                        {toPersianDigits(toScale(st.grandTotal, getTotalScale(state)))}
                      </td>

                      {/* Accordion toggle button */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          className="p-1 rounded-lg text-slate-400 hover:text-white"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* EXPANDABLE DETAIL ACCORDION */}
                    {isExpanded && (
                      <tr className="bg-slate-950/80">
                        <td colSpan={6 + events.length} className="p-4 sm:p-6 space-y-4">
                          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-inner">
                            <h4 className="font-bold text-xs sm:text-sm text-cyan-400 flex items-center gap-2">
                              <span>ریز نمرات داوران به تفکیک معیارها برای «{team.name}»</span>
                            </h4>

                            {/* Indicators Table per Event */}
                            <div className="space-y-4">
                              {events.map((ev) => (
                                <div
                                  key={ev.id}
                                  className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2"
                                >
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-300 border-b border-slate-800 pb-1.5">
                                    <span>رویداد: {ev.name} (ضریب {toPersianDigits(ev.weight)})</span>
                                    <span className="text-cyan-400 font-mono">
                                      نمره کل رویداد: {st.eventScores[ev.id] !== null && st.eventScores[ev.id] !== undefined ? toPersianDigits(toScale(st.eventScores[ev.id]!, getEventScale(ev))) : '—'}
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-right text-xs">
                                      <thead>
                                        <tr className="text-slate-500 border-b border-slate-800/60">
                                          <th className="py-1 px-2">معیار</th>
                                          <th className="py-1 px-2 text-center">سقف</th>
                                          <th className="py-1 px-2 text-center">ضریب</th>
                                          {judges.map((j) => (
                                            <th key={j.id} className="py-1 px-2 text-center">
                                              {j.name}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/40">
                                        {ev.indicators.map((ind) => (
                                          <tr key={ind.id}>
                                            <td className="py-1.5 px-2 text-slate-300 font-medium">
                                              {ind.name}
                                            </td>
                                            <td className="py-1.5 px-2 text-center text-slate-500 font-mono">
                                              {toPersianDigits(ind.maxScore)}
                                            </td>
                                            <td className="py-1.5 px-2 text-center text-slate-500 font-mono">
                                              {toPersianDigits(ind.weight)}
                                            </td>
                                            {judges.map((judge) => {
                                              const key = `${judge.id}|${team.id}|${ind.id}`;
                                              const scoreEntry = scores[key];
                                              const val = scoreEntry?.value;

                                              return (
                                                <td
                                                  key={judge.id}
                                                  className="py-1.5 px-2 text-center font-mono font-bold"
                                                >
                                                  {val !== null && val !== undefined ? (
                                                    <span className="text-cyan-300">
                                                      {toPersianDigits(val)}
                                                    </span>
                                                  ) : (
                                                    <span className="text-slate-600">—</span>
                                                  )}
                                                </td>
                                              );
                                            })}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Judge Notes & Adjustments Section */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                              {/* Judge Notes */}
                              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
                                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>یادداشت‌های ثبت‌شده توسط داوران:</span>
                                </span>
                                {teamNotes.length === 0 ? (
                                  <p className="text-[11px] text-slate-500">
                                    یادداشتی برای این تیم ثبت نشده است.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {teamNotes.map((n, idx) => {
                                      const j = judges.find((item) => item.id === n.judgeId);
                                      const e = events.find((item) => item.id === n.eventId);
                                      return (
                                        <div
                                          key={idx}
                                          className="text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800 space-y-0.5"
                                        >
                                          <div className="flex items-center justify-between text-slate-400 font-bold text-[10px]">
                                            <span>{j?.name || 'داور'} ({e?.name || 'رویداد'})</span>
                                          </div>
                                          <p className="text-slate-200">{n.text}</p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Adjustments History */}
                              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 space-y-2">
                                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                                  <span>تاریخچه مودیفایرها و امتیازات مجری:</span>
                                </span>
                                {teamAdjs.length === 0 ? (
                                  <p className="text-[11px] text-slate-500">
                                    هیچ بونوس یا جریمه‌ای برای این تیم ثبت نشده است.
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {teamAdjs.map((a) => (
                                      <div
                                        key={a.id}
                                        className="text-[11px] bg-slate-900 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2"
                                      >
                                        <div>
                                          <span className="font-bold text-slate-200 block">
                                            {a.reason}
                                          </span>
                                          <span className="text-[10px] text-slate-500">
                                            {new Date(a.createdAt).toLocaleDateString('fa-IR')}
                                          </span>
                                        </div>
                                        <span
                                          className={`font-black font-mono px-2 py-0.5 rounded text-xs ${
                                            a.points > 0
                                              ? 'bg-emerald-500/20 text-emerald-400'
                                              : 'bg-rose-500/20 text-rose-400'
                                          }`}
                                        >
                                          {a.points > 0 ? `+${toPersianDigits(a.points)}` : toPersianDigits(a.points)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================== */}
      {/* PRINT-ONLY VIEW: TEAM REPORT CARDS (ONE TEAM PER PAGE) */}
      {/* ============================================================== */}
      <div className="print-only">
        {standings.map((st) => {
          const team = teams.find((t) => t.id === st.teamId);
          if (!team) return null;

          const members = participants.filter((p) => team.memberIds.includes(p.id));
          const leader = members[0];
          const teamNotes = Object.values(notes).filter((n) => n.teamId === team.id);
          const teamAdjs = adjustments.filter((a) => a.teamId === team.id);

          return (
            <div key={`print-card-${team.id}`} className="team-report-card">
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <h1 className="text-xl font-black">کارنامه نهایی ارزیابی تیم</h1>
                  <h2 className="text-base font-bold text-slate-700">{team.name}</h2>
                  {team.tableNumber && (
                    <span className="text-xs text-slate-500">{toPersianDigits(team.tableNumber)}</span>
                  )}
                </div>

                <div className="text-left border p-2 rounded-xl">
                  <div className="text-xs text-slate-500">رتبه نهایی مسابقات:</div>
                  <div className="text-2xl font-black text-slate-900">
                    رتبه {toPersianDigits(st.rank)} از {toPersianDigits(teams.length)}
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    مجموع نمره: {toPersianDigits(toScale(st.grandTotal, getTotalScale(state)))} از {toPersianDigits(getTotalScale(state))}
                  </div>
                </div>
              </div>

              {/* Members */}
              <div className="mb-4">
                <span className="text-xs font-bold text-slate-700">اعضای تیم:</span>
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  {members.map((m, idx) => (
                    <span key={m.id} className="border px-2 py-1 rounded">
                      {m.name} {idx === 0 ? '(سرگروه)' : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Event Scores Breakdown */}
              <div className="mb-4">
                <h3 className="text-sm font-bold border-b pb-1 mb-2">ریز نمرات رویدادها و شاخص‌ها:</h3>
                <table className="w-full text-right text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-slate-100">
                      <th className="p-1.5">رویداد</th>
                      <th className="p-1.5">معیار ارزیابی</th>
                      <th className="p-1.5 text-center">سقف</th>
                      <th className="p-1.5 text-center">ضریب</th>
                      <th className="p-1.5 text-center">میانگین نمره</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {events.map((ev) =>
                      ev.indicators.map((ind) => {
                        // Calculate average of judges for this indicator
                        let sum = 0;
                        let count = 0;
                        for (const j of judges) {
                          const k = `${j.id}|${team.id}|${ind.id}`;
                          const v = scores[k]?.value;
                          if (v !== null && v !== undefined) {
                            sum += v;
                            count++;
                          }
                        }
                        const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : null;

                        return (
                          <tr key={`${ev.id}-${ind.id}`}>
                            <td className="p-1.5 font-bold">{ev.name}</td>
                            <td className="p-1.5">{ind.name}</td>
                            <td className="p-1.5 text-center font-mono">{toPersianDigits(ind.maxScore)}</td>
                            <td className="p-1.5 text-center font-mono">{toPersianDigits(ind.weight)}</td>
                            <td className="p-1.5 text-center font-mono font-bold">
                              {avg !== null ? toPersianDigits(avg) : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Adjustments & Notes */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="border p-2 rounded">
                  <h4 className="font-bold mb-1">تعدیلات و امتیازات مجری:</h4>
                  {teamAdjs.length === 0 ? (
                    <span className="text-slate-500">موردی ثبت نشده است.</span>
                  ) : (
                    teamAdjs.map((a) => (
                      <div key={a.id} className="flex justify-between py-0.5 border-b">
                        <span>{a.reason}</span>
                        <span className="font-bold">{a.points > 0 ? `+${a.points}` : a.points}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="border p-2 rounded">
                  <h4 className="font-bold mb-1">بازخورد و یادداشت‌های داوران:</h4>
                  {teamNotes.length === 0 ? (
                    <span className="text-slate-500">یادداشتی ثبت نشده است.</span>
                  ) : (
                    teamNotes.map((n, i) => (
                      <div key={i} className="py-0.5 border-b">
                        <span className="text-slate-600 block text-[10px]">
                          {judges.find((j) => j.id === n.judgeId)?.name}:
                        </span>
                        <span>{n.text}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
