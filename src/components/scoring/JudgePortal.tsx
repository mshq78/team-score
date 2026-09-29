import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppState } from '../../store/state';
import { AppAction } from '../../store/actions';
import { ScoringEvent, Judge, BootcampTeam, ScoringIndicator } from '../../types';
import { toPersianDigits } from '../../utils/persian';
import { sound } from '../../utils/sound';
import { syncEngine } from '../../sync/engine';
import { SyncBadge } from '../SyncBadge';
import {
  Award,
  CheckCircle2,
  Lock,
  ChevronRight,
  ChevronLeft,
  LogOut,
  AlertTriangle,
  FileText,
  Sliders,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';

interface JudgePortalProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export const JudgePortal: React.FC<JudgePortalProps> = ({ state, dispatch }) => {
  const { events, judges, scores, notes } = state.scoring;
  const teams = state.teams;

  // Login session
  const [currentJudgeId, setCurrentJudgeId] = useState<string | null>(() => syncEngine.judgeId);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [inputCode, setInputCode] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Selected event (null = event selection screen)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Current team index (0 to teams.length - 1)
  const [currentTeamIndex, setCurrentTeamIndex] = useState<number>(0);

  // Touch tracking for swipe navigation
  const touchStartXRef = useRef<number | null>(null);

  // Verify currently logged in judge
  const currentJudge = useMemo(() => {
    if (!currentJudgeId) return null;
    return judges.find((j) => j.id === currentJudgeId) || null;
  }, [currentJudgeId, judges]);

  // If judge was deleted or invalid, clear session
  useEffect(() => {
    if (currentJudgeId && !currentJudge) {
      syncEngine.logoutJudge();
      setCurrentJudgeId(null);
    }
  }, [currentJudgeId, currentJudge]);

  // Filter events allowed for this judge
  const allowedEvents = useMemo(() => {
    if (!currentJudge) return [];
    if (currentJudge.eventIds.length === 0) {
      return events;
    }
    return events.filter((e) => currentJudge.eventIds.includes(e.id));
  }, [currentJudge, events]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [selectedEventId, events]);

  // Current active team
  const currentTeam: BootcampTeam | undefined = teams[currentTeamIndex];

  // Helper: check if a team is fully scored by this judge for a specific event
  const isTeamFullyScored = (judgeId: string, teamId: string, event: ScoringEvent) => {
    if (event.indicators.length === 0) return false;
    for (const ind of event.indicators) {
      const key = `${judgeId}|${teamId}|${ind.id}`;
      const entry = scores[key];
      if (entry === undefined || entry.value === null) {
        return false;
      }
    }
    return true;
  };

  // Login handler — the code is checked by the sync server, so a fresh phone
  // needs nothing but the code (or the QR link, which fills it in).
  const handleLogin = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    if (isLoggingIn) return;
    setLoginError(null);

    // Normalize Persian digits to English
    const cleanCode = (codeOverride ?? inputCode)
      .trim()
      .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());

    if (!cleanCode) {
      setLoginError('لطفاً کد ورود را وارد کنید');
      return;
    }

    setIsLoggingIn(true);
    const error = await syncEngine.loginJudge(cleanCode);
    setIsLoggingIn(false);

    if (!error) {
      setCurrentJudgeId(syncEngine.judgeId);
      sound.playPop();
    } else {
      setLoginError(error);
      sound.playWhistle();
    }
  };

  // Auto-login from a QR link (?judge=1&code=1234)
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (!code) return;
    const params = new URLSearchParams(window.location.search);
    params.delete('code');
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
    if (!currentJudgeId) {
      setInputCode(code);
      void handleLogin(undefined, code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Logout handler
  const handleLogout = () => {
    syncEngine.logoutJudge();
    setCurrentJudgeId(null);
    setSelectedEventId(null);
    setInputCode('');
    setLoginError(null);
    sound.playClick();
  };

  // Handle score change for an indicator
  const handleSetScore = (indicatorId: string, value: number | null) => {
    if (!currentJudge || !selectedEvent || !currentTeam) return;

    // Closed events cannot be modified by judge
    if (selectedEvent.status === 'closed') return;

    dispatch({
      type: 'SET_SCORE',
      payload: {
        judgeId: currentJudge.id,
        teamId: currentTeam.id,
        eventId: selectedEvent.id,
        indicatorId,
        value,
        updatedAt: new Date().toISOString(),
        source: 'judge',
      },
    });

    sound.playClick();
  };

  // Handle note change
  const handleNoteChange = (text: string) => {
    if (!currentJudge || !selectedEvent || !currentTeam) return;
    if (selectedEvent.status === 'closed') return;

    dispatch({
      type: 'SET_NOTE',
      payload: {
        judgeId: currentJudge.id,
        teamId: currentTeam.id,
        eventId: selectedEvent.id,
        text,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  // Touch handlers for swipe navigation between teams
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartXRef.current;
    touchStartXRef.current = null;

    // Minimum swipe threshold
    if (Math.abs(diffX) > 50) {
      if (diffX < 0) {
        // Swiped left: In RTL, move to next team
        if (currentTeamIndex < teams.length - 1) {
          setCurrentTeamIndex((prev) => prev + 1);
          sound.playClick();
        }
      } else {
        // Swiped right: move to previous team
        if (currentTeamIndex > 0) {
          setCurrentTeamIndex((prev) => prev - 1);
          sound.playClick();
        }
      }
    }
  };

  // ==========================================
  // VIEW 1: LOGIN SCREEN
  // ==========================================
  if (!currentJudge) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-cyan-500 selection:text-slate-950 font-['Vazirmatn',sans-serif]">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mx-auto flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h1 className="text-xl font-black text-white">ورود داوران مسابقات</h1>
            <p className="text-xs text-slate-400">کد اختصاصی ۴ رقمی خود را وارد نمایید</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value);
                  setLoginError(null);
                  if (e.target.value.length === 4) {
                    // Auto submit on 4 digits
                    void handleLogin(undefined, e.target.value);
                  }
                }}
                placeholder="— — — —"
                className="w-full text-center text-3xl font-black tracking-[0.5em] py-3.5 bg-slate-950 border border-slate-700 rounded-2xl text-cyan-400 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 transition-all font-mono"
              />
            </div>

            {loginError && (
              <div className="text-xs font-bold text-rose-400 bg-rose-950/40 border border-rose-800/40 p-2.5 rounded-xl animate-in fade-in">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              {isLoggingIn ? 'در حال بررسی…' : 'ورود به سامانه داوری'}
            </button>
          </form>

        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: EVENT SELECTION (when no event selected)
  // ==========================================
  if (!selectedEvent) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-['Vazirmatn',sans-serif] space-y-6 max-w-lg mx-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center font-black">
              {currentJudge.name.slice(0, 1)}
            </div>
            <div>
              <div className="text-xs text-slate-400">پنل داور مسابقات</div>
              <h2 className="text-sm font-black text-white">{currentJudge.name}</h2>
            </div>
          </div>

          <SyncBadge compact />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            title="خروج از حساب داوری"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>

        {/* Allowed Events List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300">مسابقات قابل امتیازدهی:</h3>
            <span className="text-xs text-slate-500">
              {toPersianDigits(allowedEvents.length)} رویداد
            </span>
          </div>

          {allowedEvents.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-xs text-slate-400">
              هیچ رویدادی برای شما تخصیص داده نشده است.
            </div>
          ) : (
            allowedEvents.map((event) => {
              const isClosed = event.status === 'closed';
              const isActive = event.status === 'active';

              // Calculate how many teams are fully scored
              let fullyScoredCount = 0;
              for (const t of teams) {
                if (isTeamFullyScored(currentJudge.id, t.id, event)) {
                  fullyScoredCount++;
                }
              }

              return (
                <div
                  key={event.id}
                  onClick={() => {
                    setSelectedEventId(event.id);
                    setCurrentTeamIndex(0);
                    sound.playClick();
                  }}
                  className={`p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden space-y-3 ${
                    isActive
                      ? 'bg-slate-900 border-cyan-500/60 shadow-lg shadow-cyan-500/10 hover:border-cyan-400 ring-1 ring-cyan-500/30'
                      : isClosed
                      ? 'bg-slate-900/50 border-slate-800 opacity-80 hover:opacity-100'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                        isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse'
                          : isClosed
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {isActive
                        ? 'در جریان (فعال)'
                        : isClosed
                        ? 'بسته‌شده (فقط مشاهده)'
                        : 'پیش‌رو'}
                    </span>

                    <span className="text-[11px] text-slate-400">
                      ضریب: {toPersianDigits(event.weight)}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <h4 className="text-base font-black text-white">{event.name}</h4>
                    <p className="text-xs text-slate-400">
                      {toPersianDigits(event.indicators.length)} معیار ارزیابی
                    </p>
                  </div>

                  {/* Progress info */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-400">وضعیت ثبت نمرات:</span>
                    <span
                      className={`font-bold ${
                        fullyScoredCount === teams.length && teams.length > 0
                          ? 'text-emerald-400'
                          : 'text-cyan-400'
                      }`}
                    >
                      {toPersianDigits(fullyScoredCount)} از {toPersianDigits(teams.length)} تیم کامل
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: ONE TEAM PER SCREEN (SCORING)
  // ==========================================
  const isClosed = selectedEvent.status === 'closed';
  const isCurrentTeamComplete =
    currentTeam && isTeamFullyScored(currentJudge.id, currentTeam.id, selectedEvent);

  const teamNoteKey =
    currentTeam && `${currentJudge.id}|${currentTeam.id}|${selectedEvent.id}`;
  const teamNoteText = teamNoteKey ? notes[teamNoteKey]?.text || '' : '';

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Vazirmatn',sans-serif] max-w-lg mx-auto pb-24 selection:bg-cyan-500 selection:text-slate-950"
    >
      {/* Top Bar: Back to events & Event Title */}
      <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => {
            setSelectedEventId(null);
            sound.playClick();
          }}
          className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
          <span>بازگشت</span>
        </button>

        <div className="text-center">
          <div className="text-[11px] text-slate-400 font-medium truncate max-w-[180px]">
            {selectedEvent.name}
          </div>
          <div className="text-xs font-black text-cyan-400">
            تیم {toPersianDigits(currentTeamIndex + 1)} از {toPersianDigits(teams.length)}
          </div>
        </div>

        <SyncBadge compact />
        <button
          onClick={handleLogout}
          className="text-xs text-slate-400 hover:text-rose-400 p-1 cursor-pointer"
          title="خروج"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Closed Banner Warning */}
      {isClosed && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-xs font-bold text-amber-400 flex items-center justify-center gap-2">
          <Lock className="w-4 h-4 flex-shrink-0" />
          <span>این مسابقه بسته‌شده است و نمرات فقط‌خواندنی می‌باشند.</span>
        </div>
      )}

      {/* Team Tabs / Carousel Pills */}
      <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/80 overflow-x-auto no-scrollbar flex items-center gap-2">
        {teams.map((t, idx) => {
          const isSelected = idx === currentTeamIndex;
          const isComplete = isTeamFullyScored(currentJudge.id, t.id, selectedEvent);

          return (
            <button
              key={t.id}
              onClick={() => {
                setCurrentTeamIndex(idx);
                sound.playClick();
              }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${t.badgeBg || 'bg-slate-400'}`}
              ></span>
              <span>{t.name}</span>
              {isComplete && (
                <span
                  className={
                    isSelected ? 'text-slate-950 font-black' : 'text-emerald-400'
                  }
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {currentTeam ? (
        <div className="p-4 space-y-5 flex-1">
          {/* Team Hero Card */}
          <div
            className={`p-4 rounded-3xl border transition-all ${
              isCurrentTeamComplete
                ? 'bg-slate-900/90 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                : 'bg-slate-900/90 border-slate-800 shadow-lg'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`w-5 h-5 rounded-full ${currentTeam.badgeBg} border border-white/30`}
                ></span>
                <div>
                  <h3 className="text-lg font-black text-white">{currentTeam.name}</h3>
                  {currentTeam.tableNumber && (
                    <span className="text-xs text-slate-400">
                      {toPersianDigits(currentTeam.tableNumber)}
                    </span>
                  )}
                </div>
              </div>

              {isCurrentTeamComplete && (
                <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2.5 py-1 rounded-xl text-xs font-black">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تکمیل شد</span>
                </div>
              )}
            </div>
          </div>

          {/* Indicators list */}
          <div className="space-y-4">
            {selectedEvent.indicators.map((indicator, indIdx) => {
              const cellKey = `${currentJudge.id}|${currentTeam.id}|${indicator.id}`;
              const currentScore = scores[cellKey]?.value;
              const maxScore = indicator.maxScore > 0 ? indicator.maxScore : 10;

              return (
                <div
                  key={indicator.id}
                  className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 space-y-3"
                >
                  {/* Indicator Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">
                        {toPersianDigits(indIdx + 1)}. {indicator.name}
                      </h4>
                      <div className="text-[10px] text-slate-400">
                        سقف: {toPersianDigits(maxScore)} امتیاز (ضریب {toPersianDigits(indicator.weight)})
                      </div>
                    </div>

                    <div className="text-right">
                      {currentScore !== null && currentScore !== undefined ? (
                        <span className="bg-cyan-500 text-slate-950 font-black px-2.5 py-0.5 rounded-lg text-xs">
                          {toPersianDigits(currentScore)} از {toPersianDigits(maxScore)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 font-bold">بدون امتیاز</span>
                      )}
                    </div>
                  </div>

                  {/* Score Selector: Big buttons if <= 10, Slider if > 10 */}
                  {maxScore <= 10 ? (
                    <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 pt-1">
                      {Array.from({ length: maxScore + 1 }, (_, i) => i).map((scoreVal) => {
                        const isSelected = currentScore === scoreVal;

                        return (
                          <button
                            key={scoreVal}
                            type="button"
                            disabled={isClosed}
                            onClick={() => {
                              // If already selected, tap again to clear (null)
                              if (isSelected) {
                                handleSetScore(indicator.id, null);
                              } else {
                                handleSetScore(indicator.id, scoreVal);
                              }
                            }}
                            className={`h-12 rounded-xl text-base font-black transition-all cursor-pointer flex items-center justify-center border ${
                              isSelected
                                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/30 scale-105'
                                : isClosed
                                ? 'bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed'
                                : 'bg-slate-950 hover:bg-slate-800 text-slate-200 border-slate-800 active:scale-95'
                            }`}
                          >
                            {toPersianDigits(scoreVal)}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    /* Slider for maxScore > 10 */
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                        <span>۰</span>
                        <span className="text-sm font-black text-cyan-400">
                          {currentScore !== null && currentScore !== undefined
                            ? toPersianDigits(currentScore)
                            : '—'}
                        </span>
                        <span>{toPersianDigits(maxScore)}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={isClosed || currentScore === 0}
                          onClick={() => {
                            const cur = currentScore ?? 0;
                            handleSetScore(indicator.id, Math.max(0, cur - 1));
                          }}
                          className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-slate-200 cursor-pointer disabled:opacity-30"
                        >
                          -
                        </button>

                        <input
                          type="range"
                          min={0}
                          max={maxScore}
                          disabled={isClosed}
                          value={currentScore ?? 0}
                          onChange={(e) => handleSetScore(indicator.id, Number(e.target.value))}
                          className="flex-1 accent-cyan-500 h-2 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
                        />

                        <button
                          type="button"
                          disabled={isClosed || currentScore === maxScore}
                          onClick={() => {
                            const cur = currentScore ?? 0;
                            handleSetScore(indicator.id, Math.min(maxScore, cur + 1));
                          }}
                          className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-slate-200 cursor-pointer disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Optional Note Field per team per event */}
          <div className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-4 space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>یادداشت یا بازخورد داور برای این تیم (اختیاری):</span>
            </label>
            <textarea
              rows={2}
              disabled={isClosed}
              value={teamNoteText}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="نکات قوت، نقاط قابل بهبود یا توضیحات تکمیلی..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 transition-all resize-none disabled:opacity-50"
            />
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-xs text-slate-500">تیمی یافت نشد.</div>
      )}

      {/* Sticky Bottom Navigation: Previous / Next Team */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-3 max-w-lg mx-auto">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentTeamIndex === 0}
            onClick={() => {
              if (currentTeamIndex > 0) {
                setCurrentTeamIndex((prev) => prev - 1);
                sound.playClick();
              }
            }}
            className="flex-1 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
            <span>تیم قبلی</span>
          </button>

          <div className="text-center px-2">
            <span className="text-xs font-black text-cyan-400">
              {toPersianDigits(currentTeamIndex + 1)} / {toPersianDigits(teams.length)}
            </span>
          </div>

          <button
            type="button"
            disabled={currentTeamIndex >= teams.length - 1}
            onClick={() => {
              if (currentTeamIndex < teams.length - 1) {
                setCurrentTeamIndex((prev) => prev + 1);
                sound.playClick();
              }
            }}
            className="flex-1 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-30 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-cyan-500/20"
          >
            <span>تیم بعدی</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
