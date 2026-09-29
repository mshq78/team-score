import { Participant, BootcampTeam, DraftLogItem, AppSettings, ScoringState, RunArchive } from '../types';
import { SAMPLE_BOOTCAMP_PARTICIPANTS, createInitialBootcampTeams } from '../utils/defaultData';

export interface AppState {
  schemaVersion: number;
  participants: Participant[];
  teams: BootcampTeam[];
  draftLog: DraftLogItem[];
  settings: AppSettings;
  scoring: ScoringState;
  runs: RunArchive[];
}

export const INITIAL_SETTINGS: AppSettings = {
  mode: 'simple',
  displaySize: 'normal',
  displayTheme: 'dark-neon',
  soundEnabled: true,
};

export const INITIAL_SCORING: ScoringState = {
  runId: 'run-1',
  runName: '',
  runStartedAt: '',
  events: [],
  judges: [],
  scores: {},
  notes: {},
  adjustments: [],
  settings: {
    leaderboardFrozen: false,
    frozenSnapshot: null,
    showJudgeNames: true,
    tieBreak: 'most_event_wins',
  },
};

export const INITIAL_STATE: AppState = {
  schemaVersion: 4,
  participants: SAMPLE_BOOTCAMP_PARTICIPANTS,
  teams: createInitialBootcampTeams(4),
  draftLog: [],
  settings: INITIAL_SETTINGS,
  scoring: INITIAL_SCORING,
  runs: [],
};

