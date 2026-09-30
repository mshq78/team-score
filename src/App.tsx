import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  AppMode, 
  DisplaySize, 
  DisplayTheme, 
  Participant, 
  BootcampTeam 
} from './types';
import { CheckCircle2 } from 'lucide-react';
import { 
  createInitialBootcampTeams, 
  TEAM_COLOR_PALETTES 
} from './utils/defaultData';
import { shuffleArray, toPersianDigits } from './utils/persian';
import { sound } from './utils/sound';
import { downloadBackupJson } from './utils/backup';
import { 
  useAppStore, 
  getUnassignedParticipants, 
  getAllTeamMembersMap,
  AppState 
} from './store';
import { DatashowHeader } from './components/DatashowHeader';
import { SimpleDraftView } from './components/SimpleDraftView';
import { AdvancedDashboard } from './components/AdvancedDashboard';
import { ScoringContainer } from './components/scoring/ScoringContainer';
import { JudgePortal } from './components/scoring/JudgePortal';
import { useSyncStatus } from './components/SyncBadge';
import { StageMode } from './components/scoring/StageMode';
import { SmsModal } from './components/SmsModal';
import { AddParticipantsModal } from './components/AddParticipantsModal';
import { ParticipantModal } from './components/ParticipantModal';
import { AlertTriangle } from 'lucide-react';

export default function App() {
  const { state, dispatch } = useAppStore();
  const { participants, teams, draftLog, settings } = state;
  const { mode, displaySize, displayTheme } = settings;

  // Modals state
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsInitialFormat, setSmsInitialFormat] = useState<'ultra_cheap' | 'compact' | 'standard' | 'result'>('ultra_cheap');
  const [smsResultsMap, setSmsResultsMap] = useState<Record<string, { rank: number; totalTeams: number; grandTotal: number }> | undefined>(undefined);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTeamForSms, setSelectedTeamForSms] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingTeamCountReduction, setPendingTeamCountReduction] = useState<{
    newCount: number;
    teamsWithScores: string[];
  } | null>(null);

  // Participant Detail Modal State
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [selectedParticipantTeam, setSelectedParticipantTeam] = useState<BootcampTeam | null>(null);
  const [selectedParticipantIsLeader, setSelectedParticipantIsLeader] = useState<boolean>(false);
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);

  // Stage and Header Visibility (Default hidden for completely uncluttered projector screen)
  const [isHeaderHidden, setIsHeaderHidden] = useState(true);
  const [stageLayout, setStageLayout] = useState<'side' | 'stacked' | 'focus_roster'>('side');
  const [rightColWidth, setRightColWidth] = useState<'compact' | 'ultra_compact' | 'balanced'>('compact');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // One-off messages from the sync engine (e.g. a newer run exists on the server)
  const syncStatus = useSyncStatus();
  useEffect(() => {
    if (syncStatus.noticeSeq > 0 && syncStatus.notice) showToast(syncStatus.notice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncStatus.noticeSeq]);

  const handleOpenSmsResults = (map: Record<string, { rank: number; totalTeams: number; grandTotal: number }>) => {
    setSmsResultsMap(map);
    setSmsInitialFormat('result');
    setSelectedTeamForSms(null);
    setIsSmsModalOpen(true);
  };

  // Selectors
  const unassigned = getUnassignedParticipants(state);
  const teamMembersMap = getAllTeamMembersMap(state);

  // Celebratory confetti when drafting completes or auto-fill finishes
  const triggerCelebration = () => {
    sound.playFanfare();
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });
    }, 250);
  };

  // Assign participant to a team
  const handleAssignToTeam = (participantId: string, teamId: string) => {
    const participant = participants.find((p) => p.id === participantId);
    const targetTeam = teams.find((t) => t.id === teamId);
    if (!participant || !targetTeam) return;

    if (targetTeam.memberIds.includes(participantId)) return;

    const previousTeam = teams.find((t) => t.memberIds.includes(participantId));

    const now = new Date();
    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    dispatch({
      type: 'ASSIGN_TO_TEAM',
      payload: {
        participantId,
        teamId,
        logId,
        timestamp,
      },
    });

    sound.playFanfare();

    if (previousTeam) {
      showToast(`${participant.name} از «${previousTeam.name}» به «${targetTeam.name}» منتقل شد`);
    } else {
      showToast(`${participant.name} به «${targetTeam.name}» ملحق شد`);
    }

    // If that was the last participant
    const remainingCount = unassigned.filter((p) => p.id !== participantId).length;
    if (remainingCount === 0) {
      triggerCelebration();
    }
  };

  // Remove member from team back to unassigned
  const handleRemoveMember = (teamId: string, participantId: string) => {
    const participant = participants.find((p) => p.id === participantId);
    dispatch({
      type: 'REMOVE_MEMBER',
      payload: { teamId, participantId },
    });
    sound.playClick();
    if (participant) {
      showToast(`${participant.name} به سالن بازگشت`);
    }
  };

  // Return member from any team directly to hall (e.g. drop on roster)
  const handleReturnToHall = (participantId: string) => {
    const participant = participants.find((p) => p.id === participantId);
    dispatch({
      type: 'RETURN_TO_HALL',
      payload: { participantId },
    });
    sound.playPop();
    if (participant) {
      showToast(`${participant.name} به سالن بازگردانده شد`);
    }
  };

  // Promote a member to leader (index 0)
  const handlePromoteToLeader = (teamId: string, participantId: string) => {
    dispatch({
      type: 'PROMOTE_LEADER',
      payload: { teamId, participantId },
    });
    sound.playPop();
  };

  // Auto-fill remaining unassigned members randomly into teams
  const handleAutoFillRemaining = () => {
    if (unassigned.length === 0 || teams.length === 0) return;

    const shuffled = shuffleArray(unassigned);
    const teamCounts = teams.map((t) => ({ id: t.id, count: t.memberIds.length }));
    const assignments: Array<{ participantId: string; teamId: string }> = [];

    // Greedy round-robin into teams with lowest member count
    shuffled.forEach((participant) => {
      let minTeam = teamCounts[0];
      for (let i = 1; i < teamCounts.length; i++) {
        if (teamCounts[i].count < minTeam.count) {
          minTeam = teamCounts[i];
        }
      }
      assignments.push({ participantId: participant.id, teamId: minTeam.id });
      minTeam.count++;
    });

    dispatch({
      type: 'AUTO_FILL',
      payload: { assignments },
    });

    triggerCelebration();
    showToast('تمامی افراد باقی‌مانده در تیم‌ها توزیع شدند');
  };

  // Update team data
  const handleUpdateTeam = (updatedTeam: BootcampTeam) => {
    dispatch({
      type: 'UPDATE_TEAM',
      payload: updatedTeam,
    });
  };

  // Update a participant's phone (e.g. when editing leader phone)
  const handleUpdateParticipantPhone = (participantId: string, phone: string) => {
    dispatch({
      type: 'UPDATE_PARTICIPANT',
      payload: { id: participantId, phone },
    });
  };

  // Change team count dynamically (2 to 8)
  const handleTeamsCountChange = (newCount: number) => {
    if (newCount < 2 || newCount > 8) return;

    if (newCount > teams.length) {
      const additional: BootcampTeam[] = [];
      for (let i = teams.length; i < newCount; i++) {
        const palette = TEAM_COLOR_PALETTES[i % TEAM_COLOR_PALETTES.length];
        additional.push({
          id: `team-${i + 1}`,
          name: palette.defaultName,
          color: palette.color,
          badgeBg: palette.badgeBg,
          borderColor: palette.borderColor,
          textColor: palette.textColor,
          memberIds: [],
          score: 0,
        });
      }
      dispatch({
        type: 'SET_TEAMS_COUNT',
        payload: { newCount, newTeams: additional },
      });
    } else if (newCount < teams.length) {
      const removedTeams = teams.slice(newCount);

      const scoredTeamNames = removedTeams
        .filter((t) => {
          const hasScore = Object.values(state.scoring.scores).some(
            (s) => s && s.teamId === t.id && s.value !== null && s.value !== undefined
          );
          const hasNote = Object.values(state.scoring.notes).some(
            (n) => n && n.teamId === t.id && n.text && n.text.trim().length > 0
          );
          const hasAdj = state.scoring.adjustments.some((a) => a.teamId === t.id);
          return hasScore || hasNote || hasAdj;
        })
        .map((t) => t.name);

      if (scoredTeamNames.length > 0) {
        setPendingTeamCountReduction({
          newCount,
          teamsWithScores: scoredTeamNames,
        });
      } else {
        dispatch({
          type: 'SET_TEAMS_COUNT',
          payload: { newCount },
        });
        sound.playPop();
      }
    }
  };

  // Reset only the draft placements (everyone back to unassigned)
  const handleResetDraft = () => {
    dispatch({ type: 'RESET_DRAFT' });
    showToast('یارکشی با موفقیت ریست شد و تمامی افراد به سالن بازگشتند');
  };

  // Reset everything (clear all participants)
  const handleResetEverything = () => {
    dispatch({
      type: 'RESET_ALL',
      payload: { initialTeams: createInitialBootcampTeams(4) },
    });
    showToast('تمامی اسامی و تیم‌ها پاکسازی شدند');
  };

  // Add participants
  const handleAddParticipants = (newParticipants: Participant[]) => {
    dispatch({
      type: 'ADD_PARTICIPANTS',
      payload: { participants: newParticipants },
    });
    showToast(`${toPersianDigits(newParticipants.length)} نفر به لیست افزوده شدند`);
  };

  // Remove participant
  const handleRemoveParticipant = (participantId: string) => {
    dispatch({
      type: 'REMOVE_PARTICIPANT',
      payload: { participantId },
    });
  };

  // Replace participants (e.g. from preset)
  const handleReplaceParticipants = (newParticipants: Participant[]) => {
    dispatch({
      type: 'REPLACE_PARTICIPANTS',
      payload: { participants: newParticipants },
    });
    showToast('لیست نمونه اسامی با موفقیت جایگزین شد');
  };

  // Participant Modal Handlers
  const handleSelectParticipant = (participant: Participant, team?: BootcampTeam, isLeader?: boolean) => {
    setSelectedParticipant(participant);
    setSelectedParticipantTeam(team || null);
    setSelectedParticipantIsLeader(!!isLeader);
    setIsParticipantModalOpen(true);
  };

  const handleUpdateParticipant = (id: string, name: string, phone?: string) => {
    dispatch({
      type: 'UPDATE_PARTICIPANT',
      payload: { id, name, phone },
    });
    showToast(`مشخصات «${name}» به‌روزرسانی شد`);
  };

  const handleDeleteParticipant = (participantId: string) => {
    const target = participants.find((p) => p.id === participantId);
    dispatch({
      type: 'REMOVE_PARTICIPANT',
      payload: { participantId },
    });
    showToast(target ? `«${target.name}» حذف شد` : 'شرکت‌کننده حذف شد');
  };

  // Settings helpers
  const handleModeChange = (newMode: AppMode) => {
    dispatch({ type: 'SET_SETTINGS', payload: { mode: newMode } });
  };

  const handleDisplaySizeChange = (newSize: DisplaySize) => {
    dispatch({ type: 'SET_SETTINGS', payload: { displaySize: newSize } });
  };

  const handleDisplayThemeChange = (newTheme: DisplayTheme) => {
    dispatch({ type: 'SET_SETTINGS', payload: { displayTheme: newTheme } });
  };

  // Backup download & restore
  const handleDownloadBackup = () => {
    downloadBackupJson(state);
    showToast('فایل پشتیبان با موفقیت دانلود شد');
  };

  const handleRestoreBackup = (importedState: AppState) => {
    dispatch({
      type: 'IMPORT_BACKUP',
      payload: { state: importedState },
    });
    showToast('اطلاعات با موفقیت از فایل پشتیبان بازیابی شد');
  };

  // Check if URL has ?judge=1 to render ONLY the judge screen
  const isJudgeMode = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('judge') === '1' ||
    window.location.search.includes('judge=1')
  );

  if (isJudgeMode) {
    return <JudgePortal state={state} dispatch={dispatch} />;
  }

  // Fullscreen Stage mode for Projector / Auditorium screen
  if (mode === 'stage') {
    return <StageMode state={state} dispatch={dispatch} />;
  }

  return (
    <div className={`min-h-screen flex flex-col font-['Vazirmatn',sans-serif] selection:bg-cyan-500 selection:text-slate-950 transition-colors ${
      displayTheme === 'dark-neon'
        ? 'bg-slate-950 text-slate-100'
        : 'bg-slate-100 text-slate-900'
    }`}>
      
      {/* Top Navigation & Projector Controls */}
      <DatashowHeader
        mode={mode}
        onModeChange={handleModeChange}
        displaySize={displaySize}
        onDisplaySizeChange={handleDisplaySizeChange}
        displayTheme={displayTheme}
        onDisplayThemeChange={handleDisplayThemeChange}
        teamsCount={teams.length}
        onTeamsCountChange={handleTeamsCountChange}
        unassignedCount={unassigned.length}
        totalParticipants={participants.length}
        stageLayout={stageLayout}
        onStageLayoutChange={setStageLayout}
        rightColWidth={rightColWidth}
        onRightColWidthChange={setRightColWidth}
        onOpenSmsModal={() => {
          setSelectedTeamForSms(null);
          setSmsResultsMap(undefined);
          setSmsInitialFormat('ultra_cheap');
          setIsSmsModalOpen(true);
        }}
        onOpenParticipantsModal={() => setIsAddModalOpen(true)}
        onAutoFillRemaining={handleAutoFillRemaining}
        onResetDraft={handleResetDraft}
        onDownloadBackup={handleDownloadBackup}
        onRestoreBackup={handleRestoreBackup}
        isHeaderHidden={isHeaderHidden}
        onToggleHeaderHidden={() => setIsHeaderHidden(!isHeaderHidden)}
      />

      {/* Main View Area: Simple Draft, Advanced Dashboard, or Scoring Mode */}
      <main className="flex-1 flex flex-col min-h-0">
        {mode === 'scoring' ? (
          <ScoringContainer
            state={state}
            dispatch={dispatch}
            onShowToast={showToast}
            onOpenSmsResultModal={handleOpenSmsResults}
          />
        ) : mode === 'simple' ? (
          <SimpleDraftView
            unassigned={unassigned}
            teams={teams}
            teamMembersMap={teamMembersMap}
            displaySize={displaySize}
            stageLayout={stageLayout}
            rightColWidth={rightColWidth}
            onAssignToTeam={handleAssignToTeam}
            onUpdateTeam={handleUpdateTeam}
            onRemoveMember={handleRemoveMember}
            onPromoteToLeader={handlePromoteToLeader}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenSmsForTeam={(team) => {
              setSelectedTeamForSms(team.id);
              setIsSmsModalOpen(true);
            }}
            onAutoFillRemaining={handleAutoFillRemaining}
            onReturnToHall={handleReturnToHall}
            onUpdateParticipantPhone={handleUpdateParticipantPhone}
            onSelectParticipant={handleSelectParticipant}
          />
        ) : (
          <AdvancedDashboard
            unassigned={unassigned}
            teams={teams}
            teamMembersMap={teamMembersMap}
            displaySize={displaySize}
            draftLog={draftLog}
            onAssignToTeam={handleAssignToTeam}
            onUpdateTeam={handleUpdateTeam}
            onRemoveMember={handleRemoveMember}
            onPromoteToLeader={handlePromoteToLeader}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onOpenSmsForTeam={(team) => {
              setSelectedTeamForSms(team.id);
              setIsSmsModalOpen(true);
            }}
            onAutoFillRemaining={handleAutoFillRemaining}
            onReturnToHall={handleReturnToHall}
            onUpdateParticipantPhone={handleUpdateParticipantPhone}
            onSelectParticipant={handleSelectParticipant}
          />
        )}
      </main>

      {/* Team Reduction Warning Modal */}
      {pendingTeamCountReduction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">هشدار کاهش تعداد تیم‌ها</h4>
                <p className="text-xs text-slate-400">حذف امتیازات تیم‌های در حال حذف</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              تیم(های) «{pendingTeamCountReduction.teamsWithScores.join('، ')}» دارای امتیازات یا یادداشت‌های داوری ثبت‌شده هستند. با کاهش تعداد تیم‌ها به {toPersianDigits(pendingTeamCountReduction.newCount)} تیم، کلیه نمرات و داده‌های این تیم‌ها پاک خواهد شد. آیا مطمئن هستید؟
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setPendingTeamCountReduction(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  dispatch({
                    type: 'SET_TEAMS_COUNT',
                    payload: { newCount: pendingTeamCountReduction.newCount },
                  });
                  sound.playPop();
                  setPendingTeamCountReduction(null);
                  showToast('تعداد تیم‌ها کاهش یافت و نمرات تیم‌های حذف‌شده پاک شد');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20 cursor-pointer"
              >
                تأیید و کاهش تیم‌ها
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Generator Modal */}
      <SmsModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        teams={teams}
        teamMembersMap={teamMembersMap}
        onUpdateParticipantPhone={handleUpdateParticipantPhone}
        selectedTeamId={selectedTeamForSms}
        initialFormat={smsInitialFormat}
        resultsMap={smsResultsMap}
      />

      {/* Participant Manager & Bulk Add Modal */}
      <AddParticipantsModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        participants={participants}
        onAddParticipants={handleAddParticipants}
        onRemoveParticipant={handleRemoveParticipant}
        onReplaceParticipants={handleReplaceParticipants}
        onResetEverything={handleResetEverything}
      />

      {/* Participant Detail & Edit Modal */}
      <ParticipantModal
        participant={selectedParticipant}
        isOpen={isParticipantModalOpen}
        onClose={() => {
          setIsParticipantModalOpen(false);
          setSelectedParticipant(null);
        }}
        teams={teams}
        currentTeam={selectedParticipantTeam}
        isLeader={selectedParticipantIsLeader}
        onUpdateParticipant={handleUpdateParticipant}
        onAssignToTeam={handleAssignToTeam}
        onReturnToHall={handleReturnToHall}
        onPromoteToLeader={handlePromoteToLeader}
        onDeleteParticipant={handleDeleteParticipant}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 border border-cyan-500/80 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-bold backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
