import type { AppState } from './state';
import type { AppAction } from './actions';

/**
 * Pure reducer function for all AppState mutations.
 * Must have no side effects (no sounds, toasts, confetti).
 * Must not invoke Date.now() or Math.random().
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ASSIGN_TO_TEAM': {
      const { participantId, teamId, logId, timestamp } = action.payload;
      const participant = state.participants.find((p) => p.id === participantId);
      const targetTeam = state.teams.find((t) => t.id === teamId);
      if (!participant || !targetTeam) return state;

      // Already in target team
      if (targetTeam.memberIds.includes(participantId)) return state;

      const isLeader = targetTeam.memberIds.length === 0;

      // Remove from any team, add to target team
      const newTeams = state.teams.map((t) => {
        const filtered = t.memberIds.filter((id) => id !== participantId);
        if (t.id === teamId) {
          return {
            ...t,
            memberIds: [...filtered, participantId],
          };
        }
        return {
          ...t,
          memberIds: filtered,
        };
      });

      const newLogItem = {
        id: logId,
        timestamp,
        participantName: participant.name,
        teamName: targetTeam.name,
        teamColor: targetTeam.color,
        isLeader,
      };

      return {
        ...state,
        teams: newTeams,
        draftLog: [newLogItem, ...state.draftLog],
      };
    }

    case 'REMOVE_MEMBER': {
      const { teamId, participantId } = action.payload;
      return {
        ...state,
        teams: state.teams.map((t) => {
          if (t.id === teamId) {
            return {
              ...t,
              memberIds: t.memberIds.filter((id) => id !== participantId),
            };
          }
          return t;
        }),
      };
    }

    case 'RETURN_TO_HALL': {
      const { participantId } = action.payload;
      return {
        ...state,
        teams: state.teams.map((t) => ({
          ...t,
          memberIds: t.memberIds.filter((id) => id !== participantId),
        })),
      };
    }

    case 'PROMOTE_LEADER': {
      const { teamId, participantId } = action.payload;
      return {
        ...state,
        teams: state.teams.map((t) => {
          if (t.id === teamId) {
            const idx = t.memberIds.indexOf(participantId);
            if (idx <= 0) return t;
            const remaining = t.memberIds.filter((id) => id !== participantId);
            return {
              ...t,
              memberIds: [participantId, ...remaining],
            };
          }
          return t;
        }),
      };
    }

    case 'AUTO_FILL': {
      const { assignments } = action.payload;
      if (!assignments || assignments.length === 0) return state;

      const newTeams = state.teams.map((t) => ({
        ...t,
        memberIds: [...t.memberIds],
      }));

      for (const { participantId, teamId } of assignments) {
        // Remove from all teams
        for (const team of newTeams) {
          team.memberIds = team.memberIds.filter((id) => id !== participantId);
        }
        // Add to target team
        const target = newTeams.find((t) => t.id === teamId);
        if (target && !target.memberIds.includes(participantId)) {
          target.memberIds.push(participantId);
        }
      }

      return {
        ...state,
        teams: newTeams,
      };
    }

    case 'UPDATE_TEAM': {
      const { id, ...updates } = action.payload;
      return {
        ...state,
        teams: state.teams.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      };
    }

    case 'SET_TEAMS_COUNT': {
      const { newCount, newTeams } = action.payload;
      if (newCount < 2 || newCount > 8) return state;

      if (newCount < state.teams.length) {
        const removedTeams = state.teams.slice(newCount);
        const removedTeamIds = new Set(removedTeams.map((t) => t.id));

        // Delete that team's scores, notes and adjustments
        const newScores = { ...state.scoring.scores };
        for (const key of Object.keys(newScores)) {
          const parts = key.split('|');
          if (parts.length >= 2 && removedTeamIds.has(parts[1])) {
            delete newScores[key];
          }
        }

        const newNotes = { ...state.scoring.notes };
        for (const key of Object.keys(newNotes)) {
          const parts = key.split('|');
          if (parts.length >= 2 && removedTeamIds.has(parts[1])) {
            delete newNotes[key];
          }
        }

        const newAdjustments = state.scoring.adjustments.filter(
          (a) => !removedTeamIds.has(a.teamId)
        );

        return {
          ...state,
          teams: state.teams.slice(0, newCount),
          scoring: {
            ...state.scoring,
            scores: newScores,
            notes: newNotes,
            adjustments: newAdjustments,
          },
        };
      } else if (newCount > state.teams.length && newTeams) {
        return {
          ...state,
          teams: [...state.teams, ...newTeams],
        };
      }
      return state;
    }

    case 'RESET_DRAFT': {
      return {
        ...state,
        teams: state.teams.map((t) => ({ ...t, memberIds: [] })),
        draftLog: [],
      };
    }

    case 'RESET_ALL': {
      return {
        ...state,
        participants: [],
        teams: action.payload.initialTeams,
        draftLog: [],
      };
    }

    case 'ADD_PARTICIPANTS': {
      return {
        ...state,
        participants: [...state.participants, ...action.payload.participants],
      };
    }

    case 'REMOVE_PARTICIPANT': {
      const { participantId } = action.payload;
      const personScores = Object.fromEntries(
        Object.entries(state.scoring.personScores ?? {}).filter(([, e]) => e.participantId !== participantId)
      );
      return {
        ...state,
        participants: state.participants.filter((p) => p.id !== participantId),
        teams: state.teams.map((t) => ({
          ...t,
          memberIds: t.memberIds.filter((id) => id !== participantId),
        })),
        scoring: { ...state.scoring, personScores },
      };
    }

    case 'REPLACE_PARTICIPANTS': {
      const newParticipants = action.payload.participants;
      const validIds = new Set(newParticipants.map((p) => p.id));
      return {
        ...state,
        participants: newParticipants,
        teams: state.teams.map((t) => ({
          ...t,
          memberIds: t.memberIds.filter((id) => validIds.has(id)),
        })),
      };
    }

    case 'UPDATE_PARTICIPANT': {
      const { id, name, phone } = action.payload;
      return {
        ...state,
        participants: state.participants.map((p) => {
          if (p.id === id) {
            return {
              ...p,
              ...(name !== undefined ? { name } : {}),
              ...(phone !== undefined ? { phone } : {}),
            };
          }
          return p;
        }),
      };
    }

    case 'SET_SETTINGS': {
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload,
        },
      };
    }

    case 'IMPORT_BACKUP': {
      return action.payload.state;
    }

    case 'ADD_SCORING_EVENT': {
      return {
        ...state,
        scoring: {
          ...state.scoring,
          events: [...state.scoring.events, action.payload],
        },
      };
    }

    case 'UPDATE_SCORING_EVENT': {
      const { id, ...updates } = action.payload;
      return {
        ...state,
        scoring: {
          ...state.scoring,
          events: state.scoring.events.map((ev) => (ev.id === id ? { ...ev, ...updates } : ev)),
        },
      };
    }

    case 'DELETE_SCORING_EVENT': {
      const { eventId } = action.payload;
      const targetEvent = state.scoring.events.find((e) => e.id === eventId);
      const indicatorIds = new Set(targetEvent?.indicators.map((i) => i.id) || []);

      // Remove scores for this event's indicators
      const newScores = { ...state.scoring.scores };
      for (const [key, entry] of Object.entries(newScores)) {
        if (entry.eventId === eventId || indicatorIds.has(entry.indicatorId)) {
          delete newScores[key];
        }
      }

      // Remove notes for this event
      const newNotes = { ...state.scoring.notes };
      for (const [key, note] of Object.entries(newNotes)) {
        if (note.eventId === eventId) {
          delete newNotes[key];
        }
      }

      // Remove adjustments for this event
      const newAdjustments = state.scoring.adjustments.filter((a) => a.eventId !== eventId);

      // Remove eventId from judges
      const newJudges = state.scoring.judges.map((j) => ({
        ...j,
        eventIds: j.eventIds.filter((id) => id !== eventId),
      }));

      return {
        ...state,
        scoring: {
          ...state.scoring,
          events: state.scoring.events.filter((e) => e.id !== eventId),
          scores: newScores,
          notes: newNotes,
          adjustments: newAdjustments,
          judges: newJudges,
        },
      };
    }

    case 'REORDER_SCORING_EVENTS': {
      const { eventId, direction } = action.payload;
      const events = [...state.scoring.events];
      const index = events.findIndex((e) => e.id === eventId);
      if (index === -1) return state;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= events.length) return state;

      // Swap
      const temp = events[index];
      events[index] = events[targetIndex];
      events[targetIndex] = temp;

      // Update order numbers
      const updatedEvents = events.map((ev, idx) => ({
        ...ev,
        order: idx + 1,
      }));

      return {
        ...state,
        scoring: {
          ...state.scoring,
          events: updatedEvents,
        },
      };
    }

    case 'SET_SCORING_EVENTS': {
      return {
        ...state,
        scoring: {
          ...state.scoring,
          events: action.payload.events,
        },
      };
    }

    case 'ADD_SCORING_INDICATOR': {
      const { eventId, indicator } = action.payload;
      return {
        ...state,
        scoring: {
          ...state.scoring,
          events: state.scoring.events.map((ev) => {
            if (ev.id !== eventId) return ev;
            return {
              ...ev,
              indicators: [...ev.indicators, indicator],
            };
          }),
        },
      };
    }

    case 'UPDATE_SCORING_INDICATOR': {
      const { eventId, indicatorId, ...updates } = action.payload;
      return {
        ...state,
        scoring: {
          ...state.scoring,
          events: state.scoring.events.map((ev) => {
            if (ev.id !== eventId) return ev;
            return {
              ...ev,
              indicators: ev.indicators.map((ind) =>
                ind.id === indicatorId ? { ...ind, ...updates } : ind
              ),
            };
          }),
        },
      };
    }

    case 'DELETE_SCORING_INDICATOR': {
      const { eventId, indicatorId } = action.payload;
      const newScores = { ...state.scoring.scores };
      for (const [key, entry] of Object.entries(newScores)) {
        if (entry.indicatorId === indicatorId) {
          delete newScores[key];
        }
      }

      return {
        ...state,
        scoring: {
          ...state.scoring,
          events: state.scoring.events.map((ev) => {
            if (ev.id !== eventId) return ev;
            return {
              ...ev,
              indicators: ev.indicators.filter((ind) => ind.id !== indicatorId),
            };
          }),
          scores: newScores,
        },
      };
    }

    case 'REORDER_SCORING_INDICATORS': {
      const { eventId, indicatorId, direction } = action.payload;
      return {
        ...state,
        scoring: {
          ...state.scoring,
          events: state.scoring.events.map((ev) => {
            if (ev.id !== eventId) return ev;
            const indicators = [...ev.indicators];
            const index = indicators.findIndex((i) => i.id === indicatorId);
            if (index === -1) return ev;
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= indicators.length) return ev;

            const temp = indicators[index];
            indicators[index] = indicators[targetIndex];
            indicators[targetIndex] = temp;

            return {
              ...ev,
              indicators: indicators.map((ind, idx) => ({ ...ind, order: idx + 1 })),
            };
          }),
        },
      };
    }

    case 'ADD_JUDGE': {
      return {
        ...state,
        scoring: {
          ...state.scoring,
          judges: [...state.scoring.judges, action.payload],
        },
      };
    }

    case 'UPDATE_JUDGE': {
      const { id, ...updates } = action.payload;
      return {
        ...state,
        scoring: {
          ...state.scoring,
          judges: state.scoring.judges.map((j) => (j.id === id ? { ...j, ...updates } : j)),
        },
      };
    }

    case 'DELETE_JUDGE': {
      const { judgeId } = action.payload;
      const newScores = { ...state.scoring.scores };
      for (const [key, entry] of Object.entries(newScores)) {
        if (entry.judgeId === judgeId) {
          delete newScores[key];
        }
      }

      const newNotes = { ...state.scoring.notes };
      for (const [key, note] of Object.entries(newNotes)) {
        if (note.judgeId === judgeId) {
          delete newNotes[key];
        }
      }

      return {
        ...state,
        scoring: {
          ...state.scoring,
          judges: state.scoring.judges.filter((j) => j.id !== judgeId),
          scores: newScores,
          notes: newNotes,
          personScores: Object.fromEntries(
            Object.entries(state.scoring.personScores ?? {}).filter(([, e]) => e.judgeId !== judgeId)
          ),
        },
      };
    }

    case 'SET_EVENT_STATUS': {
      const { eventId, status } = action.payload;
      return {
        ...state,
        scoring: {
          ...state.scoring,
          events: state.scoring.events.map((e) =>
            e.id === eventId ? { ...e, status } : e
          ),
        },
      };
    }

    case 'SET_SCORING_SETTINGS':
    case 'UPDATE_SCORING_SETTINGS': {
      return {
        ...state,
        scoring: {
          ...state.scoring,
          settings: {
            ...state.scoring.settings,
            ...action.payload,
          },
        },
      };
    }

    case 'FREEZE_LEADERBOARD': {
      return {
        ...state,
        scoring: {
          ...state.scoring,
          settings: {
            ...state.scoring.settings,
            leaderboardFrozen: true,
            frozenSnapshot: action.payload.snapshot,
          },
        },
      };
    }

    case 'UNFREEZE_LEADERBOARD': {
      return {
        ...state,
        scoring: {
          ...state.scoring,
          settings: {
            ...state.scoring.settings,
            leaderboardFrozen: false,
            frozenSnapshot: null,
          },
        },
      };
    }

    case 'SET_SCORE': {
      const { judgeId, teamId, eventId, indicatorId, value, updatedAt, source } = action.payload;

      // Rule: Scores for an event whose status is 'closed' may only be changed with source 'operator'
      const targetEvent = state.scoring.events.find((e) => e.id === eventId);
      if (targetEvent && targetEvent.status === 'closed' && source !== 'operator') {
        return state;
      }

      // The indicator must exist and belong to this event; the team and judge must exist
      const indicator = targetEvent?.indicators.find((ind) => ind.id === indicatorId);
      if (
        !indicator ||
        !state.teams.some((t) => t.id === teamId) ||
        !state.scoring.judges.some((j) => j.id === judgeId)
      ) {
        return state;
      }

      // Validate in the reducer: value must be an integer from 0 to that indicator's maxScore, or null.
      // Ignore invalid values.
      if (value !== null) {
        if (typeof value !== 'number' || isNaN(value) || !Number.isInteger(value)) {
          return state;
        }
        if (value < 0 || value > indicator.maxScore) {
          return state;
        }
      }

      const key = `${judgeId}|${teamId}|${indicatorId}`;
      return {
        ...state,
        scoring: {
          ...state.scoring,
          scores: {
            ...state.scoring.scores,
            [key]: {
              judgeId,
              teamId,
              eventId,
              indicatorId,
              value,
              updatedAt,
            },
          },
        },
      };
    }

    case 'SET_NOTE':
    case 'SET_SCORE_NOTE': {
      const { judgeId, teamId, eventId, text, updatedAt } = action.payload;
      const key = `${judgeId}|${teamId}|${eventId}`;
      return {
        ...state,
        scoring: {
          ...state.scoring,
          notes: {
            ...state.scoring.notes,
            [key]: {
              judgeId,
              teamId,
              eventId,
              text,
              updatedAt,
            },
          },
        },
      };
    }

    case 'ADD_ADJUSTMENT':
    case 'ADD_SCORE_ADJUSTMENT': {
      return {
        ...state,
        scoring: {
          ...state.scoring,
          adjustments: [...state.scoring.adjustments, action.payload],
        },
      };
    }

    case 'REMOVE_ADJUSTMENT':
    case 'DELETE_SCORE_ADJUSTMENT': {
      const targetId =
        'adjustmentId' in action.payload
          ? action.payload.adjustmentId
          : 'id' in action.payload
          ? action.payload.id
          : '';

      return {
        ...state,
        scoring: {
          ...state.scoring,
          adjustments: state.scoring.adjustments.filter((a) => a.id !== targetId),
        },
      };
    }

    case 'ADD_PERSON_CRITERION': {
      const c = action.payload;
      const list = state.scoring.personCriteria ?? [];
      if (!c.name.trim() || list.some((x) => x.id === c.id)) return state;
      if (!Number.isInteger(c.maxScore) || c.maxScore < 1 || c.maxScore > 100) return state;
      return { ...state, scoring: { ...state.scoring, personCriteria: [...list, { ...c, name: c.name.trim(), order: list.length + 1 }] } };
    }

    case 'UPDATE_PERSON_CRITERION': {
      const { id, name, maxScore } = action.payload;
      const list = state.scoring.personCriteria ?? [];
      if (maxScore !== undefined && (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 100)) return state;
      const scores = { ...(state.scoring.personScores ?? {}) };
      if (maxScore !== undefined) {
        // scores above the new maximum no longer make sense
        for (const [k, e] of Object.entries(scores)) {
          if (e.criterionId === id && e.value !== null && e.value > maxScore) delete scores[k];
        }
      }
      return {
        ...state,
        scoring: {
          ...state.scoring,
          personCriteria: list.map((c) =>
            c.id === id ? { ...c, ...(name !== undefined && name.trim() ? { name: name.trim() } : {}), ...(maxScore !== undefined ? { maxScore } : {}) } : c
          ),
          personScores: scores,
        },
      };
    }

    case 'DELETE_PERSON_CRITERION': {
      const { id } = action.payload;
      const scores = { ...(state.scoring.personScores ?? {}) };
      for (const [k, e] of Object.entries(scores)) if (e.criterionId === id) delete scores[k];
      return {
        ...state,
        scoring: {
          ...state.scoring,
          personCriteria: (state.scoring.personCriteria ?? []).filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i + 1 })),
          personScores: scores,
        },
      };
    }

    case 'SET_PERSON_SCORE': {
      const { judgeId, participantId, criterionId, value, updatedAt } = action.payload;
      const criterion = (state.scoring.personCriteria ?? []).find((c) => c.id === criterionId);
      if (
        !criterion ||
        !state.participants.some((p) => p.id === participantId) ||
        !state.scoring.judges.some((j) => j.id === judgeId)
      ) {
        return state;
      }
      if (value !== null) {
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > criterion.maxScore) return state;
      }
      return {
        ...state,
        scoring: {
          ...state.scoring,
          personScores: {
            ...(state.scoring.personScores ?? {}),
            [`${judgeId}|${participantId}|${criterionId}`]: { judgeId, participantId, criterionId, value, updatedAt },
          },
        },
      };
    }

    case 'START_NEW_RUN': {
      const { newRunId, newRunName, nowIso, archive, clearParticipants } = action.payload;

      // runs capped at newest 60
      const updatedRuns = [archive, ...state.runs].slice(0, 60);

      // participants: clear or strip pickedAt
      const updatedParticipants = clearParticipants
        ? []
        : state.participants.map(({ pickedAt, ...rest }) => rest);

      // every team memberIds = [] and score = 0
      const updatedTeams = state.teams.map((t) => ({
        ...t,
        memberIds: [],
        score: 0,
      }));

      // every event status = 'upcoming'
      const updatedEvents = state.scoring.events.map((e) => ({
        ...e,
        status: 'upcoming' as const,
      }));

      return {
        ...state,
        participants: updatedParticipants,
        teams: updatedTeams,
        draftLog: [],
        runs: updatedRuns,
        scoring: {
          ...state.scoring,
          runId: newRunId,
          runName: newRunName,
          runStartedAt: nowIso,
          events: updatedEvents,
          scores: {},
          notes: {},
          adjustments: [],
          personScores: {},
          settings: {
            ...state.scoring.settings,
            leaderboardFrozen: false,
            frozenSnapshot: null,
          },
        },
      };
    }

    case 'DELETE_RUN_ARCHIVE': {
      return {
        ...state,
        runs: state.runs.filter((r) => r.id !== action.payload.runId),
      };
    }

    default:
      return state;
  }
}
