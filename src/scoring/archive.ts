import { AppState } from '../store/state';
import { RunArchive, RunArchiveTeam } from '../types';
import { computeStandings } from './compute';

/**
 * Builds a snapshot archive of the current run results.
 * Uses computeStandings to obtain rank and scores for each team.
 */
export function buildRunArchive(state: AppState, endedAt: string): RunArchive {
  const standings = computeStandings(state);

  const eventNames: Record<string, string> = {};
  for (const ev of state.scoring.events) {
    eventNames[ev.id] = ev.name;
  }

  const teams: RunArchiveTeam[] = standings.map((st) => {
    const team = state.teams.find((t) => t.id === st.teamId);
    return {
      teamId: st.teamId,
      name: team?.name || '',
      color: team?.color || '',
      memberCount: team?.memberIds.length || 0,
      grandTotal: st.grandTotal,
      rank: st.rank,
      completionPercentage: st.completionPercentage,
      eventScores: st.eventScores,
    };
  });

  // Teams sorted by rank
  teams.sort((a, b) => a.rank - b.rank);

  return {
    id: state.scoring.runId || 'run-1',
    name: state.scoring.runName || `اجرای ${new Date(state.scoring.runStartedAt || endedAt).toLocaleDateString('fa-IR')}`,
    startedAt: state.scoring.runStartedAt || '',
    endedAt,
    eventNames,
    judgesCount: state.scoring.judges.length,
    teams,
  };
}
