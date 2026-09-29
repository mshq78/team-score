import { describe, it, expect } from 'vitest';
import { applyJudgeOps, mergeOperatorState, redactForJudge, JudgeOp } from './merge';
import { runningState, scoreEntry, startNewRun } from '../testing/runFixture';

describe('mergeOperatorState across runs', () => {
  it('a new run is not undone by the server’s old-run scores', () => {
    const server = runningState(); // run-1 with scores and notes
    const operator = startNewRun(server, { clearParticipants: false });
    const merged = mergeOperatorState(server, operator);
    expect(merged.scoring.runId).toBe('run-2');
    expect(merged.scoring.scores).toEqual({});
    expect(merged.scoring.notes).toEqual({});
    expect(merged.runs).toHaveLength(1);
  });

  it('same run: unchanged behaviour (newest score per cell wins, judge score survives)', () => {
    const server = runningState();
    server.scoring.scores['j1|a|i1'] = scoreEntry('a', 9, '2026-01-01T10:30:00.000Z');
    const operator = runningState();
    operator.scoring.scores['j1|a|i1'] = scoreEntry('a', 3, '2026-01-01T10:00:00.000Z');
    operator.teams[0].name = 'renamed';
    const merged = mergeOperatorState(server, operator);
    expect(merged.scoring.scores['j1|a|i1'].value).toBe(9);
    expect(merged.teams[0].name).toBe('renamed');
  });
});

describe('applyJudgeOps run stamp', () => {
  const op = (teamId: string, runId?: string): JudgeOp => ({ kind: 'score', entry: scoreEntry(teamId, 7), ...(runId ? { runId } : {}) });
  const open = () => {
    const s = runningState(false);
    s.scoring.events[0].status = 'active';
    return s;
  };

  it('ignores an op of an old run, accepts current-run and unstamped ops', () => {
    expect(Object.keys(applyJudgeOps(open(), 'j1', [op('a', 'run-0')]).scoring.scores)).toHaveLength(0);
    expect(Object.keys(applyJudgeOps(open(), 'j1', [op('a', 'run-1')]).scoring.scores)).toEqual(['j1|a|i1']);
    expect(Object.keys(applyJudgeOps(open(), 'j1', [op('a')]).scoring.scores)).toEqual(['j1|a|i1']);
  });

  it('never sends the archive to judges', () => {
    const s = startNewRun(runningState(), { clearParticipants: false });
    expect(s.runs).toHaveLength(1);
    expect(redactForJudge(s, 'j1').runs).toEqual([]);
  });
});
