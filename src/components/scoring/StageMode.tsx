import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { AppState } from '../../store/state';
import { AppAction } from '../../store/actions';
import { TeamStanding, ScoringEvent, BootcampTeam } from '../../types';
import { computeStandings, computeEventWinners, getDisplayedStandings, getEventMax, roundToOneDecimal } from '../../scoring/compute';
import { toPersianDigits } from '../../utils/persian';
import { sound } from '../../utils/sound';
import { TEAM_COLOR_PALETTES } from '../../utils/defaultData';
import { AnimatedCounter } from './AnimatedCounter';
import { RankOverTimeChart } from './RankOverTimeChart';
import {
  Trophy,
  Award,
  Crown,
  Lock,
  Unlock,
  Play,
  Maximize2,
  Minimize2,
  X,
  TrendingUp,
  Volume2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface StageModeProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export const StageMode: React.FC<StageModeProps> = ({ state, dispatch }) => {
  const { teams, participants, settings } = state;
  const { displaySize, displayTheme } = settings;
  const { events, settings: scoringSettings } = state.scoring;
  const { leaderboardFrozen, announceEventAwardsFirst } = scoringSettings;

  // View state: 'leaderboard' or 'reveal'
  const [activeSubMode, setActiveSubMode] = useState<'leaderboard' | 'reveal'>('leaderboard');
  const [showChartModal, setShowChartModal] = useState(false);

  // Auto-hiding control bar
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Track previous ranks for ▲/▼ delta indicators
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});
  const initialMountRef = useRef(true);

  // Compute live or frozen standings
  const currentStandings: TeamStanding[] = useMemo(() => getDisplayedStandings(state), [state]);

  // The reveal must always announce the real (live) results, even while the
  // leaderboard is frozen.
  const liveStandings: TeamStanding[] = useMemo(() => computeStandings(state), [state]);

  // Update previous rankings when standings change
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      const initialMap: Record<string, number> = {};
      currentStandings.forEach((s) => {
        initialMap[s.teamId] = s.rank;
      });
      setPreviousRanks(initialMap);
      return;
    }

    // Only update previousRanks if ranks actually changed
    let hasRankChange = false;
    for (const s of currentStandings) {
      if (previousRanks[s.teamId] !== undefined && previousRanks[s.teamId] !== s.rank) {
        hasRankChange = true;
        break;
      }
    }

    if (hasRankChange) {
      sound.playPop();
      const timer = setTimeout(() => {
        const nextMap: Record<string, number> = {};
        currentStandings.forEach((s) => {
          nextMap[s.teamId] = s.rank;
        });
        setPreviousRanks(nextMap);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentStandings]);

  // Mouse activity tracker to show/hide controls
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      hideControlsTimerRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    };
  }, []);

  // Keyboard shortcut: F key toggles fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        // Toggle fullscreen
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Leaderboard Freeze / Unfreeze
  const handleToggleFreeze = () => {
    if (leaderboardFrozen) {
      dispatch({ type: 'UNFREEZE_LEADERBOARD' });
      sound.playClick();
    } else {
      const snapshot = computeStandings(state);
      dispatch({
        type: 'FREEZE_LEADERBOARD',
        payload: { snapshot },
      });
      sound.playClick();
    }
  };

  // Exit Stage Mode -> back to scoring
  const handleExitStage = () => {
    dispatch({
      type: 'SET_SETTINGS',
      payload: { mode: 'scoring' },
    });
    sound.playClick();
  };

  // Display size styling classes
  const sizeClasses = {
    normal: {
      teamName: 'text-base sm:text-lg',
      leaderName: 'text-xs',
      scoreText: 'text-xl sm:text-2xl',
      badgeSize: 'w-8 h-8 text-sm',
      barPadding: 'py-3 px-4',
      gap: 'space-y-2.5',
    },
    projector: {
      teamName: 'text-xl sm:text-2xl',
      leaderName: 'text-sm',
      scoreText: 'text-2xl sm:text-3xl',
      badgeSize: 'w-10 h-10 text-base',
      barPadding: 'py-4 px-5',
      gap: 'space-y-3.5',
    },
    auditorium: {
      teamName: 'text-2xl sm:text-3xl',
      leaderName: 'text-base',
      scoreText: 'text-3xl sm:text-4xl',
      badgeSize: 'w-12 h-12 text-lg',
      barPadding: 'py-5 px-6',
      gap: 'space-y-4',
    },
  }[displaySize];

  // Fallback color map helper
  const getTeamColor = (teamId: string, idx: number): string => {
    const team = teams.find((t) => t.id === teamId);
    if (team?.color && team.color.startsWith('#')) return team.color;
    const palette = TEAM_COLOR_PALETTES[idx % TEAM_COLOR_PALETTES.length];
    return palette?.color || '#06b6d4';
  };

  // ==============================================================
  // REVEAL LOGIC & STATE
  // ==============================================================
  const eventWinners = useMemo(() => computeEventWinners(state), [state]);
  const closedEventsWithWinners = useMemo(() => {
    return events.filter((e) => e.status === 'closed' && eventWinners[e.id]);
  }, [events, eventWinners]);

  // Steps in reveal sequence:
  // 1) Optional event awards (if announceEventAwardsFirst is true)
  // 2) Overall standings from lowest rank to 1st place!
  const revealSteps = useMemo(() => {
    const steps: Array<
      | { type: 'event_award'; event: ScoringEvent; winnerTeamId: string; score: number }
      | { type: 'team_rank'; standing: TeamStanding; rankIndex: number; isTop3: boolean; isWinner: boolean }
    > = [];

    // Optional event awards first
    if (announceEventAwardsFirst) {
      for (const ev of closedEventsWithWinners) {
        const win = eventWinners[ev.id];
        if (win) {
          steps.push({
            type: 'event_award',
            event: ev,
            winnerTeamId: win.teamId,
            score: win.score,
          });
        }
      }
    }

    // Sort standings ascending by rank descending:
    // e.g. Rank 6 first, then Rank 5, ..., down to Rank 1 last!
    const standingsByRankDesc = [...liveStandings].sort((a, b) => b.rank - a.rank);

    standingsByRankDesc.forEach((st, idx) => {
      const isWinner = st.rank === 1;
      const isTop3 = st.rank <= 3;
      steps.push({
        type: 'team_rank',
        standing: st,
        rankIndex: idx,
        isTop3,
        isWinner,
      });
    });

    return steps;
  }, [announceEventAwardsFirst, closedEventsWithWinners, eventWinners, liveStandings]);

  // Current revealed step index (-1 = intro screen before revealing)
  const [currentRevealStep, setCurrentRevealStep] = useState<number>(-1);
  const [isRevealingTop3, setIsRevealingTop3] = useState(false);

  // Trigger celebration effects for 1st place
  const triggerWinnerCelebration = () => {
    sound.playFanfare();
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5 },
    });
    setTimeout(() => {
      confetti({
        particleCount: 100,
        angle: 60,
        spread: 70,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 100,
        angle: 120,
        spread: 70,
        origin: { x: 1 },
      });
    }, 300);
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.7 },
      });
    }, 600);
  };

  // Move forward in reveal
  const handleRevealNext = () => {
    if (isRevealingTop3) return;
    if (currentRevealStep >= revealSteps.length - 1) return;

    const nextIndex = currentRevealStep + 1;
    const nextStep = revealSteps[nextIndex];

    if (nextStep && nextStep.type === 'team_rank' && nextStep.isTop3) {
      // Top 3 reveal with pause and drumroll!
      setIsRevealingTop3(true);
      sound.playDrumroll(2.2);

      setTimeout(() => {
        setCurrentRevealStep(nextIndex);
        setIsRevealingTop3(false);
        if (nextStep.isWinner) {
          triggerWinnerCelebration();
        } else {
          sound.playPop();
        }
      }, 2000);
    } else {
      setCurrentRevealStep(nextIndex);
      sound.playClick();
    }
  };

  // Move back in reveal with Backspace or button
  const handleRevealPrev = () => {
    if (isRevealingTop3) return;
    if (currentRevealStep > -1) {
      setCurrentRevealStep((prev) => prev - 1);
      sound.playClick();
    }
  };

  // Reveal Keyboard shortcuts: Space, Arrow keys, Enter, Backspace
  useEffect(() => {
    if (activeSubMode !== 'reveal') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'Enter') {
        e.preventDefault();
        handleRevealNext();
      } else if (e.key === 'Backspace' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleRevealPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSubMode, currentRevealStep, isRevealingTop3, revealSteps]);

  // ==============================================================
  // RENDER: SUB-MODE 'REVEAL' (ANNOUNCING CEREMONY)
  // ==============================================================
  if (activeSubMode === 'reveal') {
    const step = currentRevealStep >= 0 ? revealSteps[currentRevealStep] : null;

    return (
      <div
        className={`min-h-screen flex flex-col justify-between p-6 sm:p-10 select-none font-['Vazirmatn',sans-serif] ${
          displayTheme === 'dark-neon'
            ? 'bg-slate-950 text-slate-100'
            : 'bg-slate-100 text-slate-900'
        }`}
      >
        {/* Top Controls Bar */}
        <div className="flex items-center justify-between z-30">
          <button
            onClick={() => {
              setActiveSubMode('leaderboard');
              sound.playClick();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold transition-all cursor-pointer shadow-lg"
          >
            <ChevronRight className="w-4 h-4" />
            <span>بازگشت به جدول زنده</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/50 px-3 py-1.5 rounded-xl">
              {currentRevealStep === -1
                ? 'آماده‌سازی مراسم اعلام نتایج'
                : `مرحله ${toPersianDigits(currentRevealStep + 1)} از ${toPersianDigits(
                    revealSteps.length
                  )}`}
            </span>

            <button
              onClick={() => {
                setCurrentRevealStep(-1);
                sound.playClick();
              }}
              title="شروع مجدد مراسم"
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Presentation Stage */}
        <div className="flex-1 flex flex-col items-center justify-center my-6 relative max-w-4xl mx-auto w-full">
          {/* Drumroll in progress overlay */}
          {isRevealingTop3 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.08, 1], opacity: 1 }}
              transition={{ repeat: Infinity, duration: 0.5 }}
              className="text-center space-y-4"
            >
              <div className="w-24 h-24 rounded-3xl bg-amber-500/20 border-2 border-amber-400 text-amber-400 mx-auto flex items-center justify-center shadow-2xl shadow-amber-500/30">
                <Crown className="w-12 h-12 animate-bounce" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-amber-400">
                لحظه‌ی اعلام نتیجه فرا رسید!
              </h2>
              <p className="text-sm text-slate-400">نفس‌ها در سینه حبس شده است...</p>
            </motion.div>
          )}

          {/* Intro Screen (before first step) */}
          {!isRevealingTop3 && currentRevealStep === -1 && (
            <div className="text-center space-y-6 max-w-lg">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white mx-auto flex items-center justify-center shadow-2xl shadow-cyan-500/20">
                <Trophy className="w-12 h-12" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-black text-white">
                  مراسم اختتامیه و اعلام نتایج
                </h1>
                <p className="text-sm text-slate-400 leading-relaxed">
                  رتبه‌بندی نهایی تیم‌ها به ترتیب از رتبه‌های پایین به سمت قهرمان مسابقات آشکار خواهد شد.
                </p>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={handleRevealNext}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-base shadow-xl shadow-cyan-500/30 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>شروع اعلام نتایج (یا زدن کلید Space)</span>
                </button>
              </div>
            </div>
          )}

          {/* Active Step: Event Award */}
          {!isRevealingTop3 && step?.type === 'event_award' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className="w-full max-w-xl text-center space-y-6 bg-slate-900/90 border-2 border-amber-500/60 rounded-3xl p-8 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 mx-auto flex items-center justify-center">
                <Award className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  جایزه ویژه رویداد
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  {step.event.awardTitle || `تیم برتر در «${step.event.name}»`}
                </h2>
                <p className="text-xs text-slate-400">رویداد: {step.event.name}</p>
              </div>

              {(() => {
                const team = teams.find((t) => t.id === step.winnerTeamId);
                const teamMembers = participants.filter((p) => team?.memberIds.includes(p.id));

                return (
                  <div className="bg-slate-950/80 p-6 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex items-center justify-center gap-3">
                      <span
                        className={`w-5 h-5 rounded-full ${team?.badgeBg || 'bg-cyan-400'}`}
                      ></span>
                      <h3 className="text-2xl font-black text-white">{team?.name}</h3>
                    </div>

                    <div className="text-xs text-cyan-400 font-bold">
                      امتیاز در این رویداد: {toPersianDigits(roundToOneDecimal(step.score))} از {toPersianDigits(getEventMax(step.event))}
                    </div>

                    {teamMembers.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <div className="text-[11px] text-slate-400 mb-1">اعضای برنده:</div>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {teamMembers.map((m) => (
                            <span
                              key={m.id}
                              className="text-xs bg-slate-900 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-800 font-medium"
                            >
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {/* Active Step: Team Rank (Overall) */}
          {!isRevealingTop3 && step?.type === 'team_rank' && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 20 }}
              className={`w-full ${
                step.isWinner ? 'max-w-2xl' : 'max-w-xl'
              } text-center space-y-6`}
            >
              {/* Winner (Rank 1): Big Trophy Card */}
              {step.isWinner ? (
                <div className="bg-gradient-to-b from-amber-500/20 via-slate-900 to-slate-950 border-2 border-amber-400 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500"></div>

                  <div className="w-20 h-20 rounded-3xl bg-amber-500 text-slate-950 mx-auto flex items-center justify-center shadow-xl shadow-amber-500/40">
                    <Crown className="w-12 h-12" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs sm:text-sm font-black text-amber-400 tracking-wider">
                      ★ قهرمان کل مسابقات ★
                    </span>
                    <h2 className="text-3xl sm:text-5xl font-black text-white">
                      {teams.find((t) => t.id === step.standing.teamId)?.name}
                    </h2>
                  </div>

                  <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-6 py-2.5 rounded-2xl">
                    <span className="text-xs text-slate-300">مجموع نهایی امتیازات:</span>
                    <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                      {toPersianDigits(roundToOneDecimal(step.standing.grandTotal))}
                    </span>
                  </div>

                  {/* List of members for Rank 1 */}
                  {(() => {
                    const team = teams.find((t) => t.id === step.standing.teamId);
                    const members = participants.filter((p) => team?.memberIds.includes(p.id));

                    return (
                      <div className="pt-4 border-t border-slate-800 space-y-2">
                        <div className="text-xs font-bold text-slate-300">
                          اعضای تیم قهرمان ({toPersianDigits(members.length)} نفر):
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {members.map((m) => (
                            <span
                              key={m.id}
                              className="text-xs sm:text-sm font-bold bg-slate-900 border border-slate-700/80 text-white px-3.5 py-1.5 rounded-xl shadow-sm"
                            >
                              {m.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Ranks 2 and below */
                <div
                  className={`bg-slate-900/90 border rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 ${
                    step.standing.rank === 2
                      ? 'border-slate-400 shadow-slate-500/10'
                      : step.standing.rank === 3
                      ? 'border-amber-700/80 shadow-amber-700/10'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg border ${
                        step.standing.rank === 2
                          ? 'bg-slate-400/20 text-slate-200 border-slate-400/40'
                          : step.standing.rank === 3
                          ? 'bg-amber-700/20 text-amber-500 border-amber-700/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {toPersianDigits(step.standing.rank)}
                    </span>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">رتبه در جدول کلی</span>
                      <h3 className="text-xl sm:text-2xl font-black text-white">
                        {teams.find((t) => t.id === step.standing.teamId)?.name}
                      </h3>
                    </div>
                  </div>

                  <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 flex items-center justify-around text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">مجموع امتیازات:</span>
                      <span className="text-lg font-black text-cyan-300 font-mono">
                        {toPersianDigits(roundToOneDecimal(step.standing.grandTotal))}
                      </span>
                    </div>
                    {step.standing.adjustmentsTotal !== 0 && (
                      <div>
                        <span className="text-slate-400 block text-[10px]">تعدیل مجری:</span>
                        <span
                          className={`text-sm font-bold font-mono ${
                            step.standing.adjustmentsTotal > 0
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {step.standing.adjustmentsTotal > 0 ? '+' : ''}
                          {toPersianDigits(step.standing.adjustmentsTotal)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Bottom Reveal Navigation Bar */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800/80 z-30">
          <button
            onClick={handleRevealPrev}
            disabled={currentRevealStep <= -1 || isRevealingTop3}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-30 text-xs font-bold transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
            <span>مرحله قبل (Backspace)</span>
          </button>

          <div className="text-xs text-slate-500 hidden sm:block">
            برای رفتن به رتبه بعد از کلید Space یا کلیک استفاده کنید
          </div>

          <button
            onClick={handleRevealNext}
            disabled={currentRevealStep >= revealSteps.length - 1 || isRevealingTop3}
            className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            <span>
              {currentRevealStep >= revealSteps.length - 1
                ? 'پایان مراسم'
                : 'رتبه بعدی (Space)'}
            </span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ==============================================================
  // RENDER: LIVE LEADERBOARD (FULLSCREEN HORIZONTAL BARS)
  // ==============================================================
  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-6 lg:p-8 select-none font-['Vazirmatn',sans-serif] transition-colors relative overflow-hidden ${
        displayTheme === 'dark-neon'
          ? 'bg-slate-950 text-slate-100'
          : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Top Header: Title & Freeze Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 z-20">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight">
              جدول زنده رده‌بندی مسابقات
            </h1>
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span>{toPersianDigits(teams.length)} تیم رقابتی</span>
            <span>•</span>
            <span>{toPersianDigits(events.length)} رویداد ارزیابی</span>
          </div>
        </div>

        {/* Freeze Mode Badge */}
        {leaderboardFrozen && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-black animate-pulse shadow-lg shadow-amber-500/10">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>🔒 رده‌بندی تا اعلام نتایج قفل است</span>
          </div>
        )}
      </div>

      {/* Main Leaderboard Table / Bars with motion layout */}
      <div className={`flex-1 flex flex-col justify-center ${sizeClasses.gap}`}>
        <AnimatePresence>
          {currentStandings.map((standing, index) => {
            const team = teams.find((t) => t.id === standing.teamId);
            if (!team) return null;

            const members = participants.filter((p) => team.memberIds.includes(p.id));
            const leader = members[0];
            const prevRank = previousRanks[standing.teamId];
            const rankDelta = prevRank !== undefined ? prevRank - standing.rank : 0;
            const teamHex = getTeamColor(team.id, index);

            const isPodium = standing.rank <= 3;

            return (
              <motion.div
                key={standing.teamId}
                layout
                layoutId={standing.teamId}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 22, stiffness: 140 }}
                className={`w-full rounded-2xl sm:rounded-3xl border transition-all flex items-center justify-between gap-3 relative overflow-hidden shadow-lg ${
                  sizeClasses.barPadding
                } ${
                  displayTheme === 'dark-neon'
                    ? isPodium
                      ? 'bg-slate-900/90 border-cyan-500/40 shadow-cyan-500/5'
                      : 'bg-slate-900/60 border-slate-800'
                    : isPodium
                    ? 'bg-white border-cyan-400 shadow-md'
                    : 'bg-white/80 border-slate-200'
                }`}
              >
                {/* Team Accent strip */}
                <div
                  className="absolute top-0 bottom-0 right-0 w-2.5 sm:w-3"
                  style={{ backgroundColor: teamHex }}
                />

                {/* Left section: Rank + Name + Leader */}
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 pr-2">
                  {/* Rank Badge */}
                  <div
                    className={`rounded-2xl flex items-center justify-center font-black flex-shrink-0 border shadow-inner ${
                      sizeClasses.badgeSize
                    } ${
                      standing.rank === 1
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-mono'
                        : standing.rank === 2
                        ? 'bg-slate-300 text-slate-950 border-slate-200 font-mono'
                        : standing.rank === 3
                        ? 'bg-amber-700/80 text-white border-amber-600 font-mono'
                        : 'bg-slate-800/80 text-slate-300 border-slate-700'
                    }`}
                  >
                    {toPersianDigits(standing.rank)}
                  </div>

                  {/* Rank Change Indicator (▲ / ▼) */}
                  <div className="w-5 text-center flex-shrink-0">
                    {rankDelta > 0 ? (
                      <span
                        className="text-emerald-400 text-xs font-black inline-flex items-center"
                        title={`ارتقاء ${toPersianDigits(rankDelta)} رتبه`}
                      >
                        ▲
                      </span>
                    ) : rankDelta < 0 ? (
                      <span
                        className="text-rose-400 text-xs font-black inline-flex items-center"
                        title={`افت ${toPersianDigits(Math.abs(rankDelta))} رتبه`}
                      >
                        ▼
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs font-bold">—</span>
                    )}
                  </div>

                  {/* Team Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3.5 h-3.5 rounded-full ${team.badgeBg || ''} border border-white/20 flex-shrink-0`}
                      />
                      <h3
                        className={`font-black truncate ${sizeClasses.teamName} ${
                          displayTheme === 'dark-neon' ? 'text-white' : 'text-slate-900'
                        }`}
                      >
                        {team.name}
                      </h3>
                    </div>

                    <div
                      className={`text-slate-400 truncate ${sizeClasses.leaderName} font-medium`}
                    >
                      {leader ? `سرگروه: ${leader.name}` : `تیم بدون لیدر`}
                      {team.tableNumber && ` • ${toPersianDigits(team.tableNumber)}`}
                    </div>
                  </div>
                </div>

                {/* Middle: Small per-event score columns */}
                <div className="hidden md:flex items-center gap-2 lg:gap-3 flex-shrink-0 px-2">
                  {events.map((ev) => {
                    const score = standing.eventScores[ev.id];
                    return (
                      <div
                        key={ev.id}
                        className="flex flex-col items-center justify-center px-2 py-1 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center min-w-[56px]"
                      >
                        <span className="text-[9px] text-slate-400 truncate max-w-[70px]">
                          {ev.name}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-200">
                          {score !== null && score !== undefined
                            ? toPersianDigits(roundToOneDecimal(score))
                            : '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Right: Grand Total with AnimatedCounter */}
                <div className="text-left flex-shrink-0 pl-2">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    سرجمع امتیاز
                  </div>
                  <div
                    className={`font-black font-mono tracking-tight text-cyan-400 ${sizeClasses.scoreText}`}
                  >
                    <AnimatedCounter value={standing.grandTotal} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Floating Auto-Hiding Control Bar (bottom-left or top-left) */}
      <div
        className={`fixed bottom-6 left-6 z-50 transition-all duration-300 ${
          showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
      >
        <div className="bg-slate-900/95 border border-slate-700/80 rounded-2xl p-2 shadow-2xl flex items-center gap-1.5 backdrop-blur-md">
          {/* Freeze / Unfreeze */}
          <button
            onClick={handleToggleFreeze}
            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              leaderboardFrozen
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
            title={leaderboardFrozen ? 'خروج از فریز و نمایش زنده' : 'فریز رده‌بندی برای سالن'}
          >
            {leaderboardFrozen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span className="hidden sm:inline">
              {leaderboardFrozen ? 'خروج از فریز' : 'فریز نتایج'}
            </span>
          </button>

          {/* Go to Reveal Mode */}
          <button
            onClick={() => {
              setActiveSubMode('reveal');
              setCurrentRevealStep(-1);
              sound.playClick();
            }}
            className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-cyan-500/20"
            title="ورود به مراسم اعلام نتایج رتبه‌بندی"
          >
            <Crown className="w-4 h-4" />
            <span className="hidden sm:inline">اعلام نتایج</span>
          </button>

          {/* Toggle Rank-over-time SVG chart */}
          <button
            onClick={() => setShowChartModal(true)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="مشاهده نمودار تغییرات رتبه"
          >
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">نمودار</span>
          </button>

          {/* Toggle Fullscreen */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            title="تمام صفحه (کلید F)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Exit Stage */}
          <button
            onClick={handleExitStage}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 text-xs font-bold transition-colors cursor-pointer"
            title="خروج از حالت استیج"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SVG Rank Over Time Chart Modal */}
      {showChartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-black text-lg text-white">نمودار روند رتبه‌ها در طول مسابقات</h3>
              <button
                onClick={() => setShowChartModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <RankOverTimeChart state={state} height={380} />

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowChartModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
