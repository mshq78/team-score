import { describe, it, expect } from 'vitest';
import { buildRunArchive } from './archive';
import { computeStandings } from './compute';
import { runningState } from '../testing/runFixture';

describe('buildRunArchive', () => {
  it('uses the live standings, not the frozen snapshot', () => {
    const state = runningState(); // leaderboard frozen with a snapshot that ranks team a first
    const live = computeStandings(state);
    const archive = buildRunArchive(state, '2026-01-01T18:00:00.000Z');

    expect(live[0].teamId).toBe('b'); // b scored 9, a scored 3 (+2 bonus)
    expect(archive.teams.map((t) => t.teamId)).toEqual(live.map((s) => s.teamId));
    for (const st of live) {
      const t = archive.teams.find((x) => x.teamId === st.teamId)!;
      expect(t.rank).toBe(st.rank);
      expect(t.grandTotal).toBe(st.grandTotal);
      expect(t.completionPercentage).toBe(st.completionPercentage);
      expect(t.eventScores).toEqual(st.eventScores);
    }
    expect(archive.teams[0].grandTotal).not.toBe(99); // the frozen snapshot’s value
    expect(archive).toMatchObject({ id: 'run-1', name: 'روز اول', judgesCount: 1, endedAt: '2026-01-01T18:00:00.000Z' });
  });
});
