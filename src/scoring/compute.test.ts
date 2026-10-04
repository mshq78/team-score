import { describe, it, expect } from 'vitest';
import { computeStandings, computeEventWinners, computeEventScore, getEventMax, getTotalMax } from './compute';
import { AppState, INITIAL_SETTINGS } from '../store/state';
import { BootcampTeam, ScoringEvent, Judge, ScoreEntry, ScoreAdjustment } from '../types';

function createMockState(params: {
  teams: BootcampTeam[];
  events: ScoringEvent[];
  judges: Judge[];
  scores: Record<string, ScoreEntry>;
  adjustments?: ScoreAdjustment[];
  tieBreak?: 'most_event_wins' | 'highest_last_event' | 'manual';
}): AppState {
  return {
    schemaVersion: 4,
    participants: [],
    teams: params.teams,
    draftLog: [],
    runs: [],
    settings: INITIAL_SETTINGS,
    scoring: {
      events: params.events,
      judges: params.judges,
      scores: params.scores,
      notes: {},
      adjustments: params.adjustments || [],
      settings: {
        leaderboardFrozen: false,
        frozenSnapshot: null,
        showJudgeNames: true,
        tieBreak: params.tieBreak || 'most_event_wins',
      },
    },
  };
}

describe('Scoring math: computeStandings & computeEventWinners', () => {
  const team1: BootcampTeam = {
    id: 'team-1',
    name: 'تیم اول',
    color: 'from-amber-500 to-yellow-500',
    badgeBg: 'bg-amber-500/20 text-amber-400',
    borderColor: 'border-amber-500/40',
    textColor: 'text-amber-400',
    memberIds: [],
  };

  const team2: BootcampTeam = {
    id: 'team-2',
    name: 'تیم دوم',
    color: 'from-blue-500 to-indigo-500',
    badgeBg: 'bg-blue-500/20 text-blue-400',
    borderColor: 'border-blue-500/40',
    textColor: 'text-blue-400',
    memberIds: [],
  };

  const judge1: Judge = { id: 'j1', name: 'داور ۱', accessCode: '1001', eventIds: [] };
  const judge2: Judge = { id: 'j2', name: 'داور ۲', accessCode: '1002', eventIds: [] };

  it('correctly handles indicator weights and event weights', () => {
    // Event with 2 indicators: weight 1 and weight 3
    const event1: ScoringEvent = {
      id: 'e1',
      name: 'مسابقه ۱',
      weight: 2,
      order: 1,
      status: 'active',
      indicators: [
        { id: 'ind1', name: 'دقت', maxScore: 10, weight: 1, order: 1 },
        { id: 'ind2', name: 'سرعت', maxScore: 10, weight: 3, order: 2 },
      ],
    };

    // team1 scores: ind1 = 10 (weight 1), ind2 = 6 (weight 3) -> event = 10*1 + 6*3 = 28; total = 28 * event weight 2 = 56
    const scores: Record<string, ScoreEntry> = {
      'j1|team-1|ind1': { judgeId: 'j1', teamId: 'team-1', eventId: 'e1', indicatorId: 'ind1', value: 10, updatedAt: '' },
      'j1|team-1|ind2': { judgeId: 'j1', teamId: 'team-1', eventId: 'e1', indicatorId: 'ind2', value: 6, updatedAt: '' },
    };

    const state = createMockState({
      teams: [team1, team2],
      events: [event1],
      judges: [judge1],
      scores,
    });

    const standings = computeStandings(state);
    const standingTeam1 = standings.find((s) => s.teamId === 'team-1')!;

    expect(standingTeam1.eventScores['e1']).toBeCloseTo(28, 2);
    expect(standingTeam1.grandTotal).toBeCloseTo(56, 2);
    expect(standingTeam1.rank).toBe(1);
  });

  it('sums the entered points over indicators and events, averaging only across judges', () => {
    const mk = (id: string, order: number, maxes: number[]): ScoringEvent => ({
      id, name: id, weight: 1, order, status: 'active',
      indicators: maxes.map((m, i) => ({ id: `${id}-i${i}`, name: 'x', maxScore: m, weight: 1, order: i })),
    });
    const e1 = mk('e1', 1, [10, 10]); // two indicators out of 10
    const e2 = mk('e2', 2, [20]); // one indicator out of 20
    const sc = (j: string, ind: string, ev: string, v: number): [string, ScoreEntry] => [`${j}|team-1|${ind}`, { judgeId: j, teamId: 'team-1', eventId: ev, indicatorId: ind, value: v, updatedAt: '' }];
    const scores = Object.fromEntries([
      sc('j1', 'e1-i0', 'e1', 8), sc('j2', 'e1-i0', 'e1', 6), // indicator average 7
      sc('j1', 'e1-i1', 'e1', 10), sc('j2', 'e1-i1', 'e1', 10), // 10
      sc('j1', 'e2-i0', 'e2', 17), // 17
    ]);
    const state = createMockState({ teams: [team1], events: [e1, e2], judges: [judge1, judge2], scores });
    const st = computeStandings(state)[0];
    expect(st.eventScores['e1']).toBe(17); // 7 + 10
    expect(st.eventScores['e2']).toBe(17);
    expect(st.grandTotal).toBe(34); // plain sum, not a percentage
    expect(getEventMax(e1)).toBe(20);
    expect(getTotalMax(state)).toBe(40);
  });

  it('correctly excludes indicators and events with missing scores', () => {
    const event1: ScoringEvent = {
      id: 'e1',
      name: 'بازی اول',
      weight: 1,
      order: 1,
      status: 'active',
      indicators: [
        { id: 'ind1', name: 'شاخص ۱', maxScore: 10, weight: 1, order: 1 },
        { id: 'ind2', name: 'شاخص ۲ (بدون نمره)', maxScore: 10, weight: 5, order: 2 },
      ],
    };

    const event2: ScoringEvent = {
      id: 'e2',
      name: 'بازی دوم (کلا بدون نمره)',
      weight: 10,
      order: 2,
      status: 'upcoming',
      indicators: [{ id: 'ind3', name: 'شاخص ۳', maxScore: 10, weight: 1, order: 1 }],
    };

    // Only ind1 has a score (8) -> event 1 = 8 (ind2 adds nothing)
    // event 2 has no scores, so the total is just event 1
    const scores: Record<string, ScoreEntry> = {
      'j1|team-1|ind1': { judgeId: 'j1', teamId: 'team-1', eventId: 'e1', indicatorId: 'ind1', value: 8, updatedAt: '' },
    };

    const state = createMockState({
      teams: [team1],
      events: [event1, event2],
      judges: [judge1],
      scores,
    });

    const standings = computeStandings(state);
    expect(standings[0].eventScores['e1']).toBeCloseTo(8, 2);
    expect(standings[0].eventScores['e2']).toBeNull();
    expect(standings[0].grandTotal).toBeCloseTo(8, 2);
  });

  it('correctly adds positive and negative adjustments', () => {
    const event1: ScoringEvent = {
      id: 'e1',
      name: 'بازی',
      weight: 1,
      order: 1,
      status: 'active',
      indicators: [{ id: 'ind1', name: 'معیار', maxScore: 10, weight: 1, order: 1 }],
    };

    const scores: Record<string, ScoreEntry> = {
      'j1|team-1|ind1': { judgeId: 'j1', teamId: 'team-1', eventId: 'e1', indicatorId: 'ind1', value: 8, updatedAt: '' },
      'j1|team-2|ind1': { judgeId: 'j1', teamId: 'team-2', eventId: 'e1', indicatorId: 'ind1', value: 8, updatedAt: '' },
    };

    const adjustments: ScoreAdjustment[] = [
      { id: 'a1', teamId: 'team-1', eventId: null, points: -5, reason: 'تاخیر', createdAt: '' },
      { id: 'a2', teamId: 'team-2', eventId: null, points: 10, reason: 'اخلاق', createdAt: '' },
    ];

    const state = createMockState({
      teams: [team1, team2],
      events: [event1],
      judges: [judge1],
      scores,
      adjustments,
    });

    const standings = computeStandings(state);
    const s1 = standings.find((s) => s.teamId === 'team-1')!;
    const s2 = standings.find((s) => s.teamId === 'team-2')!;

    expect(s1.adjustmentsTotal).toBe(-5);
    expect(s1.grandTotal).toBe(3);
    expect(s1.rank).toBe(2);

    expect(s2.adjustmentsTotal).toBe(10);
    expect(s2.grandTotal).toBe(18);
    expect(s2.rank).toBe(1);
  });

  it('breaks ties using tieBreak: most_event_wins', () => {
    const e1: ScoringEvent = {
      id: 'e1',
      name: 'رویداد ۱',
      weight: 1,
      order: 1,
      status: 'closed',
      indicators: [{ id: 'ind1', name: 'معیار', maxScore: 10, weight: 1, order: 1 }],
    };
    const e2: ScoringEvent = {
      id: 'e2',
      name: 'رویداد ۲',
      weight: 1,
      order: 2,
      status: 'closed',
      indicators: [{ id: 'ind2', name: 'معیار', maxScore: 10, weight: 1, order: 1 }],
    };

    // team1: e1=10, e2=6 -> total 16 (won e1)
    // team2: e1=7, e2=9 -> total 16 (won e2)
    // Both have 1 win, so tied
    // team3: e1=6, e2=6 + adjustment 4 -> total 16 (won 0 events)
    const team3: BootcampTeam = { ...team1, id: 'team-3', name: 'تیم سوم' };

    const scores: Record<string, ScoreEntry> = {
      'j1|team-1|ind1': { judgeId: 'j1', teamId: 'team-1', eventId: 'e1', indicatorId: 'ind1', value: 10, updatedAt: '' },
      'j1|team-1|ind2': { judgeId: 'j1', teamId: 'team-1', eventId: 'e2', indicatorId: 'ind2', value: 6, updatedAt: '' },
      'j1|team-2|ind1': { judgeId: 'j1', teamId: 'team-2', eventId: 'e1', indicatorId: 'ind1', value: 7, updatedAt: '' },
      'j1|team-2|ind2': { judgeId: 'j1', teamId: 'team-2', eventId: 'e2', indicatorId: 'ind2', value: 9, updatedAt: '' },
      'j1|team-3|ind1': { judgeId: 'j1', teamId: 'team-3', eventId: 'e1', indicatorId: 'ind1', value: 6, updatedAt: '' },
      'j1|team-3|ind2': { judgeId: 'j1', teamId: 'team-3', eventId: 'e2', indicatorId: 'ind2', value: 6, updatedAt: '' },
    };

    const adjustments: ScoreAdjustment[] = [
      { id: 'a3', teamId: 'team-3', eventId: null, points: 4, reason: 'بونس', createdAt: '' },
    ];

    const state = createMockState({
      teams: [team1, team2, team3],
      events: [e1, e2],
      judges: [judge1],
      scores,
      adjustments,
      tieBreak: 'most_event_wins',
    });

    const standings = computeStandings(state);
    const s1 = standings.find((s) => s.teamId === 'team-1')!;
    const s2 = standings.find((s) => s.teamId === 'team-2')!;
    const s3 = standings.find((s) => s.teamId === 'team-3')!;

    expect(s1.grandTotal).toBe(16);
    expect(s2.grandTotal).toBe(16);
    expect(s3.grandTotal).toBe(16);

    // team1 and team2 each won 1 event -> rank 1
    expect(s1.rank).toBe(1);
    expect(s2.rank).toBe(1);
    // team3 won 0 events -> rank 3
    expect(s3.rank).toBe(3);
  });

  it('breaks ties using tieBreak: highest_last_event', () => {
    const e1: ScoringEvent = {
      id: 'e1',
      name: 'رویداد ۱',
      weight: 1,
      order: 1,
      status: 'active',
      indicators: [{ id: 'ind1', name: 'معیار', maxScore: 10, weight: 1, order: 1 }],
    };
    const e2: ScoringEvent = {
      id: 'e2',
      name: 'رویداد ۲ (پایانی)',
      weight: 1,
      order: 2,
      status: 'active',
      indicators: [{ id: 'ind2', name: 'معیار', maxScore: 10, weight: 1, order: 1 }],
    };

    // team1: e1=9, e2=7 -> 16
    // team2: e1=7, e2=9 -> 16. Last event e2 has team2 at 9 > team1 at 7
    const scores: Record<string, ScoreEntry> = {
      'j1|team-1|ind1': { judgeId: 'j1', teamId: 'team-1', eventId: 'e1', indicatorId: 'ind1', value: 9, updatedAt: '' },
      'j1|team-1|ind2': { judgeId: 'j1', teamId: 'team-1', eventId: 'e2', indicatorId: 'ind2', value: 7, updatedAt: '' },
      'j1|team-2|ind1': { judgeId: 'j1', teamId: 'team-2', eventId: 'e1', indicatorId: 'ind1', value: 7, updatedAt: '' },
      'j1|team-2|ind2': { judgeId: 'j1', teamId: 'team-2', eventId: 'e2', indicatorId: 'ind2', value: 9, updatedAt: '' },
    };

    const state = createMockState({
      teams: [team1, team2],
      events: [e1, e2],
      judges: [judge1],
      scores,
      tieBreak: 'highest_last_event',
    });

    const standings = computeStandings(state);
    expect(standings[0].teamId).toBe('team-2');
    expect(standings[0].rank).toBe(1);
    expect(standings[1].teamId).toBe('team-1');
    expect(standings[1].rank).toBe(2);
  });

  it('computes event winners for closed events', () => {
    const e1: ScoringEvent = {
      id: 'e1',
      name: 'مسابقه ۱',
      weight: 1,
      order: 1,
      status: 'closed',
      indicators: [{ id: 'ind1', name: 'معیار', maxScore: 10, weight: 1, order: 1 }],
    };
    const e2: ScoringEvent = {
      id: 'e2',
      name: 'مسابقه ۲ (باز)',
      weight: 1,
      order: 2,
      status: 'active',
      indicators: [{ id: 'ind1', name: 'معیار', maxScore: 10, weight: 1, order: 1 }],
    };

    const scores: Record<string, ScoreEntry> = {
      'j1|team-1|ind1': { judgeId: 'j1', teamId: 'team-1', eventId: 'e1', indicatorId: 'ind1', value: 6, updatedAt: '' },
      'j1|team-2|ind1': { judgeId: 'j1', teamId: 'team-2', eventId: 'e1', indicatorId: 'ind1', value: 9, updatedAt: '' },
    };

    const state = createMockState({
      teams: [team1, team2],
      events: [e1, e2],
      judges: [judge1],
      scores,
    });

    const winners = computeEventWinners(state);
    expect(winners['e1']?.teamId).toBe('team-2');
    expect(winners['e1']?.score).toBe(9);
    // e2 is active (not closed), so it should not appear in computeEventWinners
    expect(winners['e2']).toBeUndefined();
  });
});

describe('Reducer scoring actions and validations', () => {
  const team1: BootcampTeam = {
    id: 'team-1',
    name: 'تیم اول',
    color: 'from-amber-500 to-yellow-500',
    badgeBg: 'bg-amber-500/20 text-amber-400',
    borderColor: 'border-amber-500/40',
    textColor: 'text-amber-400',
    memberIds: [],
  };

  const judge1: Judge = { id: 'j1', name: 'داور ۱', accessCode: '1001', eventIds: [] };

  const event1: ScoringEvent = {
    id: 'e1',
    name: 'مسابقه ۱',
    weight: 1,
    order: 1,
    status: 'active',
    indicators: [{ id: 'ind1', name: 'معیار', maxScore: 10, weight: 1, order: 1 }],
  };

  it('validates SET_SCORE values correctly', async () => {
    const { appReducer } = await import('../store/reducer');
    const state = createMockState({
      teams: [team1],
      events: [event1],
      judges: [judge1],
      scores: {},
    });

    // Valid score
    const s1 = appReducer(state, {
      type: 'SET_SCORE',
      payload: {
        judgeId: 'j1',
        teamId: 'team-1',
        eventId: 'e1',
        indicatorId: 'ind1',
        value: 8,
        updatedAt: '2026-09-28T12:00:00.000Z',
        source: 'judge',
      },
    });
    expect(s1.scoring.scores['j1|team-1|ind1']?.value).toBe(8);

    // Negative score should be ignored
    const s2 = appReducer(s1, {
      type: 'SET_SCORE',
      payload: {
        judgeId: 'j1',
        teamId: 'team-1',
        eventId: 'e1',
        indicatorId: 'ind1',
        value: -2,
        updatedAt: '',
        source: 'judge',
      },
    });
    expect(s2.scoring.scores['j1|team-1|ind1']?.value).toBe(8);

    // Score exceeding maxScore (10) should be ignored
    const s3 = appReducer(s1, {
      type: 'SET_SCORE',
      payload: {
        judgeId: 'j1',
        teamId: 'team-1',
        eventId: 'e1',
        indicatorId: 'ind1',
        value: 12,
        updatedAt: '',
        source: 'judge',
      },
    });
    expect(s3.scoring.scores['j1|team-1|ind1']?.value).toBe(8);

    // Float / non-integer should be ignored
    const s4 = appReducer(s1, {
      type: 'SET_SCORE',
      payload: {
        judgeId: 'j1',
        teamId: 'team-1',
        eventId: 'e1',
        indicatorId: 'ind1',
        value: 7.5,
        updatedAt: '',
        source: 'judge',
      },
    });
    expect(s4.scoring.scores['j1|team-1|ind1']?.value).toBe(8);

    // Null is allowed (clear score)
    const s5 = appReducer(s1, {
      type: 'SET_SCORE',
      payload: {
        judgeId: 'j1',
        teamId: 'team-1',
        eventId: 'e1',
        indicatorId: 'ind1',
        value: null,
        updatedAt: '',
        source: 'judge',
      },
    });
    expect(s5.scoring.scores['j1|team-1|ind1']?.value).toBeNull();
  });

  it('prevents judge from scoring closed events but permits operator', async () => {
    const { appReducer } = await import('../store/reducer');
    const closedEvent: ScoringEvent = {
      ...event1,
      id: 'e-closed',
      status: 'closed',
    };

    const state = createMockState({
      teams: [team1],
      events: [closedEvent],
      judges: [judge1],
      scores: {},
    });

    // Judge tries to score closed event -> ignored
    const stateJudgeAttempt = appReducer(state, {
      type: 'SET_SCORE',
      payload: {
        judgeId: 'j1',
        teamId: 'team-1',
        eventId: 'e-closed',
        indicatorId: 'ind1',
        value: 9,
        updatedAt: '',
        source: 'judge',
      },
    });
    expect(stateJudgeAttempt.scoring.scores['j1|team-1|ind1']).toBeUndefined();

    // Operator scores closed event -> allowed
    const stateOpAttempt = appReducer(state, {
      type: 'SET_SCORE',
      payload: {
        judgeId: 'j1',
        teamId: 'team-1',
        eventId: 'e-closed',
        indicatorId: 'ind1',
        value: 9,
        updatedAt: '',
        source: 'operator',
      },
    });
    expect(stateOpAttempt.scoring.scores['j1|team-1|ind1']?.value).toBe(9);
  });

  it('handles SET_NOTE, ADD_ADJUSTMENT, REMOVE_ADJUSTMENT, SET_EVENT_STATUS and SET_SCORING_SETTINGS', async () => {
    const { appReducer } = await import('../store/reducer');
    const state = createMockState({
      teams: [team1],
      events: [event1],
      judges: [judge1],
      scores: {},
    });

    // SET_NOTE
    const s1 = appReducer(state, {
      type: 'SET_NOTE',
      payload: {
        judgeId: 'j1',
        teamId: 'team-1',
        eventId: 'e1',
        text: 'کار تیمی عالی',
        updatedAt: '2026-09-28T12:00:00Z',
      },
    });
    expect(s1.scoring.notes['j1|team-1|e1']?.text).toBe('کار تیمی عالی');

    // ADD_ADJUSTMENT
    const s2 = appReducer(s1, {
      type: 'ADD_ADJUSTMENT',
      payload: {
        id: 'adj-1',
        teamId: 'team-1',
        eventId: 'e1',
        points: 2,
        reason: 'خلاقیت ویژه',
        createdAt: '',
      },
    });
    expect(s2.scoring.adjustments).toHaveLength(1);
    expect(s2.scoring.adjustments[0].points).toBe(2);

    // REMOVE_ADJUSTMENT
    const s3 = appReducer(s2, {
      type: 'REMOVE_ADJUSTMENT',
      payload: { id: 'adj-1' },
    });
    expect(s3.scoring.adjustments).toHaveLength(0);

    // SET_EVENT_STATUS
    const s4 = appReducer(s3, {
      type: 'SET_EVENT_STATUS',
      payload: { eventId: 'e1', status: 'closed' },
    });
    expect(s4.scoring.events[0].status).toBe('closed');

    // SET_SCORING_SETTINGS
    const s5 = appReducer(s4, {
      type: 'SET_SCORING_SETTINGS',
      payload: { showJudgeNames: false, tieBreak: 'highest_last_event' },
    });
    expect(s5.scoring.settings.showJudgeNames).toBe(false);
    expect(s5.scoring.settings.tieBreak).toBe('highest_last_event');
  });

  it('computes rank trajectory with computeRankHistory across closed events', async () => {
    const { computeRankHistory } = await import('./compute');

    const e1: ScoringEvent = {
      id: 'e1',
      name: 'مسابقه ۱',
      weight: 1,
      order: 1,
      status: 'closed',
      indicators: [{ id: 'ind1', name: 'معیار', maxScore: 10, weight: 1, order: 1 }],
    };
    const e2: ScoringEvent = {
      id: 'e2',
      name: 'مسابقه ۲',
      weight: 1,
      order: 2,
      status: 'closed',
      indicators: [{ id: 'ind2', name: 'معیار ۲', maxScore: 10, weight: 1, order: 1 }],
    };

    const team2: BootcampTeam = {
      id: 'team-2',
      name: 'تیم دوم',
      color: '',
      badgeBg: '',
      borderColor: '',
      textColor: '',
      memberIds: [],
    };

    // Event 1: team1 wins (10 vs 5)
    // Event 2: team2 scores 10, team1 scores 0 -> total: team2 = (5 + 10)/2 = 7.5, team1 = (10 + 0)/2 = 5 -> team2 takes lead!
    const scores: Record<string, ScoreEntry> = {
      'j1|team-1|ind1': { judgeId: 'j1', teamId: 'team-1', eventId: 'e1', indicatorId: 'ind1', value: 10, updatedAt: '' },
      'j1|team-2|ind1': { judgeId: 'j1', teamId: 'team-2', eventId: 'e1', indicatorId: 'ind1', value: 5, updatedAt: '' },
      'j1|team-1|ind2': { judgeId: 'j1', teamId: 'team-1', eventId: 'e2', indicatorId: 'ind2', value: 0, updatedAt: '' },
      'j1|team-2|ind2': { judgeId: 'j1', teamId: 'team-2', eventId: 'e2', indicatorId: 'ind2', value: 10, updatedAt: '' },
    };

    const state = createMockState({
      teams: [team1, team2],
      events: [e1, e2],
      judges: [judge1],
      scores,
    });

    const { events, history } = computeRankHistory(state);
    expect(events).toHaveLength(2);

    const t1History = history.find((h) => h.teamId === 'team-1')!;
    const t2History = history.find((h) => h.teamId === 'team-2')!;

    // After Event 1
    expect(t1History.points[0].rank).toBe(1);
    expect(t2History.points[0].rank).toBe(2);

    // After Event 2: team2 jumped to rank 1
    expect(t1History.points[1].rank).toBe(2);
    expect(t2History.points[1].rank).toBe(1);
  });
});

