import {
  Participant,
  BootcampTeam,
  AppSettings,
  ScoringEvent,
  ScoringIndicator,
  Judge,
  ScoreEntry,
  ScoreNote,
  ScoreAdjustment,
  ScoringSettings,
  TeamStanding,
  EventStatus,
  RunArchive,
} from '../types';
import { AppState } from './state';

export type AppAction =
  | {
      type: 'ASSIGN_TO_TEAM';
      payload: {
        participantId: string;
        teamId: string;
        logId: string;
        timestamp: string;
      };
    }
  | {
      type: 'REMOVE_MEMBER';
      payload: {
        teamId: string;
        participantId: string;
      };
    }
  | {
      type: 'RETURN_TO_HALL';
      payload: {
        participantId: string;
      };
    }
  | {
      type: 'PROMOTE_LEADER';
      payload: {
        teamId: string;
        participantId: string;
      };
    }
  | {
      type: 'AUTO_FILL';
      payload: {
        assignments: Array<{
          participantId: string;
          teamId: string;
        }>;
      };
    }
  | {
      type: 'UPDATE_TEAM';
      payload: {
        id: string;
        name?: string;
        color?: string;
        badgeBg?: string;
        borderColor?: string;
        textColor?: string;
        tableNumber?: string;
        score?: number;
      };
    }
  | {
      type: 'SET_TEAMS_COUNT';
      payload: {
        newCount: number;
        newTeams?: BootcampTeam[];
      };
    }
  | {
      type: 'RESET_DRAFT';
    }
  | {
      type: 'RESET_ALL';
      payload: {
        initialTeams: BootcampTeam[];
      };
    }
  | {
      type: 'ADD_PARTICIPANTS';
      payload: {
        participants: Participant[];
      };
    }
  | {
      type: 'REMOVE_PARTICIPANT';
      payload: {
        participantId: string;
      };
    }
  | {
      type: 'REPLACE_PARTICIPANTS';
      payload: {
        participants: Participant[];
      };
    }
  | {
      type: 'UPDATE_PARTICIPANT';
      payload: {
        id: string;
        name?: string;
        phone?: string;
      };
    }
  | {
      type: 'SET_SETTINGS';
      payload: Partial<AppSettings>;
    }
  | {
      type: 'IMPORT_BACKUP';
      payload: {
        state: AppState;
        /** Set when the state comes from the sync server or another tab, not from the user */
        fromSync?: boolean;
      };
    }
  | {
      type: 'ADD_SCORING_EVENT';
      payload: ScoringEvent;
    }
  | {
      type: 'UPDATE_SCORING_EVENT';
      payload: {
        id: string;
        name?: string;
        weight?: number;
        status?: EventStatus;
        awardTitle?: string;
      };
    }
  | {
      type: 'DELETE_SCORING_EVENT';
      payload: {
        eventId: string;
      };
    }
  | {
      type: 'REORDER_SCORING_EVENTS';
      payload: {
        eventId: string;
        direction: 'up' | 'down';
      };
    }
  | {
      type: 'SET_SCORING_EVENTS';
      payload: {
        events: ScoringEvent[];
      };
    }
  | {
      type: 'ADD_SCORING_INDICATOR';
      payload: {
        eventId: string;
        indicator: ScoringIndicator;
      };
    }
  | {
      type: 'UPDATE_SCORING_INDICATOR';
      payload: {
        eventId: string;
        indicatorId: string;
        name?: string;
        maxScore?: number;
        weight?: number;
      };
    }
  | {
      type: 'DELETE_SCORING_INDICATOR';
      payload: {
        eventId: string;
        indicatorId: string;
      };
    }
  | {
      type: 'REORDER_SCORING_INDICATORS';
      payload: {
        eventId: string;
        indicatorId: string;
        direction: 'up' | 'down';
      };
    }
  | {
      type: 'ADD_JUDGE';
      payload: Judge;
    }
  | {
      type: 'UPDATE_JUDGE';
      payload: {
        id: string;
        name?: string;
        accessCode?: string;
        eventIds?: string[];
      };
    }
  | {
      type: 'DELETE_JUDGE';
      payload: {
        judgeId: string;
      };
    }
  | {
      type: 'UPDATE_SCORING_SETTINGS';
      payload: Partial<ScoringSettings>;
    }
  | {
      type: 'FREEZE_LEADERBOARD';
      payload: {
        snapshot: TeamStanding[];
      };
    }
  | {
      type: 'UNFREEZE_LEADERBOARD';
    }
  | {
      type: 'SET_SCORE';
      payload: {
        judgeId: string;
        teamId: string;
        eventId: string;
        indicatorId: string;
        value: number | null;
        updatedAt: string;
        source: 'operator' | 'judge';
      };
    }
  | {
      type: 'SET_NOTE';
      payload: ScoreNote;
    }
  | {
      type: 'SET_SCORE_NOTE';
      payload: ScoreNote;
    }
  | {
      type: 'ADD_ADJUSTMENT';
      payload: ScoreAdjustment;
    }
  | {
      type: 'ADD_SCORE_ADJUSTMENT';
      payload: ScoreAdjustment;
    }
  | {
      type: 'REMOVE_ADJUSTMENT';
      payload:
        | {
            id: string;
          }
        | {
            adjustmentId: string;
          };
    }
  | {
      type: 'DELETE_SCORE_ADJUSTMENT';
      payload: {
        adjustmentId: string;
      };
    }
  | {
      type: 'SET_EVENT_STATUS';
      payload: {
        eventId: string;
        status: EventStatus;
      };
    }
  | {
      type: 'SET_SCORING_SETTINGS';
      payload: Partial<ScoringSettings>;
    }
  | {
      type: 'START_NEW_RUN';
      payload: {
        newRunId: string;
        newRunName: string;
        nowIso: string;
        archive: RunArchive;
        clearParticipants: boolean;
      };
    }
  | {
      type: 'DELETE_RUN_ARCHIVE';
      payload: {
        runId: string;
      };
    };

