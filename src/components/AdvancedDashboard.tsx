import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Volume2, 
  Clock, 
  Trophy, 
  History, 
  Crown,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Participant, BootcampTeam, DisplaySize, DraftLogItem } from '../types';
import { UnassignedRoster } from './UnassignedRoster';
import { TeamCard } from './TeamCard';
import { toPersianDigits } from '../utils/persian';
import { sound } from '../utils/sound';

interface AdvancedDashboardProps {
  unassigned: Participant[];
  teams: BootcampTeam[];
  teamMembersMap: Map<string, Participant[]>;
  displaySize: DisplaySize;
  draftLog: DraftLogItem[];
  onAssignToTeam: (participantId: string, teamId: string) => void;
  onUpdateTeam: (team: BootcampTeam) => void;
  onRemoveMember: (teamId: string, participantId: string) => void;
  onPromoteToLeader: (teamId: string, participantId: string) => void;
  onOpenAddModal: () => void;
  onOpenSmsForTeam: (team: BootcampTeam) => void;
  onAutoFillRemaining: () => void;
  onReturnToHall?: (participantId: string) => void;
  onUpdateParticipantPhone?: (participantId: string, phone: string) => void;
}

export const AdvancedDashboard: React.FC<AdvancedDashboardProps> = ({
  unassigned,
  teams,
  teamMembersMap,
  displaySize,
  draftLog,
  onAssignToTeam,
  onUpdateTeam,
  onRemoveMember,
  onPromoteToLeader,
  onOpenAddModal,
  onOpenSmsForTeam,
  onAutoFillRemaining,
  onReturnToHall,
  onUpdateParticipantPhone,
}) => {
  // Turn state
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);
  const [turnTimeSeconds, setTurnTimeSeconds] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerInitial, setTimerInitial] = useState(30);

  // Pitch timer state
  const [pitchSeconds, setPitchSeconds] = useState(180); // 3 minutes
  const [isPitchRunning, setIsPitchRunning] = useState(false);

  const activeTeam = teams[activeTeamIndex] || teams[0];
  const activeMembers = activeTeam ? teamMembersMap.get(activeTeam.id) || [] : [];
  const activeLeader = activeMembers[0];

  // Turn timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && turnTimeSeconds > 0) {
      interval = setInterval(() => {
        setTurnTimeSeconds((prev) => {
          if (prev <= 4 && prev > 1) {
            sound.playTick();
          } else if (prev === 1) {
            sound.playWhistle();
          }
          return prev - 1;
        });
      }, 1000);
    } else if (turnTimeSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      // Auto advance to next turn if needed
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, turnTimeSeconds]);

  // Pitch timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPitchRunning && pitchSeconds > 0) {
      interval = setInterval(() => {
        setPitchSeconds((prev) => {
          if (prev === 1) sound.playWhistle();
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPitchRunning, pitchSeconds]);

  const handleNextTurn = () => {
    sound.playClick();
    setActiveTeamIndex((prev) => (prev + 1) % teams.length);
    setTurnTimeSeconds(timerInitial);
    setIsTimerRunning(true);
  };

  const handlePrevTurn = () => {
    sound.playClick();
    setActiveTeamIndex((prev) => (prev - 1 + teams.length) % teams.length);
    setTurnTimeSeconds(timerInitial);
  };

  const handleResetTimer = () => {
    sound.playClick();
    setTurnTimeSeconds(timerInitial);
    setIsTimerRunning(false);
  };

  // Wrap onAssignToTeam to auto advance turn
  const handleAssignWithTurnAdvance = (pId: string, tId: string) => {
    onAssignToTeam(pId, tId);
    // If assigned to active team, proceed to next team's turn
    if (tId === activeTeam?.id) {
      handleNextTurn();
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-5 max-w-[1920px] mx-auto w-full gap-4 overflow-hidden">
      
      {/* Top Advanced Stage Banner: Live Turn Tracker & Pitch Timer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-xl">
        
        {/* Current Turn Hero */}
        <div className="lg:col-span-8 flex flex-wrap items-center justify-between gap-3 border-b lg:border-b-0 lg:border-l border-slate-800 pb-3 lg:pb-0 lg:pl-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-slate-950 font-black text-xl shadow-lg animate-pulse"
              style={{ backgroundColor: activeTeam?.color || '#06b6d4' }}
            >
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                  ⭐ نوبت انتخاب فعلی
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                  تیم {toPersianDigits(activeTeamIndex + 1)} از {toPersianDigits(teams.length)}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {activeTeam?.name}
                {activeLeader && (
                  <span className="text-sm sm:text-base font-bold text-amber-300 mr-2">
                    (سرگروه: {activeLeader.name})
                  </span>
                )}
              </h2>
            </div>
          </div>

          {/* Turn Timer & Controls */}
          <div className="flex items-center gap-2">
            <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-mono ${
              turnTimeSeconds <= 5 
                ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-bounce' 
                : 'bg-slate-950 border-slate-700 text-cyan-300'
            }`}>
              <Clock className="w-4 h-4" />
              <span className="text-2xl font-black">{toPersianDigits(turnTimeSeconds)}</span>
              <span className="text-xs text-slate-400">ثانیه</span>
            </div>

            <button
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 transition-colors"
              title={isTimerRunning ? 'توقف موقت' : 'شروع تایمر نوبت'}
            >
              {isTimerRunning ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
            </button>

            <button
              onClick={handleResetTimer}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700 transition-colors"
              title="شروع مجدد زمان"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="flex items-center border border-slate-700 rounded-xl overflow-hidden mr-1">
              <button
                onClick={handlePrevTurn}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300"
                title="تیم قبلی"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextTurn}
                className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1"
                title="رفتن به نوبت تیم بعدی"
              >
                <span>نوبت بعد</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Pitch Timer / Presentation Section */}
        <div className="lg:col-span-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-400 font-bold flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span>تایمر ارائه و مسابقات بوت‌کمپ</span>
            </div>
            <div className="text-xl font-black font-mono text-yellow-300">
              {toPersianDigits(formatSeconds(pitchSeconds))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsPitchRunning(!isPitchRunning)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
            >
              {isPitchRunning ? 'توقف' : 'شروع ارائه'}
            </button>
            <button
              onClick={() => {
                setIsPitchRunning(false);
                setPitchSeconds(180);
              }}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700"
              title="ریست ۳ دقیقه"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Main Draft Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        
        {/* Unassigned Pool (2-column cards) */}
        <div className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 flex flex-col min-h-0">
          <UnassignedRoster
            unassigned={unassigned}
            teams={teams}
            displaySize={displaySize}
            onAssignToTeam={handleAssignWithTurnAdvance}
            onOpenAddModal={onOpenAddModal}
            activeTeamIdForPick={activeTeam?.id}
            isNarrowColumn={true}
            onReturnToHall={onReturnToHall}
          />
        </div>

        {/* Teams Grid (Wide space) */}
        <div className="lg:col-span-8 xl:col-span-6 2xl:col-span-7 flex flex-col min-h-0 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4 gap-3.5 pb-4">
            {teams.map((team, idx) => (
              <div key={team.id} className="min-h-[380px] flex flex-col">
                <TeamCard
                  team={team}
                  teamIndex={idx}
                  displaySize={displaySize}
                  members={teamMembersMap.get(team.id) || []}
                  allTeams={teams}
                  isActiveTurn={idx === activeTeamIndex}
                  onUpdateTeam={onUpdateTeam}
                  onRemoveMember={onRemoveMember}
                  onPromoteToLeader={onPromoteToLeader}
                  onDropParticipant={handleAssignWithTurnAdvance}
                  onOpenSmsForTeam={onOpenSmsForTeam}
                  onUpdateParticipantPhone={onUpdateParticipantPhone}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Live Draft Log Feed */}
        <div className="lg:col-span-2 hidden xl:flex flex-col bg-slate-900/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-3 border-b border-slate-800 bg-slate-900 flex items-center gap-2 text-xs font-bold text-slate-300">
            <History className="w-4 h-4 text-cyan-400" />
            <span>گزارش زنده انتخاب‌ها</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {draftLog.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-3 text-xs text-slate-500">
                گزارش انتخاب اعضا به محض اضافه شدن به تیم‌ها اینجا درج می‌شود.
              </div>
            ) : (
              draftLog.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2 text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span>{toPersianDigits(item.timestamp)}</span>
                    {item.isLeader && (
                      <span className="text-amber-400 font-bold">👑 سرگروه</span>
                    )}
                  </div>
                  <div className="font-bold text-white break-words whitespace-normal leading-snug">
                    {item.participantName}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    ➔ <span style={{ color: item.teamColor }}>{item.teamName}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
