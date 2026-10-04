import type { AppState } from '../store/state';
import { getDisplayedStandings, getEventScale, getTotalScale, toScale } from './compute.js';

export interface PublicResults {
  eventName: string;
  runName: string;
  /** True while the operator froze the leaderboard (the numbers shown are the frozen ones) */
  frozen: boolean;
  totalScale: number;
  events: { id: string; name: string; scale: number }[];
  teams: {
    teamId: string;
    name: string;
    color: string;
    memberCount: number;
    rank: number;
    /** On the scale the scores were entered on */
    total: number;
    eventScores: Record<string, number | null>;
  }[];
}

const MIN_TOKEN = 12;

/** Is `token` the state's active public-link secret? (constant-time-ish compare is done by the caller's safeEqual) */
export function publicTokenOf(state: AppState): string {
  const t = state.scoring.settings.publicToken;
  return typeof t === 'string' && t.length >= MIN_TOKEN ? t : '';
}

/**
 * What anyone with the public link may see: team ranking and scores only.
 * No judges, access codes, notes, individual scores, adjustment reasons or phone numbers.
 */
export function buildPublicResults(state: AppState, eventName: string): PublicResults {
  const totalScale = getTotalScale(state);
  const events = state.scoring.events.filter((e) => e.indicators.length > 0);
  const scaleOf = new Map(events.map((e) => [e.id, getEventScale(e)]));
  const teams = getDisplayedStandings(state).map((st) => {
    const team = state.teams.find((t) => t.id === st.teamId);
    const eventScores: Record<string, number | null> = {};
    for (const e of events) {
      const v = st.eventScores[e.id];
      eventScores[e.id] = v === null || v === undefined ? null : toScale(v, scaleOf.get(e.id) ?? 100);
    }
    return {
      teamId: st.teamId,
      name: team?.name ?? '',
      color: team?.color ?? '',
      memberCount: team?.memberIds.length ?? 0,
      rank: st.rank,
      total: toScale(st.grandTotal, totalScale),
      eventScores,
    };
  });
  return {
    eventName,
    runName: state.scoring.runName ?? '',
    frozen: !!state.scoring.settings.leaderboardFrozen,
    totalScale,
    events: events.map((e) => ({ id: e.id, name: e.name, scale: scaleOf.get(e.id) ?? 100 })),
    teams,
  };
}
