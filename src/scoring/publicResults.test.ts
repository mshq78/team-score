import { describe, it, expect } from 'vitest';
import { buildPublicResults, publicTokenOf } from './publicResults';
import { runningState } from '../testing/runFixture';

describe('buildPublicResults', () => {
  it('shows the entered points and ranks', () => {
    const base = runningState(true); // scores 3 and 9 out of 10 from one judge
    const s = { ...base, scoring: { ...base.scoring, adjustments: [], settings: { ...base.scoring.settings, leaderboardFrozen: false, frozenSnapshot: null } } };
    const r = buildPublicResults(s, 'ب');
    expect(r.totalMax).toBe(10);
    expect(r.teams.find((t) => t.name === 'تیم b')!.total).toBe(9);
    expect(r.teams.find((t) => t.name === 'تیم a')!.total).toBe(3);
    expect(r.teams[0].rank).toBe(1);
  });
  it('uses the frozen snapshot while the leaderboard is frozen', () => {
    const s = runningState(true);
    const frozen = {
      ...s,
      scoring: { ...s.scoring, settings: { ...s.scoring.settings, leaderboardFrozen: true, frozenSnapshot: [{ teamId: 'a', eventScores: { e1: 100 }, adjustmentsTotal: 0, grandTotal: 100, rank: 1, completionPercentage: 100 }] } },
    };
    const r = buildPublicResults(frozen, 'ب');
    expect(r.frozen).toBe(true);
    expect(r.teams).toHaveLength(1);
    expect(r.teams[0].total).toBe(100); // the frozen snapshot is shown as it was
  });
  it('token needs at least 12 characters', () => {
    const s = runningState(false);
    expect(publicTokenOf(s)).toBe('');
    expect(publicTokenOf({ ...s, scoring: { ...s.scoring, settings: { ...s.scoring.settings, publicToken: 'short' } } })).toBe('');
    expect(publicTokenOf({ ...s, scoring: { ...s.scoring, settings: { ...s.scoring.settings, publicToken: 'abcdefghijkl' } } })).toBe('abcdefghijkl');
  });
});
