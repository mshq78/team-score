import type { AppState } from '../store/state';

export interface IndividualStanding {
  participantId: string;
  name: string;
  teamName: string;
  /** Average of all judges' values per criterion (null = nobody scored it) */
  perCriterion: Record<string, number | null>;
  /** Sum of the per-criterion averages */
  total: number;
  /** total / (sum of all criteria maximums) * 100 */
  percent: number;
  /** How many judges scored this person at all */
  judgesCount: number;
  /** null when nobody scored the person yet */
  rank: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Individual evaluation, kept apart from team ranking: for each person the
 * average over judges per criterion, their sum and the rank (ties share a rank).
 */
export function computeIndividualStandings(state: AppState): IndividualStanding[] {
  const criteria = state.scoring.personCriteria ?? [];
  const scores = Object.values(state.scoring.personScores ?? {});
  const maxSum = criteria.reduce((a, c) => a + c.maxScore, 0);
  const teamOf = new Map<string, string>();
  for (const t of state.teams) for (const id of t.memberIds) teamOf.set(id, t.name);

  const rows: IndividualStanding[] = state.participants.map((p) => {
    const mine = scores.filter((s) => s.participantId === p.id && s.value !== null);
    const perCriterion: Record<string, number | null> = {};
    let total = 0;
    for (const c of criteria) {
      const vals = mine.filter((s) => s.criterionId === c.id).map((s) => s.value as number);
      const avg = vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      perCriterion[c.id] = avg;
      total += avg ?? 0;
    }
    total = round2(total);
    return {
      participantId: p.id,
      name: p.name,
      teamName: teamOf.get(p.id) ?? '',
      perCriterion,
      total,
      percent: maxSum ? round2((total / maxSum) * 100) : 0,
      judgesCount: new Set(mine.map((s) => s.judgeId)).size,
      rank: null,
    };
  });

  const scored = rows.filter((r) => r.judgesCount > 0).sort((a, b) => b.total - a.total);
  scored.forEach((r, i) => {
    r.rank = i > 0 && r.total === scored[i - 1].total ? (scored[i - 1].rank as number) : i + 1;
  });
  return [...scored, ...rows.filter((r) => r.judgesCount === 0)];
}
