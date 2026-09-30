import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Clock, 
  Trophy, 
  History, 
  Crown,
  ChevronRight,
  ChevronLeft,
  Users
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
  onSelectParticipant?: (participant: Participant, team?: BootcampTeam, isLeader?: boolean) => void;
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
  onSelectParticipant,
}) => {
  // Turn state
  const [activeTeamIndex, setActiveTeamIndex] = useState(0);
  const [turnTimeSeconds, setTurnTimeSeconds] = useState(30);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerInitial, setTimerInitial] = useState(30);

  // Pitch timer state
  const [pitchSeconds, setPitchSeconds] = useState(180); // 3 minutes
  const [isPitchRunning, setIsPitchRunning] = useState(false);

  // Side tab: default to roster if people present, or live log if roster is empty
  const [sideTab, setSideTab] = useState<'roster' | 'log'>(() => unassigned.length > 0 ? 'roster' : 'log');

  useEffect(() => {
    if (unassigned.length === 0 && draftLog.length > 0) {
      setSideTab('log');
    } else if (unassigned.length > 0 && sideTab === 'log' && draftLog.length === 0) {
      setSideTab('roster');
    }
  }, [unassigned.length, draftLog.length]);

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
    if (tId === activeTeam?.id) {
      handleNextTurn();
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Teams Grid Columns (wide, roomy layout for 2 to 8 teams)
  const teamGridCols =
    teams.length <= 2
      ? 'grid-cols-1 md:grid-cols-2'
      : teams.length === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : teams.length === 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : teams.length <= 6
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div className="flex-1 flex flex-col p-2.5 sm:p-4 max-w-[1920px] mx-auto w-full gap-3 overflow-hidden">
      
      {/* Top Stage Banner: Turn Hero + Timers */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-700/80 rounded-2xl p-3 sm:p-3.5 backdrop-blur-md shadow-xl flex-shrink-0">
        
        {/* Current Turn Hero */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div 
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-950 font-black text-lg shadow-lg flex-shrink-0 animate-pulse"
            style={{ backgroundColor: activeTeam?.color || '#06b6d4' }}
          >
            <Crown className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400 font-black uppercase tracking-wider flex items-center gap-1">
                <span>⭐ نوبت انتخاب فعلی:</span>
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono font-bold">
                تیم {toPersianDigits(activeTeamIndex + 1)} از {toPersianDigits(teams.length)}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white truncate mt-0.5">
              {activeTeam?.name}
              {activeLeader && (
                <span className="text-xs sm:text-sm font-bold text-amber-300 mr-2">
                  (سرگروه: {activeLeader.name})
                </span>
              )}
            </h2>
          </div>
        </div>

        {/* Turn Timer & Controls */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-mono ${
            turnTimeSeconds <= 5 
              ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-bounce' 
              : 'bg-slate-950 border-slate-700 text-cyan-300'
          }`}>
            <Clock className="w-4 h-4" />
            <span className="text-lg font-black">{toPersianDigits(turnTimeSeconds)}</span>
            <span className="text-[11px] text-slate-400">ثانیه</span>
          </div>

          <button
            onClick={() => setIsTimerRunning(!isTimerRunning)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 transition-colors cursor-pointer"
            title={isTimerRunning ? 'توقف موقت' : 'شروع تایمر نوبت'}
          >
            {isTimerRunning ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={handleResetTimer}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="شروع مجدد زمان"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="flex items-center border border-slate-700 rounded-xl overflow-hidden mr-1">
            <button
              onClick={handlePrevTurn}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="تیم قبلی"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextTurn}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
              title="رفتن به نوبت تیم بعدی"
            >
              <span>نوبت بعد</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pitch Timer / Presentation Section */}
        <div className="flex items-center gap-2.5 border-t sm:border-t-0 sm:border-r border-slate-800 pt-2 sm:pt-0 sm:pr-3">
          <div>
            <div className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
              <Trophy className="w-3 h-3 text-yellow-400" />
              <span>تایمر ارائه:</span>
            </div>
            <div className="text-base font-black font-mono text-yellow-300">
              {toPersianDigits(formatSeconds(pitchSeconds))}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsPitchRunning(!isPitchRunning)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer"
            >
              {isPitchRunning ? 'توقف' : 'شروع'}
            </button>
            <button
              onClick={() => {
                setIsPitchRunning(false);
                setPitchSeconds(180);
              }}
              className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white border border-slate-700 cursor-pointer"
              title="ریست ۳ دقیقه"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Main Stage: Roomy Teams Arena (75%) + Side Column for Roster & Live Feed (25%) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
        
        {/* Teams Arena - Main Focus of the Stage */}
        <div className="lg:col-span-8 xl:col-span-8 2xl:col-span-9 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
          <div className={`grid ${teamGridCols} gap-3 pb-3`}>
            {teams.map((team, idx) => (
              <div key={team.id} className="min-h-[290px] flex flex-col">
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
                  onSelectParticipant={onSelectParticipant}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Side Panel: Tabbed between Roster and Live Log */}
        <div 
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            if (sideTab === 'log') {
              e.preventDefault();
              e.stopPropagation();
              const participantId = e.dataTransfer.getData('text/plain');
              if (participantId && onReturnToHall) {
                sound.playPop();
                onReturnToHall(participantId);
                setSideTab('roster');
              }
            }
          }}
          className="lg:col-span-4 xl:col-span-4 2xl:col-span-3 flex flex-col min-h-0 bg-slate-900/90 border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl"
        >
          {/* Tabs */}
          <div className="p-1.5 bg-slate-950/80 border-b border-slate-800 flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setSideTab('roster')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                sideTab === 'roster'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>افراد در سالن</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                sideTab === 'roster' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-amber-300'
              }`}>
                {toPersianDigits(unassigned.length)}
              </span>
            </button>

            <button
              onClick={() => setSideTab('log')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                sideTab === 'log'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>گزارش زنده</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                sideTab === 'log' ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-cyan-300'
              }`}>
                {toPersianDigits(draftLog.length)}
              </span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {sideTab === 'roster' ? (
              <UnassignedRoster
                unassigned={unassigned}
                teams={teams}
                displaySize={displaySize}
                onAssignToTeam={handleAssignWithTurnAdvance}
                onOpenAddModal={onOpenAddModal}
                activeTeamIdForPick={activeTeam?.id}
                isNarrowColumn={true}
                onReturnToHall={onReturnToHall}
                onSelectParticipant={(p) => onSelectParticipant?.(p)}
              />
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {draftLog.length === 0 ? (
                    <div className="h-full min-h-[180px] flex items-center justify-center text-center p-4 text-xs text-slate-500">
                      گزارش انتخاب اعضا به محض اضافه شدن به تیم‌ها اینجا درج می‌شود.
                    </div>
                  ) : (
                    draftLog.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-xs shadow-sm hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                          <span className="font-mono">{toPersianDigits(item.timestamp)}</span>
                          {item.isLeader && (
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <Crown className="w-3 h-3 fill-amber-400 text-amber-400" />
                              <span>سرگروه</span>
                            </span>
                          )}
                        </div>
                        <div className="font-black text-white text-sm">
                          {item.participantName}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                          <span>انتقال به:</span>
                          <span className="font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800" style={{ color: item.teamColor }}>
                            {item.teamName}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
