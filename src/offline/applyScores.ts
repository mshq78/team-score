import type { AppState } from '../store/state';
import type { ScoringState } from '../types';
import { runIdOf } from '../sync/merge';

/** Number of scores/adjustments that point to a team id missing from the local teams. */
export function countScoreMismatches(local: AppState, scoring: ScoringState): number {
  const ids = new Set(local.teams.map((t) => t.id));
  const badScores = Object.values(scoring.scores).filter((s) => !ids.has(s.teamId)).length;
  const badAdj = scoring.adjustments.filter((a) => !ids.has(a.teamId)).length;
  return badScores + badAdj;
}

function newest<T extends { updatedAt: string }>(a: Record<string, T> = {}, b: Record<string, T> = {}): Record<string, T> {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) if (!out[k] || v.updatedAt > out[k].updatedAt) out[k] = v;
  return out;
}

/**
 * Brings judges' results into the local state. Participants, teams, draftLog, settings and runs stay local.
 * - Same run: this device owns the setup (events, indicators, judges, criteria), so only the entered data
 *   (scores, notes, person scores; adjustments by id) is merged in, the newest value winning.
 * - Different run: the incoming `scoring` object replaces the local one.
 */
export function applyScores(local: AppState, incoming: AppState): { state: AppState; mismatches: number } {
  const mismatches = countScoreMismatches(local, incoming.scoring);
  if (runIdOf(local) !== runIdOf(incoming)) return { state: { ...local, scoring: incoming.scoring }, mismatches };
  const l = local.scoring;
  const r = incoming.scoring;
  const adjustments = [...l.adjustments];
  for (const a of r.adjustments) if (!adjustments.some((x) => x.id === a.id)) adjustments.push(a);
  return {
    state: {
      ...local,
      scoring: {
        ...l,
        scores: newest(l.scores, r.scores),
        notes: newest(l.notes, r.notes),
        personScores: newest(l.personScores, r.personScores),
        adjustments,
      },
    },
    mismatches,
  };
}
