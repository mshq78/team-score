import { describe, it, expect } from 'vitest';
import { computeIndividualStandings } from './individuals';
import { appReducer } from '../store/reducer';
import { applyJudgeOps, mergeOperatorState, pruneOrphans, redactForJudge } from '../sync/merge';
import { runningState } from '../testing/runFixture';
import type { AppState } from '../store/state';

function base(): AppState {
  let s = runningState(false);
  s = appReducer(s, { type: 'ADD_PERSON_CRITERION', payload: { id: 'c1', name: 'اخلاق', maxScore: 10, order: 0 } });
  s = appReducer(s, { type: 'ADD_PERSON_CRITERION', payload: { id: 'c2', name: 'مشارکت', maxScore: 5, order: 0 } });
  s = appReducer(s, { type: 'ADD_JUDGE', payload: { id: 'j2', name: 'داور ۲', accessCode: '2222', eventIds: [] } });
  return s;
}
const set = (s: AppState, judgeId: string, participantId: string, criterionId: string, value: number | null, t = '2026-01-01T10:00:00Z') =>
  appReducer(s, { type: 'SET_PERSON_SCORE', payload: { judgeId, participantId, criterionId, value, updatedAt: t } });

describe('individual evaluation', () => {
  it('validates criteria and scores in the reducer', () => {
    let s = base();
    expect(s.scoring.personCriteria).toHaveLength(2);
    expect(set(s, 'j1', 'p1', 'c1', 11)).toBe(s); // above max
    expect(set(s, 'j1', 'p1', 'c1', 2.5)).toBe(s); // not an integer
    expect(set(s, 'j1', 'zz', 'c1', 5)).toBe(s); // unknown person
    expect(set(s, 'nope', 'p1', 'c1', 5)).toBe(s); // unknown judge
    s = set(s, 'j1', 'p1', 'c1', 8);
    expect(Object.keys(s.scoring.personScores!)).toEqual(['j1|p1|c1']);
  });

  it('averages over judges, ranks, and keeps team scores untouched', () => {
    let s = base();
    const teamScores = s.scoring.scores;
    s = set(s, 'j1', 'p1', 'c1', 8);
    s = set(s, 'j2', 'p1', 'c1', 6);
    s = set(s, 'j1', 'p1', 'c2', 5);
    s = set(s, 'j1', 'p2', 'c1', 9);
    const st = computeIndividualStandings(s);
    const p1 = st.find((r) => r.participantId === 'p1')!;
    expect(p1.perCriterion).toEqual({ c1: 7, c2: 5 });
    expect(p1.total).toBe(12);
    expect(p1.judgesCount).toBe(2);
    expect(p1.rank).toBe(1);
    expect(st.find((r) => r.participantId === 'p2')!.rank).toBe(2);
    expect(s.scoring.scores).toBe(teamScores);
  });

  it('deleting a criterion, judge or person removes their scores', () => {
    let s = set(base(), 'j1', 'p1', 'c1', 8);
    s = set(s, 'j2', 'p2', 'c2', 3);
    expect(Object.keys(appReducer(s, { type: 'DELETE_PERSON_CRITERION', payload: { id: 'c1' } }).scoring.personScores!)).toEqual(['j2|p2|c2']);
    expect(Object.keys(appReducer(s, { type: 'DELETE_JUDGE', payload: { judgeId: 'j2' } }).scoring.personScores!)).toEqual(['j1|p1|c1']);
    expect(Object.keys(appReducer(s, { type: 'REMOVE_PARTICIPANT', payload: { participantId: 'p1' } }).scoring.personScores!)).toEqual(['j2|p2|c2']);
  });

  it('a new run clears person scores but keeps the criteria', () => {
    const s = set(base(), 'j1', 'p1', 'c1', 8);
    const next = appReducer(s, {
      type: 'START_NEW_RUN',
      payload: { newRunId: 'run-2', newRunName: 'x', nowIso: '2026-02-01T00:00:00Z', archive: { id: 'a', name: 'a', startedAt: '', endedAt: '', eventNames: {}, judgesCount: 0, teams: [] }, clearParticipants: false },
    });
    expect(next.scoring.personScores).toEqual({});
    expect(next.scoring.personCriteria).toHaveLength(2);
  });

  it('syncs: judge ops apply for that judge only, operator merge keeps judge scores, redact hides others', () => {
    const s = base();
    const now = '2026-01-01T10:00:00Z';
    const applied = applyJudgeOps(s, 'j1', [
      { kind: 'person', entry: { judgeId: 'j1', participantId: 'p1', criterionId: 'c1', value: 7, updatedAt: now } },
      { kind: 'person', entry: { judgeId: 'j2', participantId: 'p1', criterionId: 'c1', value: 1, updatedAt: now } }, // other judge: ignored
    ]);
    expect(Object.keys(applied.scoring.personScores!)).toEqual(['j1|p1|c1']);

    // operator pushes an older copy (no judge scores): the judge's score survives
    const merged = mergeOperatorState(applied, { ...s, teams: s.teams });
    expect(Object.keys(merged.scoring.personScores!)).toEqual(['j1|p1|c1']);

    const two = set(applied, 'j2', 'p2', 'c2', 4);
    expect(Object.keys(redactForJudge(two, 'j1').scoring.personScores!)).toEqual(['j1|p1|c1']);

    // removing the person prunes their scores on the server
    const pruned = pruneOrphans({ ...applied, participants: applied.participants.filter((p) => p.id !== 'p1') });
    expect(pruned.scoring.personScores).toEqual({});
  });
});
