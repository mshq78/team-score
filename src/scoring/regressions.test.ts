import { describe, it, expect } from 'vitest';
import { computeStandings, computeEventScore, getDisplayedStandings } from './compute';
import { appReducer } from '../store/reducer';
import { AppState, INITIAL_SETTINGS, INITIAL_SCORING } from '../store/state';
import { BootcampTeam, ScoringEvent } from '../types';

const team = (id: string): BootcampTeam => ({
  id,
  name: id,
  color: '#000',
  badgeBg: '',
  borderColor: '',
  textColor: '',
  memberIds: [],
});

const event: ScoringEvent = {
  id: 'e1',
  name: 'ناهار',
  weight: 1,
  order: 1,
  status: 'active',
  indicators: [{ id: 'i1', name: 'طعم', maxScore: 10, weight: 1, order: 1 }],
};

function baseState(): AppState {
  return {
    schemaVersion: 4,
    participants: [],
    teams: [team('a'), team('b')],
    draftLog: [],
    runs: [],
    settings: INITIAL_SETTINGS,
    scoring: {
      ...INITIAL_SCORING,
      events: [event],
      judges: [{ id: 'j1', name: 'داور', accessCode: '1234', eventIds: [] }],
    },
  };
}

function score(state: AppState, teamId: string, value: number, source: 'judge' | 'operator' = 'judge') {
  return appReducer(state, {
    type: 'SET_SCORE',
    payload: { judgeId: 'j1', teamId, eventId: 'e1', indicatorId: 'i1', value, updatedAt: '', source },
  });
}

describe('leaderboard freeze', () => {
  it('only affects the displayed leaderboard, never the real standings', () => {
    let state = score(score(baseState(), 'a', 8), 'b', 5);
    state = appReducer(state, { type: 'FREEZE_LEADERBOARD', payload: { snapshot: computeStandings(state) } });

    // After freezing, team b overtakes team a
    state = score(state, 'b', 10);

    expect(getDisplayedStandings(state)[0].teamId).toBe('a'); // stage stays frozen
    expect(computeStandings(state)[0].teamId).toBe('b'); // real result (used by the reveal)
  });
});

describe('SET_SCORE validation', () => {
  it('rejects unknown indicators, teams and judges', () => {
    const state = baseState();
    const bad = appReducer(state, {
      type: 'SET_SCORE',
      payload: { judgeId: 'j1', teamId: 'a', eventId: 'e1', indicatorId: 'nope', value: 5, updatedAt: '', source: 'operator' },
    });
    expect(bad).toBe(state);
    expect(score(state, 'ghost', 5)).toBe(state);
  });

  it('rejects out-of-range values and judge edits on closed events', () => {
    const state = baseState();
    expect(score(state, 'a', 11)).toBe(state);
    const closed = appReducer(state, { type: 'SET_EVENT_STATUS', payload: { eventId: 'e1', status: 'closed' } });
    expect(score(closed, 'a', 5, 'judge')).toBe(closed);
    expect(score(closed, 'a', 5, 'operator')).not.toBe(closed);
  });
});

describe('maxScore lowered after scoring', () => {
  it('clamps old scores so an event never exceeds its new maximum', () => {
    let state = score(baseState(), 'a', 10);
    state = appReducer(state, {
      type: 'UPDATE_SCORING_INDICATOR',
      payload: { eventId: 'e1', indicatorId: 'i1', maxScore: 5 },
    });
    expect(computeEventScore(state, 'e1', 'a')).toBe(5);
  });
});
