import React, { useState } from 'react';
import { Participant, BootcampTeam, DisplaySize } from '../types';
import { UnassignedRoster } from './UnassignedRoster';
import { TeamCard } from './TeamCard';
import { Users, Shield } from 'lucide-react';
import { toPersianDigits } from '../utils/persian';

interface SimpleDraftViewProps {
  unassigned: Participant[];
  teams: BootcampTeam[];
  teamMembersMap: Map<string, Participant[]>;
  displaySize: DisplaySize;
  stageLayout?: 'side' | 'stacked' | 'focus_roster';
  rightColWidth?: 'compact' | 'ultra_compact' | 'balanced';
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

export const SimpleDraftView: React.FC<SimpleDraftViewProps> = ({
  unassigned,
  teams,
  teamMembersMap,
  displaySize,
  stageLayout = 'side',
  rightColWidth = 'compact',
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
  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'roster' | 'teams'>('teams');

  // Column class calculations based on selected width (strictly distinct on all screens)
  const rosterColSpan =
    rightColWidth === 'ultra_compact'
      ? 'lg:col-span-3 xl:col-span-2 2xl:col-span-2'
      : rightColWidth === 'compact'
      ? 'lg:col-span-4 xl:col-span-3 2xl:col-span-3'
      : 'lg:col-span-5 xl:col-span-4 2xl:col-span-4';

  const teamsColSpan =
    rightColWidth === 'ultra_compact'
      ? 'lg:col-span-9 xl:col-span-10 2xl:col-span-10'
      : rightColWidth === 'compact'
      ? 'lg:col-span-8 xl:col-span-9 2xl:col-span-9'
      : 'lg:col-span-7 xl:col-span-8 2xl:col-span-8';

  // Compute grid columns based on team count when teams have wide 75-80% screen
  const teamGridCols =
    teams.length === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : teams.length === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : teams.length === 4
      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
      : teams.length <= 6
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4';

  return (
    <div className="flex-1 flex flex-col p-2.5 sm:p-4 max-w-[1920px] mx-auto w-full gap-2.5 overflow-hidden">
      
      {/* Mobile Tab Switcher */}
      <div className="flex md:hidden items-center bg-slate-900 border border-slate-800 rounded-2xl p-1 gap-1">
        <button
          onClick={() => setMobileTab('teams')}
          className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'teams'
              ? 'bg-cyan-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>تیم‌ها و افراد ({toPersianDigits(teams.length)})</span>
        </button>
        <button
          onClick={() => setMobileTab('roster')}
          className={`flex-1 py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mobileTab === 'roster'
              ? 'bg-amber-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>افراد حاضر ({toPersianDigits(unassigned.length)})</span>
        </button>
      </div>

      {/* Main Dynamic Stage Layout - Completely Clean for Audience & Projector */}
      {stageLayout === 'focus_roster' ? (
        /* Full Roster Board View: 100% focused on showing all names */
        <div className="flex-1 flex flex-col min-h-0">
          <UnassignedRoster
            unassigned={unassigned}
            teams={teams}
            displaySize={displaySize}
            onAssignToTeam={onAssignToTeam}
            onOpenAddModal={onOpenAddModal}
            isNarrowColumn={false}
            onReturnToHall={onReturnToHall}
            onSelectParticipant={(p) => onSelectParticipant?.(p)}
          />
        </div>
      ) : stageLayout === 'stacked' ? (
        /* Stacked Layout: Top wide unassigned pool + Bottom teams */
        <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-hidden">
          {/* Top: Unassigned Pool spread out horizontally */}
          <div className="h-[40%] flex flex-col min-h-0">
            <UnassignedRoster
              unassigned={unassigned}
              teams={teams}
              displaySize={displaySize}
              onAssignToTeam={onAssignToTeam}
              onOpenAddModal={onOpenAddModal}
              isNarrowColumn={false}
              onReturnToHall={onReturnToHall}
              onSelectParticipant={(p) => onSelectParticipant?.(p)}
            />
          </div>

          {/* Bottom: Teams */}
          <div className="h-[60%] flex flex-col min-h-0 overflow-y-auto">
            <div className={`grid ${teamGridCols} gap-3 pb-2`}>
              {teams.map((team, idx) => (
                <div key={team.id} className="min-h-[290px] flex flex-col">
                  <TeamCard
                    team={team}
                    teamIndex={idx}
                    displaySize={displaySize}
                    members={teamMembersMap.get(team.id) || []}
                    allTeams={teams}
                    onUpdateTeam={onUpdateTeam}
                    onRemoveMember={onRemoveMember}
                    onPromoteToLeader={onPromoteToLeader}
                    onDropParticipant={onAssignToTeam}
                    onOpenSmsForTeam={onOpenSmsForTeam}
                    onUpdateParticipantPhone={onUpdateParticipantPhone}
                    onSelectParticipant={onSelectParticipant}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Classic Side-by-Side Split Layout with Slim Right Column */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0 overflow-hidden">
          {/* Unassigned Pool Section (Right on RTL - Compact) */}
          <div className={`${rosterColSpan} flex flex-col min-h-0 ${
            mobileTab === 'teams' ? 'hidden md:flex' : 'flex'
          }`}>
            <UnassignedRoster
              unassigned={unassigned}
              teams={teams}
              displaySize={displaySize}
              onAssignToTeam={onAssignToTeam}
              onOpenAddModal={onOpenAddModal}
              isNarrowColumn={true}
              onReturnToHall={onReturnToHall}
              onSelectParticipant={(p) => onSelectParticipant?.(p)}
            />
          </div>

          {/* Teams Stage Grid (Left on RTL - Dominant 75% to 80% Width) */}
          <div className={`${teamsColSpan} flex flex-col min-h-0 overflow-y-auto ${
            mobileTab === 'roster' ? 'hidden md:flex' : 'flex'
          }`}>
            <div className={`grid ${teamGridCols} gap-3 pb-4`}>
              {teams.map((team, idx) => (
                <div key={team.id} className="min-h-[360px] flex flex-col">
                  <TeamCard
                    team={team}
                    teamIndex={idx}
                    displaySize={displaySize}
                    members={teamMembersMap.get(team.id) || []}
                    allTeams={teams}
                    onUpdateTeam={onUpdateTeam}
                    onRemoveMember={onRemoveMember}
                    onPromoteToLeader={onPromoteToLeader}
                    onDropParticipant={onAssignToTeam}
                    onOpenSmsForTeam={onOpenSmsForTeam}
                    onUpdateParticipantPhone={onUpdateParticipantPhone}
                    onSelectParticipant={onSelectParticipant}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
