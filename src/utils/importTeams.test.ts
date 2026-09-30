import { describe, it, expect } from 'vitest';
import { applyTeamsOnly } from './importTeams';
import { mergeOperatorState, runIdOf } from '../sync/merge';
import { INITIAL_STATE, INITIAL_SCORING, type AppState } from '../store/state';

describe('applyTeamsOnly', () => {
  const current: AppState = {
    ...INITIAL_STATE,
    scoring: { ...INITIAL_SCORING, runId: 'run-7', runStartedAt: '2026-05-01', judges: [{ id: 'j1' } as never] },
  };
  const incoming: AppState = {
    ...INITIAL_STATE,
    participants: [{ id: 'p9', name: 'نو' }],
    teams: [{ ...INITIAL_STATE.teams[0], id: 't9', memberIds: ['p9'] }],
    draftLog: [{ id: 'd1' } as never],
    scoring: { ...INITIAL_SCORING, runId: 'run-1', judges: [] },
  };

  it('replaces only participants, teams and draftLog', () => {
    const next = applyTeamsOnly(current, incoming);
    expect(next.participants).toBe(incoming.participants);
    expect(next.teams).toBe(incoming.teams);
    expect(next.draftLog).toBe(incoming.draftLog);
    expect(next.scoring).toBe(current.scoring);
    expect(next.runs).toBe(current.runs);
    expect(runIdOf(next)).toBe('run-7');
  });

  it('merges with the server state without a stale-run error', () => {
    const next = applyTeamsOnly(current, incoming);
    expect(() => mergeOperatorState(current, next)).not.toThrow();
  });
});
