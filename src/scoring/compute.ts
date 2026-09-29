import { TeamStanding, ScoringEvent } from '../types';
import { AppState } from '../store/state';

/**
 * Rounds a number to at most 1 decimal place.
 */
export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Helper to compute event score for a given team on a specific event.
 * Returns a number between 0 and 100, or null if no scored indicators exist.
 */
export function computeEventScore(
  state: AppState,
  eventId: string,
  teamId: string
): number | null {
  const event = state.scoring.events.find((e) => e.id === eventId);
  if (!event || event.indicators.length === 0) return null;

  let totalWeightedIndicatorAverage = 0;
  let totalIndicatorWeights = 0;

  for (const indicator of event.indicators) {
    const maxScore = indicator.maxScore > 0 ? indicator.maxScore : 10;
    const weight = indicator.weight > 0 ? indicator.weight : 1;

    // Find all non-null judge scores for this indicator and team
    let judgeSum = 0;
    let judgeCount = 0;

    for (const judge of state.scoring.judges) {
      // Check if judge is assigned to this event
      if (judge.eventIds.length > 0 && !judge.eventIds.includes(eventId)) {
        continue;
      }

      const key = `${judge.id}|${teamId}|${indicator.id}`;
      const entry = state.scoring.scores[key];
      if (entry && entry.value !== null && entry.value !== undefined) {
        // Clamp: maxScore may have been lowered after scores were entered
        judgeSum += Math.min(Math.max(entry.value, 0), maxScore) / maxScore;
        judgeCount++;
      }
    }

    if (judgeCount > 0) {
      const indicatorAverage = judgeSum / judgeCount; // 0 to 1
      totalWeightedIndicatorAverage += indicatorAverage * weight;
      totalIndicatorWeights += weight;
    }
  }

  if (totalIndicatorWeights === 0) {
    return null;
  }

  // Multiply by 100 for a 0–100 scale
  return (totalWeightedIndicatorAverage / totalIndicatorWeights) * 100;
}

/**
 * Computes the judging completion percentage for a given team across all events.
 */
export function computeTeamCompletionPercentage(
  state: AppState,
  teamId: string
): number {
  let totalSlots = 0;
  let filledSlots = 0;

  for (const event of state.scoring.events) {
    const eligibleJudges = state.scoring.judges.filter(
      (j) => j.eventIds.length === 0 || j.eventIds.includes(event.id)
    );

    for (const judge of eligibleJudges) {
      for (const indicator of event.indicators) {
        totalSlots++;
        const key = `${judge.id}|${teamId}|${indicator.id}`;
        const entry = state.scoring.scores[key];
        if (entry && entry.value !== null && entry.value !== undefined) {
          filledSlots++;
        }
      }
    }
  }

  if (totalSlots === 0) return 0;
  return (filledSlots / totalSlots) * 100;
}

/**
 * Computes LIVE standings for all teams in state.teams.
 * Always ignores the leaderboard freeze: the freeze only affects what the stage
 * leaderboard displays (see getDisplayedStandings), never the real results used
 * by the reveal, the report or the rank history.
 */
export function computeStandings(state: AppState): TeamStanding[] {
  const { events, adjustments, settings } = state.scoring;

  // Pre-calculate raw data for each team
  const rawList = state.teams.map((team) => {
    const eventScores: Record<string, number | null> = {};
    let weightedEventsSum = 0;
    let totalEventsWeight = 0;

    for (const event of events) {
      const score = computeEventScore(state, event.id, team.id);
      eventScores[event.id] = score;

      if (score !== null) {
        const weight = event.weight > 0 ? event.weight : 1;
        weightedEventsSum += score * weight;
        totalEventsWeight += weight;
      }
    }

    const baseEventScore = totalEventsWeight > 0 ? weightedEventsSum / totalEventsWeight : 0;

    // Adjustments for this team
    const teamAdjustments = adjustments.filter((a) => a.teamId === team.id);
    const adjustmentsTotal = teamAdjustments.reduce((sum, a) => sum + (Number(a.points) || 0), 0);

    const grandTotal = baseEventScore + adjustmentsTotal;
    const completionPercentage = computeTeamCompletionPercentage(state, team.id);

    return {
      teamId: team.id,
      eventScores,
      adjustmentsTotal,
      grandTotal,
      completionPercentage,
    };
  });

  // Calculate event wins for tie-breaking 'most_event_wins'
  const eventWinsCount: Record<string, number> = {};
  for (const team of state.teams) {
    eventWinsCount[team.id] = 0;
  }

  for (const event of events) {
    let topScore = -Infinity;
    for (const item of rawList) {
      const s = item.eventScores[event.id];
      if (s !== null && s > topScore) {
        topScore = s;
      }
    }
    if (topScore > -Infinity) {
      for (const item of rawList) {
        const s = item.eventScores[event.id];
        if (s !== null && Math.abs(s - topScore) < 1e-6) {
          eventWinsCount[item.teamId] = (eventWinsCount[item.teamId] || 0) + 1;
        }
      }
    }
  }

  // Sort events by order descending for 'highest_last_event'
  const sortedEventsDescending = [...events].sort((a, b) => b.order - a.order);

  // Sorting comparator
  const sorted = [...rawList].sort((a, b) => {
    // Primary: grandTotal descending
    const diff = b.grandTotal - a.grandTotal;
    if (Math.abs(diff) > 1e-6) {
      return diff;
    }

    // Tie-break rule
    if (settings.tieBreak === 'most_event_wins') {
      const winsA = eventWinsCount[a.teamId] || 0;
      const winsB = eventWinsCount[b.teamId] || 0;
      if (winsB !== winsA) {
        return winsB - winsA;
      }
    } else if (settings.tieBreak === 'highest_last_event') {
      for (const ev of sortedEventsDescending) {
        const scoreA = a.eventScores[ev.id] ?? -1;
        const scoreB = b.eventScores[ev.id] ?? -1;
        if (Math.abs(scoreB - scoreA) > 1e-6) {
          return scoreB - scoreA;
        }
      }
    }

    // If manual or still tied
    return 0;
  });

  // Assign ranks
  const standings: TeamStanding[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (i === 0) {
      currentRank = 1;
    } else {
      const prev = sorted[i - 1];
      const isGrandTotalTied = Math.abs(current.grandTotal - prev.grandTotal) < 1e-6;

      let isTied = false;
      if (settings.tieBreak === 'manual') {
        isTied = isGrandTotalTied;
      } else if (settings.tieBreak === 'most_event_wins') {
        isTied =
          isGrandTotalTied &&
          (eventWinsCount[current.teamId] || 0) === (eventWinsCount[prev.teamId] || 0);
      } else if (settings.tieBreak === 'highest_last_event') {
        if (isGrandTotalTied) {
          let eventScoreDiff = false;
          for (const ev of sortedEventsDescending) {
            const scoreCurr = current.eventScores[ev.id] ?? -1;
            const scorePrev = prev.eventScores[ev.id] ?? -1;
            if (Math.abs(scoreCurr - scorePrev) > 1e-6) {
              eventScoreDiff = true;
              break;
            }
          }
          isTied = !eventScoreDiff;
        }
      }

      if (!isTied) {
        currentRank = i + 1;
      }
    }

    standings.push({
      teamId: current.teamId,
      eventScores: current.eventScores,
      adjustmentsTotal: current.adjustmentsTotal,
      grandTotal: current.grandTotal,
      rank: currentRank,
      completionPercentage: current.completionPercentage,
    });
  }

  return standings;
}

/**
 * Standings shown on the stage leaderboard: the frozen snapshot while the
 * leaderboard is frozen, otherwise live standings.
 */
export function getDisplayedStandings(state: AppState): TeamStanding[] {
  const { leaderboardFrozen, frozenSnapshot } = state.scoring.settings;
  if (leaderboardFrozen && frozenSnapshot && frozenSnapshot.length > 0) {
    const teamIds = new Set(state.teams.map((t) => t.id));
    return frozenSnapshot.filter((s) => teamIds.has(s.teamId));
  }
  return computeStandings(state);
}

/**
 * Computes the winning team of each 'closed' event.
 * Returns a Record from eventId to { teamId, score } or null if no team has scores.
 */
export function computeEventWinners(
  state: AppState
): Record<string, { teamId: string; score: number } | null> {
  const result: Record<string, { teamId: string; score: number } | null> = {};

  const closedEvents = state.scoring.events.filter((e) => e.status === 'closed');

  for (const event of closedEvents) {
    let topTeamId: string | null = null;
    let topScore = -Infinity;

    for (const team of state.teams) {
      const score = computeEventScore(state, event.id, team.id);
      if (score !== null && score > topScore) {
        topScore = score;
        topTeamId = team.id;
      }
    }

    if (topTeamId !== null && topScore > -Infinity) {
      result[event.id] = {
        teamId: topTeamId,
        score: topScore,
      };
    } else {
      result[event.id] = null;
    }
  }

  return result;
}

export interface EventRankPoint {
  eventId: string;
  eventName: string;
  rank: number;
  score: number | null;
}

export interface TeamRankHistory {
  teamId: string;
  points: EventRankPoint[];
}

/**
 * Computes each team's rank trajectory after each closed event.
 * Reuses computeStandings for cumulative standings at each milestone.
 */
export function computeRankHistory(state: AppState): {
  events: ScoringEvent[];
  history: TeamRankHistory[];
} {
  const closedEvents = state.scoring.events
    .filter((e) => e.status === 'closed')
    .sort((a, b) => a.order - b.order);

  const teamHistoryMap: Record<string, EventRankPoint[]> = {};
  for (const team of state.teams) {
    teamHistoryMap[team.id] = [];
  }

  for (let i = 0; i < closedEvents.length; i++) {
    const eventsUpToNow = closedEvents.slice(0, i + 1);
    const subState: AppState = {
      ...state,
      scoring: {
        ...state.scoring,
        events: eventsUpToNow,
      },
    };

    const standings = computeStandings(subState);
    const currentEvent = closedEvents[i];

    for (const standing of standings) {
      if (teamHistoryMap[standing.teamId]) {
        teamHistoryMap[standing.teamId].push({
          eventId: currentEvent.id,
          eventName: currentEvent.name,
          rank: standing.rank,
          score: standing.grandTotal,
        });
      }
    }
  }

  const history: TeamRankHistory[] = state.teams.map((t) => ({
    teamId: t.id,
    points: teamHistoryMap[t.id] || [],
  }));

  return {
    events: closedEvents,
    history,
  };
}
