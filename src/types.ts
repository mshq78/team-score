export type AppMode = 'simple' | 'advanced' | 'scoring' | 'stage';

export type DisplaySize = 'normal' | 'projector' | 'auditorium';

export type DisplayTheme = 'dark-neon' | 'bright-stage';

export interface AppSettings {
  mode: AppMode;
  displaySize: DisplaySize;
  displayTheme: DisplayTheme;
  soundEnabled: boolean;
}

export interface Participant {
  id: string;
  name: string;
  phone?: string;
  pickedAt?: number;
}

export interface BootcampTeam {
  id: string;
  name: string;
  color: string;
  badgeBg: string;
  borderColor: string;
  textColor: string;
  tableNumber?: string;
  memberIds: string[];
  score?: number;
}

export interface DraftLogItem {
  id: string;
  timestamp: string;
  participantName: string;
  teamName: string;
  teamColor: string;
  isLeader: boolean;
}

export interface SmsTemplateOption {
  id: 'ultra_cheap' | 'compact' | 'standard' | 'result';
  title: string;
  description: string;
  maxPartHint: string;
}

export type EventStatus = 'upcoming' | 'active' | 'closed';

export interface ScoringIndicator {
  id: string;
  name: string;
  maxScore: number;
  weight: number;
  order: number;
}

export interface ScoringEvent {
  id: string;
  name: string;
  weight: number;
  order: number;
  status: EventStatus;
  indicators: ScoringIndicator[];
  awardTitle?: string;
}

export interface Judge {
  id: string;
  name: string;
  accessCode: string;
  eventIds: string[];
}

export interface ScoreEntry {
  judgeId: string;
  teamId: string;
  eventId: string;
  indicatorId: string;
  value: number | null;
  updatedAt: string;
}

export interface ScoreNote {
  judgeId: string;
  teamId: string;
  eventId: string;
  text: string;
  updatedAt: string;
}

export interface ScoreAdjustment {
  id: string;
  teamId: string;
  eventId: string | null;
  points: number;
  reason: string;
  createdAt: string;
}

export interface TeamStanding {
  teamId: string;
  eventScores: Record<string, number | null>;
  adjustmentsTotal: number;
  grandTotal: number;
  rank: number;
  completionPercentage: number;
}

export interface ScoringSettings {
  leaderboardFrozen: boolean;
  frozenSnapshot: TeamStanding[] | null;
  showJudgeNames: boolean;
  tieBreak: 'most_event_wins' | 'highest_last_event' | 'manual';
  announceEventAwardsFirst?: boolean;
  /** Secret in the public results link; empty/absent = public link switched off */
  publicToken?: string;
}

export interface RunArchiveTeam {
  teamId: string;
  name: string;
  color: string;
  memberCount: number;
  grandTotal: number;
  rank: number;
  completionPercentage: number;
  eventScores: Record<string, number | null>;
}

export interface RunArchive {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string;
  eventNames: Record<string, string>;
  judgesCount: number;
  teams: RunArchiveTeam[];
  /** Display scales when the run ended (scores themselves are stored on 0–100); absent = 100 */
  totalScale?: number;
  eventScales?: Record<string, number>;
}

/** A criterion for judging individual people (e.g. اخلاق، مشارکت). Defined per event. */
export interface PersonCriterion {
  id: string;
  name: string;
  maxScore: number;
  order: number;
}

/** One judge's score for one participant on one criterion. Kept apart from team ranking. */
export interface PersonScoreEntry {
  judgeId: string;
  participantId: string;
  criterionId: string;
  value: number | null;
  updatedAt: string;
}

export interface ScoringState {
  runId?: string;
  runName?: string;
  runStartedAt?: string;
  events: ScoringEvent[];
  judges: Judge[];
  scores: Record<string, ScoreEntry>;
  notes: Record<string, ScoreNote>;
  adjustments: ScoreAdjustment[];
  settings: ScoringSettings;
  /** Individual evaluation (optional: older data has none) */
  personCriteria?: PersonCriterion[];
  personScores?: Record<string, PersonScoreEntry>;
}

