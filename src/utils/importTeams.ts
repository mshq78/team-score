import type { AppState } from '../store/state';

/**
 * Online import of an offline draft: takes ONLY participants, teams and draftLog.
 * Scoring (events, judges, scores, notes, runId), settings and runs stay untouched,
 * so the operator sync merges normally and never hits the stale-run path.
 */
export function applyTeamsOnly(state: AppState, incoming: AppState): AppState {
  return {
    ...state,
    participants: incoming.participants,
    teams: incoming.teams,
    draftLog: incoming.draftLog,
  };
}
