import type { AppState } from '../store/state';
import type { ScoringState } from '../types';

/** Number of scores/adjustments that point to a team id missing from the local teams. */
export function countScoreMismatches(local: AppState, scoring: ScoringState): number {
  const ids = new Set(local.teams.map((t) => t.id));
  const badScores = Object.values(scoring.scores).filter((s) => !ids.has(s.teamId)).length;
  const badAdj = scoring.adjustments.filter((a) => !ids.has(a.teamId)).length;
  return badScores + badAdj;
}

/**
 * Copies ONLY the `scoring` object from `incoming` into `local`.
 * Participants, teams, draftLog, settings and runs stay local.
 */
export function applyScores(local: AppState, incoming: AppState): { state: AppState; mismatches: number } {
  return {
    state: { ...local, scoring: incoming.scoring },
    mismatches: countScoreMismatches(local, incoming.scoring),
  };
}
