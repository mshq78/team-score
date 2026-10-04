import { AppState, INITIAL_STATE, INITIAL_SETTINGS, INITIAL_SCORING } from './state';
import { Participant, BootcampTeam, ScoringState, RunArchive, RunArchiveTeam } from '../types';

export const STORAGE_KEY_V3 = 'teamkeshi_state_v3';

const OLD_KEY_PARTICIPANTS = 'bootcamp_live_participants_v2';
const OLD_KEY_TEAMS = 'bootcamp_live_teams_v2';
const OLD_KEY_SETTINGS = 'bootcamp_live_settings_v2';

interface OldTeamFormat {
  id: string;
  name: string;
  color: string;
  badgeBg: string;
  borderColor: string;
  textColor: string;
  tableNumber?: string;
  leaderPhone?: string;
  members?: Array<Participant | string>;
  memberIds?: string[];
  score?: number;
}

export function sanitizeRuns(rawRuns: unknown): RunArchive[] {
  if (!Array.isArray(rawRuns)) return [];
  const valid: RunArchive[] = [];
  for (const item of rawRuns) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (
      typeof r.id === 'string' &&
      typeof r.name === 'string' &&
      typeof r.startedAt === 'string' &&
      typeof r.endedAt === 'string' &&
      Array.isArray(r.teams)
    ) {
      valid.push({
        id: r.id,
        name: r.name,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        eventNames: r.eventNames && typeof r.eventNames === 'object' ? (r.eventNames as Record<string, string>) : {},
        ...(typeof r.totalScale === 'number' ? { totalScale: r.totalScale } : {}),
        ...(r.eventScales && typeof r.eventScales === 'object' ? { eventScales: r.eventScales as Record<string, number> } : {}),
        judgesCount: typeof r.judgesCount === 'number' ? r.judgesCount : 0,
        teams: r.teams as RunArchiveTeam[],
      });
    }
  }
  return valid;
}

function sanitizeScoring(rawScoring?: Partial<ScoringState>): ScoringState {
  if (!rawScoring || typeof rawScoring !== 'object') {
    return INITIAL_SCORING;
  }
  return {
    runId: typeof rawScoring.runId === 'string' ? rawScoring.runId : 'run-1',
    runName: typeof rawScoring.runName === 'string' ? rawScoring.runName : '',
    runStartedAt: typeof rawScoring.runStartedAt === 'string' ? rawScoring.runStartedAt : '',
    events: Array.isArray(rawScoring.events) ? rawScoring.events : [],
    judges: Array.isArray(rawScoring.judges) ? rawScoring.judges : [],
    scores: rawScoring.scores && typeof rawScoring.scores === 'object' ? rawScoring.scores : {},
    notes: rawScoring.notes && typeof rawScoring.notes === 'object' ? rawScoring.notes : {},
    adjustments: Array.isArray(rawScoring.adjustments) ? rawScoring.adjustments : [],
    personCriteria: Array.isArray(rawScoring.personCriteria) ? rawScoring.personCriteria : [],
    personScores: rawScoring.personScores && typeof rawScoring.personScores === 'object' ? rawScoring.personScores : {},
    settings: {
      ...INITIAL_SCORING.settings,
      ...(rawScoring.settings || {}),
    },
  };
}

/**
 * Loads the application state from localStorage.
 * Automatically migrates older schema versions (v2 keys, v3 state) if present.
 * Guaranteed never to crash; falls back to INITIAL_STATE on corruption.
 */
export function loadState(storageKey: string = STORAGE_KEY_V3): AppState {
  try {
    // 1. Check if current state exists
    const v3Raw = localStorage.getItem(storageKey);
    if (v3Raw) {
      const parsed = JSON.parse(v3Raw);
      if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed.schemaVersion === 3 || parsed.schemaVersion === 4) &&
        Array.isArray(parsed.participants) &&
        Array.isArray(parsed.teams)
      ) {
        // Ensure teams have memberIds and no leaderPhone
        const sanitizedTeams: BootcampTeam[] = parsed.teams.map((t: OldTeamFormat) => {
          const { leaderPhone, members, ...cleanTeam } = t;
          void leaderPhone;
          void members;
          return {
            ...cleanTeam,
            memberIds: Array.isArray(t.memberIds)
              ? t.memberIds
              : Array.isArray(t.members)
              ? t.members.map((m) => (typeof m === 'string' ? m : m.id))
              : [],
          };
        });

        const state: AppState = {
          schemaVersion: 4,
          participants: parsed.participants,
          teams: sanitizedTeams,
          draftLog: Array.isArray(parsed.draftLog) ? parsed.draftLog : [],
          settings: parsed.settings || INITIAL_SETTINGS,
          scoring: sanitizeScoring(parsed.scoring),
          runs: sanitizeRuns(parsed.runs),
        };

        if (parsed.schemaVersion !== 4) {
          saveState(state, storageKey);
        }

        return state;
      }
    }

    // 2. Check for old v2 localStorage keys and migrate (operator data only)
    if (storageKey !== STORAGE_KEY_V3) return INITIAL_STATE;
    const oldParticipantsRaw = localStorage.getItem(OLD_KEY_PARTICIPANTS);
    const oldTeamsRaw = localStorage.getItem(OLD_KEY_TEAMS);
    const oldSettingsRaw = localStorage.getItem(OLD_KEY_SETTINGS);

    if (oldParticipantsRaw || oldTeamsRaw || oldSettingsRaw) {
      let participants: Participant[] = [];
      if (oldParticipantsRaw) {
        try {
          const parsedP = JSON.parse(oldParticipantsRaw);
          if (Array.isArray(parsedP)) {
            participants = parsedP;
          }
        } catch {
          // ignore parsing error
        }
      }

      let teams: BootcampTeam[] = INITIAL_STATE.teams;
      if (oldTeamsRaw) {
        try {
          const parsedTeams = JSON.parse(oldTeamsRaw) as OldTeamFormat[];
          if (Array.isArray(parsedTeams)) {
            const participantMap = new Map(participants.map((p) => [p.id, p]));

            teams = parsedTeams.map((oldTeam) => {
              const memberIds: string[] = [];

              if (Array.isArray(oldTeam.members)) {
                oldTeam.members.forEach((m, idx) => {
                  if (typeof m === 'string') {
                    memberIds.push(m);
                  } else if (m && typeof m === 'object' && m.id) {
                    memberIds.push(m.id);
                    // Ensure participant exists in participants list
                    if (!participantMap.has(m.id)) {
                      participants.push(m);
                      participantMap.set(m.id, m);
                    }
                    // Migration 4a: if old team had leaderPhone and leader has no phone, assign it
                    if (idx === 0 && oldTeam.leaderPhone) {
                      const leader = participantMap.get(m.id);
                      if (leader && !leader.phone) {
                        leader.phone = oldTeam.leaderPhone;
                      }
                    }
                  }
                });
              } else if (Array.isArray(oldTeam.memberIds)) {
                memberIds.push(...oldTeam.memberIds);
              }

              const { leaderPhone, members, ...rest } = oldTeam;
              void leaderPhone;
              void members;

              return {
                ...rest,
                memberIds,
              };
            });
          }
        } catch {
          // ignore parsing error
        }
      }

      let settings = INITIAL_SETTINGS;
      if (oldSettingsRaw) {
        try {
          const parsedS = JSON.parse(oldSettingsRaw);
          if (parsedS && typeof parsedS === 'object') {
            settings = { ...INITIAL_SETTINGS, ...parsedS };
          }
        } catch {
          // ignore parsing error
        }
      }

      const migratedState: AppState = {
        schemaVersion: 4,
        participants: participants.length > 0 ? participants : INITIAL_STATE.participants,
        teams,
        draftLog: [],
        settings,
        scoring: INITIAL_SCORING,
        runs: [],
      };

      // Save migrated state to new storage key
      saveState(migratedState);

      // Clean up legacy keys
      try {
        localStorage.removeItem(OLD_KEY_PARTICIPANTS);
        localStorage.removeItem(OLD_KEY_TEAMS);
        localStorage.removeItem(OLD_KEY_SETTINGS);
      } catch {
        // ignore
      }

      return migratedState;
    }
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
  }

  return INITIAL_STATE;
}

/**
 * Saves the application state to localStorage.
 */
export function saveState(state: AppState, storageKey: string = STORAGE_KEY_V3): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}
