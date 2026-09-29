import { describe, it, expect, vi, afterEach } from 'vitest';
import { runningState, startNewRun, RUN2_START } from '../testing/runFixture';
import { INITIAL_STATE } from './state';
import { loadState, STORAGE_KEY_V3 } from './persistence';
import { validateAndSanitizeBackup } from '../utils/backup';

describe('START_NEW_RUN reducer', () => {
  it.each([true, false])('resets the run and keeps the setup (clearParticipants=%s)', (clearParticipants) => {
    const before = runningState();
    const after = startNewRun(before, { clearParticipants });

    // cleared
    expect(after.scoring.scores).toEqual({});
    expect(after.scoring.notes).toEqual({});
    expect(after.scoring.adjustments).toEqual([]);
    expect(after.scoring.events.every((e) => e.status === 'upcoming')).toBe(true);
    expect(after.scoring.settings.leaderboardFrozen).toBe(false);
    expect(after.scoring.settings.frozenSnapshot).toBeNull();
    expect(after.draftLog).toEqual([]);
    expect(after.teams.every((t) => t.memberIds.length === 0 && t.score === 0)).toBe(true);

    // new run identity
    expect(after.scoring.runId).toBe('run-2');
    expect(after.scoring.runName).toBe('روز دوم');
    expect(after.scoring.runStartedAt).toBe(RUN2_START);

    // participants
    if (clearParticipants) expect(after.participants).toEqual([]);
    else {
      expect(after.participants.map((p) => p.id)).toEqual(['p1', 'p2']);
      expect(after.participants.some((p) => 'pickedAt' in p)).toBe(false);
      expect(after.participants[0].phone).toBe('09120000001');
    }

    // kept: setup
    expect(after.scoring.events.map((e) => [e.id, e.indicators.length])).toEqual([['e1', 1]]);
    expect(after.scoring.judges).toEqual(before.scoring.judges);
    expect(after.teams.map((t) => [t.id, t.name, t.color])).toEqual(before.teams.map((t) => [t.id, t.name, t.color]));

    // archive stored, newest first, and the input state is not mutated
    expect(after.runs).toHaveLength(1);
    expect(after.runs[0]).toMatchObject({ id: 'run-1', name: 'روز اول', judgesCount: 1 });
    expect(before.scoring.scores).not.toEqual({});
  });

  it('keeps at most 60 archives, newest first', () => {
    let s = runningState(false);
    for (let i = 0; i < 62; i++) s = startNewRun(s, { clearParticipants: false, runId: `run-${i + 2}` });
    expect(s.runs).toHaveLength(60);
    expect(s.runs[0].id).toBe('run-62');
  });
});

describe('legacy data without run fields', () => {
  afterEach(() => vi.unstubAllGlobals());

  const legacy = () => {
    const { runs: _runs, ...rest } = INITIAL_STATE;
    void _runs;
    const { runId: _a, runName: _b, runStartedAt: _c, ...scoring } = rest.scoring;
    void _a; void _b; void _c;
    return JSON.parse(JSON.stringify({ ...rest, scoring }));
  };

  it('loadState fills defaults and does not throw', () => {
    const store: Record<string, string> = { [STORAGE_KEY_V3]: JSON.stringify(legacy()) };
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
    const state = loadState();
    expect(state.scoring.runId).toBe('run-1');
    expect(state.scoring.runName).toBe('');
    expect(state.scoring.runStartedAt).toBe('');
    expect(state.runs).toEqual([]);
  });

  it('validateAndSanitizeBackup fills defaults and does not throw', () => {
    const state = validateAndSanitizeBackup(legacy());
    expect(state).not.toBeNull();
    expect(state!.scoring.runId).toBe('run-1');
    expect(state!.scoring.runName).toBe('');
    expect(state!.scoring.runStartedAt).toBe('');
    expect(state!.runs).toEqual([]);
  });
});
