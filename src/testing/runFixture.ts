import { AppState, INITIAL_SETTINGS, INITIAL_SCORING } from '../store/state';
import { appReducer } from '../store/reducer';
import { buildRunArchive } from '../scoring/archive';
import { ScoreEntry } from '../types';

export const RUN1_START = '2026-01-01T08:00:00.000Z';
export const RUN2_START = '2026-01-02T08:00:00.000Z';

export const scoreEntry = (teamId: string, value: number, updatedAt = '2026-01-01T10:00:00.000Z'): ScoreEntry => ({
  judgeId: 'j1', teamId, eventId: 'e1', indicatorId: 'i1', value, updatedAt,
});

/** A run in progress: two teams with members, one closed event, one judge, one score/note/adjustment, frozen leaderboard. */
export function runningState(withScores = true): AppState {
  const teams = ['a', 'b'].map((id, i) => ({
    id, name: `تیم ${id}`, color: '#123456', badgeBg: '', borderColor: '', textColor: '',
    memberIds: [`p${i + 1}`], score: 5,
  }));
  return {
    schemaVersion: 4,
    participants: [
      { id: 'p1', name: 'الف', phone: '09120000001', pickedAt: 111 },
      { id: 'p2', name: 'ب', pickedAt: 222 },
    ],
    teams,
    draftLog: [{ id: 'l1', timestamp: '10:00', participantName: 'الف', teamName: 'تیم a', teamColor: '#123456', isLeader: true }],
    settings: INITIAL_SETTINGS,
    runs: [],
    scoring: {
      ...INITIAL_SCORING,
      runId: 'run-1',
      runName: 'روز اول',
      runStartedAt: RUN1_START,
      events: [{
        id: 'e1', name: 'ناهار', weight: 1, order: 1, status: 'closed',
        indicators: [{ id: 'i1', name: 'طعم', maxScore: 10, weight: 1, order: 1 }],
      }],
      judges: [{ id: 'j1', name: 'داور', accessCode: '1111', eventIds: [] }],
      scores: withScores
        ? { 'j1|a|i1': scoreEntry('a', 3), 'j1|b|i1': scoreEntry('b', 9) }
        : {},
      notes: withScores
        ? { 'j1|a|e1': { judgeId: 'j1', teamId: 'a', eventId: 'e1', text: 'خوب', updatedAt: '2026-01-01T10:00:00.000Z' } }
        : {},
      adjustments: withScores
        ? [{ id: 'adj1', teamId: 'a', eventId: null, points: 2, reason: 'روحیه', createdAt: '2026-01-01T10:05:00.000Z' }]
        : [],
      settings: {
        ...INITIAL_SCORING.settings,
        leaderboardFrozen: true,
        frozenSnapshot: [
          { teamId: 'a', eventScores: {}, adjustmentsTotal: 0, grandTotal: 99, rank: 1, completionPercentage: 100 },
          { teamId: 'b', eventScores: {}, adjustmentsTotal: 0, grandTotal: 1, rank: 2, completionPercentage: 100 },
        ],
      },
    },
  };
}

/** What the operator's app does when «شروع اجرای جدید» is confirmed. */
export function startNewRun(state: AppState, opts: { clearParticipants: boolean; runId?: string; nowIso?: string }): AppState {
  const nowIso = opts.nowIso ?? RUN2_START;
  return appReducer(state, {
    type: 'START_NEW_RUN',
    payload: {
      newRunId: opts.runId ?? 'run-2',
      newRunName: 'روز دوم',
      nowIso,
      archive: buildRunArchive(state, nowIso),
      clearParticipants: opts.clearParticipants,
    },
  });
}
