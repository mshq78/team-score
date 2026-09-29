import { describe, it, expect } from 'vitest';
import { applyJudgeOps, mergeOperatorState, redactForJudge } from './merge';
import { AppState, INITIAL_SETTINGS, INITIAL_SCORING } from '../store/state';
import { ScoreEntry } from '../types';

function base(): AppState {
  return {
    schemaVersion: 4,
    participants: [],
    teams: ['a', 'b'].map((id) => ({ id, name: id, color: '', badgeBg: '', borderColor: '', textColor: '', memberIds: [] })),
    draftLog: [],
    runs: [],
    settings: INITIAL_SETTINGS,
    scoring: {
      ...INITIAL_SCORING,
      events: [{ id: 'e1', name: 'ناهار', weight: 1, order: 1, status: 'active', indicators: [{ id: 'i1', name: 'طعم', maxScore: 10, weight: 1, order: 1 }] }],
      judges: [
        { id: 'j1', name: 'الف', accessCode: '1111', eventIds: [] },
        { id: 'j2', name: 'ب', accessCode: '2222', eventIds: [] },
      ],
    },
  };
}

const entry = (judgeId: string, teamId: string, value: number, updatedAt: string): ScoreEntry => ({
  judgeId, teamId, eventId: 'e1', indicatorId: 'i1', value, updatedAt,
});

describe('mergeOperatorState', () => {
  it('never erases a newer judge score with an older operator copy', () => {
    const server = applyJudgeOps(base(), 'j1', [{ kind: 'score', entry: entry('j1', 'a', 9, '2026-01-01T10:05:00Z') }]);
    const operator = { ...base(), scoring: { ...base().scoring, scores: { 'j1|a|i1': entry('j1', 'a', 3, '2026-01-01T10:00:00Z') } } };
    expect(mergeOperatorState(server, operator).scoring.scores['j1|a|i1'].value).toBe(9);
  });

  it('keeps the operator configuration and drops scores of deleted judges', () => {
    const server = applyJudgeOps(base(), 'j2', [{ kind: 'score', entry: entry('j2', 'a', 5, '2026-01-01T10:00:00Z') }]);
    const operator = base();
    operator.scoring.judges = operator.scoring.judges.filter((j) => j.id !== 'j2');
    operator.teams[0].name = 'renamed';
    const merged = mergeOperatorState(server, operator);
    expect(merged.teams[0].name).toBe('renamed');
    expect(merged.scoring.scores['j2|a|i1']).toBeUndefined();
  });
});

describe('applyJudgeOps', () => {
  it('ignores ops for another judge, closed events and stale timestamps', () => {
    let s = applyJudgeOps(base(), 'j1', [{ kind: 'score', entry: entry('j2', 'a', 5, '2026-01-01T10:00:00Z') }]);
    expect(Object.keys(s.scoring.scores)).toHaveLength(0);

    s = applyJudgeOps(base(), 'j1', [{ kind: 'score', entry: entry('j1', 'a', 8, '2026-01-01T10:05:00Z') }]);
    s = applyJudgeOps(s, 'j1', [{ kind: 'score', entry: entry('j1', 'a', 2, '2026-01-01T10:00:00Z') }]);
    expect(s.scoring.scores['j1|a|i1'].value).toBe(8);

    const closed = base();
    closed.scoring.events[0].status = 'closed';
    expect(applyJudgeOps(closed, 'j1', [{ kind: 'score', entry: entry('j1', 'a', 5, '2026-01-01T10:00:00Z') }])).toBe(closed);
  });
});

describe('redactForJudge', () => {
  it('hides other judges, their codes and scores, and adjustments', () => {
    let s = applyJudgeOps(base(), 'j2', [{ kind: 'score', entry: entry('j2', 'a', 5, '2026-01-01T10:00:00Z') }]);
    s = { ...s, scoring: { ...s.scoring, adjustments: [{ id: 'x', teamId: 'a', eventId: null, points: 3, reason: 'r', createdAt: '' }] } };
    const r = redactForJudge(s, 'j1');
    expect(r.scoring.judges.map((j) => j.id)).toEqual(['j1']);
    expect(JSON.stringify(r)).not.toContain('2222');
    expect(Object.keys(r.scoring.scores)).toHaveLength(0);
    expect(r.scoring.adjustments).toHaveLength(0);
  });
});
