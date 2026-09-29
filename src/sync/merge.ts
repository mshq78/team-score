import type { AppState } from '../store/state';
import { appReducer } from '../store/reducer.js';
import type { ScoreEntry, ScoreNote } from '../types';

/**
 * Pure merge helpers shared by the sync server (Node) and the browser client.
 *
 * Ownership model:
 * - The operator (admin) owns everything except individual judge entries:
 *   teams, participants, events, judges, adjustments, settings.
 * - Scores and notes are merged per key, last write wins by `updatedAt`, so
 *   an operator push never erases a judge's newer score and vice versa.
 */

/** A judge-side change, queued on the phone until the server acknowledges it. */
export type JudgeOp =
  | { kind: 'score'; entry: ScoreEntry; runId?: string }
  | { kind: 'note'; note: ScoreNote; runId?: string };

const DEFAULT_RUN_ID = 'run-1';
export const runIdOf = (state: AppState): string => state.scoring.runId || DEFAULT_RUN_ID;

/** Thrown by mergeOperatorState when the operator's state belongs to an older run than the server's. */
export class StaleRunError extends Error {
  constructor() {
    super('stale_run');
    this.name = 'StaleRunError';
  }
}

/** Fills run fields that older data (or an older server row) does not have. */
export function withRunDefaults(state: AppState): AppState {
  return {
    ...state,
    runs: Array.isArray(state.runs) ? state.runs : [],
    scoring: {
      ...state.scoring,
      runId: state.scoring.runId || DEFAULT_RUN_ID,
      runName: state.scoring.runName ?? '',
      runStartedAt: state.scoring.runStartedAt ?? '',
    },
  };
}

function newer<T extends { updatedAt: string }>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

function mergeRecords<T extends { updatedAt: string }>(
  base: Record<string, T>,
  incoming: Record<string, T>
): Record<string, T> {
  const result: Record<string, T> = { ...base };
  for (const [key, value] of Object.entries(incoming)) {
    const winner = newer(result[key], value);
    if (winner) result[key] = winner;
  }
  return result;
}

/** Drops scores/notes whose judge, team, event or indicator no longer exists. */
export function pruneOrphans(state: AppState): AppState {
  const teamIds = new Set(state.teams.map((t) => t.id));
  const judgeIds = new Set(state.scoring.judges.map((j) => j.id));
  const indicatorEvent = new Map<string, string>();
  for (const ev of state.scoring.events) {
    for (const ind of ev.indicators) indicatorEvent.set(ind.id, ev.id);
  }

  const scores: Record<string, ScoreEntry> = {};
  for (const [key, s] of Object.entries(state.scoring.scores)) {
    if (teamIds.has(s.teamId) && judgeIds.has(s.judgeId) && indicatorEvent.get(s.indicatorId) === s.eventId) {
      scores[key] = s;
    }
  }
  const eventIds = new Set(state.scoring.events.map((e) => e.id));
  const notes: Record<string, ScoreNote> = {};
  for (const [key, n] of Object.entries(state.scoring.notes)) {
    if (teamIds.has(n.teamId) && judgeIds.has(n.judgeId) && eventIds.has(n.eventId)) {
      notes[key] = n;
    }
  }
  return { ...state, scoring: { ...state.scoring, scores, notes } };
}

/**
 * Merges an operator's full state into the server state: the operator's
 * configuration wins, scores/notes are merged per key (last write wins).
 *
 * Runs: with the same runId this is the normal merge. If the operator started
 * a newer run (later or equal runStartedAt) its state replaces the server's
 * scores/notes outright, so the previous run never comes back. An operator
 * that is still on an OLDER run than the server gets StaleRunError.
 */
export function mergeOperatorState(server: AppState, operator: AppState): AppState {
  if (runIdOf(server) === runIdOf(operator)) {
    return pruneOrphans({
      ...operator,
      scoring: {
        ...operator.scoring,
        scores: mergeRecords(server.scoring.scores, operator.scoring.scores),
        notes: mergeRecords(server.scoring.notes, operator.scoring.notes),
      },
    });
  }
  if ((operator.scoring.runStartedAt ?? '') >= (server.scoring.runStartedAt ?? '')) {
    return pruneOrphans(operator);
  }
  throw new StaleRunError();
}

/** Ops without a runId (older clients) are accepted; stamped ops must match the current run. */
const runMatches = (state: AppState, opRunId: string | undefined) =>
  opRunId === undefined || opRunId === runIdOf(state);

/**
 * Applies judge ops through the regular reducer, so every rule (event must be
 * open, value in range, indicator belongs to event...) is enforced exactly as
 * in the app. Ops for another judge or events the judge may not score are
 * ignored, as are ops older than what is already stored.
 */
export function applyJudgeOps(state: AppState, judgeId: string, ops: JudgeOp[]): AppState {
  const judge = state.scoring.judges.find((j) => j.id === judgeId);
  if (!judge) return state;
  const allowed = (eventId: string) => judge.eventIds.length === 0 || judge.eventIds.includes(eventId);

  let next = state;
  for (const op of ops) {
    if (op.kind === 'score') {
      const e = op.entry;
      if (e.judgeId !== judgeId || !allowed(e.eventId) || !runMatches(next, op.runId)) continue;
      const existing = next.scoring.scores[`${e.judgeId}|${e.teamId}|${e.indicatorId}`];
      if (existing && existing.updatedAt >= e.updatedAt) continue;
      next = appReducer(next, { type: 'SET_SCORE', payload: { ...e, source: 'judge' } });
    } else {
      const n = op.note;
      if (n.judgeId !== judgeId || !allowed(n.eventId) || !runMatches(next, op.runId)) continue;
      const event = next.scoring.events.find((ev) => ev.id === n.eventId);
      if (!event || event.status === 'closed') continue;
      if (!next.teams.some((t) => t.id === n.teamId)) continue;
      const existing = next.scoring.notes[`${n.judgeId}|${n.teamId}|${n.eventId}`];
      if (existing && existing.updatedAt >= n.updatedAt) continue;
      next = appReducer(next, { type: 'SET_NOTE', payload: { ...n, text: String(n.text).slice(0, 2000) } });
    }
  }
  return next;
}

/**
 * What a judge's phone is allowed to see: no totals-relevant data from other
 * judges, no adjustments, no other access codes, no frozen snapshot.
 */
export function redactForJudge(state: AppState, judgeId: string): AppState {
  const own = <T extends { judgeId: string }>(rec: Record<string, T>) =>
    Object.fromEntries(Object.entries(rec).filter(([, v]) => v.judgeId === judgeId));
  return {
    ...state,
    draftLog: [],
    runs: [],
    scoring: {
      ...state.scoring,
      judges: state.scoring.judges.filter((j) => j.id === judgeId),
      scores: own(state.scoring.scores),
      notes: own(state.scoring.notes),
      adjustments: [],
      settings: { ...state.scoring.settings, frozenSnapshot: null },
    },
  };
}

/** Minimal structural check for a state received over the network. */
export function isAppStateLike(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<AppState>;
  return (
    typeof v.schemaVersion === 'number' &&
    Array.isArray(v.participants) &&
    Array.isArray(v.teams) &&
    !!v.scoring &&
    Array.isArray(v.scoring.events) &&
    Array.isArray(v.scoring.judges) &&
    typeof v.scoring.scores === 'object' &&
    typeof v.scoring.notes === 'object'
  );
}
