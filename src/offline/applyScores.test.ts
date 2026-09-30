import { describe, it, expect } from 'vitest';
import { applyScores } from './applyScores';
import { INITIAL_STATE, INITIAL_SCORING, type AppState } from '../store/state';
import type { ScoreEntry } from '../types';

const entry = (teamId: string): ScoreEntry => ({
  judgeId: 'j1', teamId, indicatorId: 'i1', eventId: 'e1', value: 5, updatedAt: '2026-01-01T00:00:00Z',
} as ScoreEntry);

function make(teamIds: string[]): AppState {
  return {
    ...INITIAL_STATE,
    participants: [{ id: 'p1', name: 'الف' }],
    teams: teamIds.map((id) => ({ ...INITIAL_STATE.teams[0], id, memberIds: [] })),
    draftLog: [],
    runs: [],
  };
}

describe('applyScores', () => {
  it('copies only scoring and keeps local data', () => {
    const local = { ...make(['t1', 't2']), draftLog: [{ id: 'd' } as never] };
    const incoming: AppState = {
      ...make(['x']),
      participants: [],
      settings: { ...local.settings, mode: 'stage' },
      scoring: { ...INITIAL_SCORING, runId: 'run-9', scores: { a: entry('t1') } },
    };
    const { state, mismatches } = applyScores(local, incoming);
    expect(mismatches).toBe(0);
    expect(state.scoring).toBe(incoming.scoring);
    expect(state.participants).toBe(local.participants);
    expect(state.teams).toBe(local.teams);
    expect(state.draftLog).toBe(local.draftLog);
    expect(state.settings).toBe(local.settings);
    expect(state.runs).toBe(local.runs);
  });

  it('counts scores and adjustments with unknown team ids', () => {
    const local = make(['t1']);
    const incoming: AppState = {
      ...local,
      scoring: {
        ...INITIAL_SCORING,
        scores: { a: entry('t1'), b: entry('zz'), c: entry('yy') },
        adjustments: [{ id: 'a1', teamId: 'qq' } as never, { id: 'a2', teamId: 't1' } as never],
      },
    };
    expect(applyScores(local, incoming).mismatches).toBe(3);
  });

  it('same run: keeps local setup, merges entered data (newest wins, adjustments by id)', () => {
    const local: AppState = {
      ...make(['t1']),
      scoring: {
        ...INITIAL_SCORING,
        judges: [{ id: 'j1', name: 'محلی', accessCode: '1', eventIds: [] }],
        scores: { a: { ...entry('t1'), value: 1, updatedAt: '2026-01-02T00:00:00Z' }, b: entry('t1') },
        adjustments: [{ id: 'x', teamId: 't1' } as never],
      },
    };
    const incoming: AppState = {
      ...local,
      scoring: {
        ...INITIAL_SCORING,
        judges: [],
        scores: { a: { ...entry('t1'), value: 9, updatedAt: '2026-01-01T00:00:00Z' }, c: entry('t1') },
        personScores: { p: { judgeId: 'j1', participantId: 'p1', criterionId: 'c', value: 3, updatedAt: '2026-01-01T00:00:00Z' } },
        adjustments: [{ id: 'x', teamId: 't1' } as never, { id: 'y', teamId: 't1' } as never],
      },
    };
    const { state } = applyScores(local, incoming);
    expect(state.scoring.judges).toBe(local.scoring.judges);
    expect(state.scoring.scores.a.value).toBe(1); // local one is newer
    expect(Object.keys(state.scoring.scores).sort()).toEqual(['a', 'b', 'c']);
    expect(Object.keys(state.scoring.personScores ?? {})).toEqual(['p']);
    expect(state.scoring.adjustments.map((a) => a.id)).toEqual(['x', 'y']);
  });
});
