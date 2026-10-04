import React, { useState, useMemo } from 'react';
import { AppState } from '../../store/state';
import { computeRankHistory, getTotalScale, toScale } from '../../scoring/compute';
import { TEAM_COLOR_PALETTES } from '../../utils/defaultData';
import { toPersianDigits } from '../../utils/persian';
import { TrendingUp, AlertCircle } from 'lucide-react';

interface RankOverTimeChartProps {
  state: AppState;
  height?: number;
  isPrint?: boolean;
}

export const RankOverTimeChart: React.FC<RankOverTimeChartProps> = ({
  state,
  height = 320,
  isPrint = false,
}) => {
  const { teams } = state;
  const { events, history } = useMemo(() => computeRankHistory(state), [state]);
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);

  // Fallback color map helper
  const getTeamColor = (teamId: string, idx: number): string => {
    const team = teams.find((t) => t.id === teamId);
    if (team?.color && team.color.startsWith('#')) return team.color;
    const palette = TEAM_COLOR_PALETTES[idx % TEAM_COLOR_PALETTES.length];
    return palette?.color || '#06b6d4';
  };

  // If fewer than 2 closed events, show informative message
  if (events.length < 1) {
    return (
      <div className={`p-8 rounded-2xl border text-center space-y-2 ${
        isPrint ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900/60 border-slate-800 text-slate-400'
      }`}>
        <TrendingUp className="w-8 h-8 mx-auto opacity-50 text-cyan-400" />
        <h4 className="font-bold text-sm">نمودار روند تغییرات رتبه‌ها</h4>
        <p className="text-xs max-w-sm mx-auto">
          برای رسم خطوط تغییر رتبه، حداقل باید یک رویداد به وضعیت «بسته‌شده» درآید. با پایان هر مسابقه، نمودار به صورت خودکار به‌روزرسانی خواهد شد.
        </p>
      </div>
    );
  }

  // Chart dimensions & margins
  const width = 800;
  const paddingLeft = 60;
  const paddingRight = 80;
  const paddingTop = 40;
  const paddingBottom = 50;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const totalTeams = Math.max(teams.length, 1);
  const totalSteps = events.length;

  // X coordinate for event milestone
  const getX = (stepIndex: number): number => {
    if (totalSteps <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (stepIndex / (totalSteps - 1)) * chartWidth;
  };

  // Y coordinate for rank (Rank 1 is at top, Rank totalTeams is at bottom)
  const getY = (rank: number): number => {
    if (totalTeams <= 1) return paddingTop + chartHeight / 2;
    const normalized = (rank - 1) / (totalTeams - 1); // 0 at rank 1, 1 at lowest
    return paddingTop + normalized * chartHeight;
  };

  return (
    <div className={`w-full rounded-2xl border p-4 space-y-3 ${
      isPrint ? 'bg-white border-slate-300 text-slate-900' : 'bg-slate-900/90 border-slate-800 text-white'
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 border-slate-800/80">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <h4 className="font-bold text-xs sm:text-sm">
            نمودار خطی تغییرات رتبه تیم‌ها در طول مسابقات
          </h4>
        </div>
        <div className="text-[11px] text-slate-400">
          (رتبه ۱ در بالاترین نقطه نمودار قرار دارد)
        </div>
      </div>

      {/* SVG Container */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[500px] select-none"
          style={{ maxHeight: height }}
        >
          {/* Background grid lines for each rank */}
          {Array.from({ length: totalTeams }, (_, i) => i + 1).map((rank) => {
            const y = getY(rank);
            return (
              <g key={`grid-rank-${rank}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke={isPrint ? '#e2e8f0' : '#1e293b'}
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 12}
                  y={y + 4}
                  textAnchor="end"
                  fill={isPrint ? '#475569' : '#94a3b8'}
                  fontSize="11"
                  fontWeight="bold"
                >
                  رتبه {toPersianDigits(rank)}
                </text>
              </g>
            );
          })}

          {/* Event column vertical lines */}
          {events.map((ev, stepIdx) => {
            const x = getX(stepIdx);
            return (
              <g key={`grid-event-${ev.id}`}>
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={height - paddingBottom}
                  stroke={isPrint ? '#cbd5e1' : '#334155'}
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - paddingBottom + 22}
                  textAnchor="middle"
                  fill={isPrint ? '#1e293b' : '#e2e8f0'}
                  fontSize="11"
                  fontWeight="bold"
                >
                  {ev.name}
                </text>
              </g>
            );
          })}

          {/* Lines for each team */}
          {history.map((teamHist, teamIdx) => {
            const team = teams.find((t) => t.id === teamHist.teamId);
            const teamColor = getTeamColor(teamHist.teamId, teamIdx);
            const isHovered = hoveredTeamId === teamHist.teamId;
            const hasHover = hoveredTeamId !== null;

            if (teamHist.points.length === 0) return null;

            // Generate SVG path points
            const pathPoints = teamHist.points.map((pt, ptIdx) => {
              const x = getX(ptIdx);
              const y = getY(pt.rank);
              return `${x},${y}`;
            });

            const pathD = `M ${pathPoints.join(' L ')}`;

            return (
              <g
                key={`line-team-${teamHist.teamId}`}
                onMouseEnter={() => setHoveredTeamId(teamHist.teamId)}
                onMouseLeave={() => setHoveredTeamId(null)}
                className="cursor-pointer transition-opacity"
                opacity={hasHover ? (isHovered ? 1 : 0.25) : 0.9}
              >
                {/* Thick highlight line on hover */}
                {isHovered && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke={teamColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.25"
                  />
                )}

                {/* Primary Team Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={teamColor}
                  strokeWidth={isHovered ? '4' : '2.5'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Dots on each event milestone */}
                {teamHist.points.map((pt, ptIdx) => {
                  const x = getX(ptIdx);
                  const y = getY(pt.rank);
                  return (
                    <g key={`dot-${teamHist.teamId}-${ptIdx}`}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? '6' : '4.5'}
                        fill={teamColor}
                        stroke={isPrint ? '#ffffff' : '#020617'}
                        strokeWidth="2"
                      />
                      {/* Show rank label on dot if hovered */}
                      {isHovered && (
                        <text
                          x={x}
                          y={y - 10}
                          textAnchor="middle"
                          fill={isPrint ? '#0f172a' : '#ffffff'}
                          fontSize="10"
                          fontWeight="bold"
                        >
                          رتبه {toPersianDigits(pt.rank)} ({toPersianDigits(toScale(pt.score || 0, getTotalScale(state)))})
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Right team name label at final point */}
                {(() => {
                  const lastPt = teamHist.points[teamHist.points.length - 1];
                  const lastX = getX(teamHist.points.length - 1);
                  const lastY = getY(lastPt.rank);
                  return (
                    <text
                      x={lastX + 12}
                      y={lastY + 4}
                      fill={teamColor}
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="start"
                    >
                      {team?.name}
                    </text>
                  );
                })()}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 border-t border-slate-800/60">
        {teams.map((t, idx) => {
          const color = getTeamColor(t.id, idx);
          const isSelected = hoveredTeamId === t.id;

          return (
            <button
              key={t.id}
              type="button"
              onMouseEnter={() => setHoveredTeamId(t.id)}
              onMouseLeave={() => setHoveredTeamId(null)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-slate-800 border-white/40 scale-105 shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              ></span>
              <span className={isPrint ? 'text-slate-800' : 'text-slate-200'}>{t.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
