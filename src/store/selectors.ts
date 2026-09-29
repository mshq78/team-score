import { AppState } from './state';
import { Participant } from '../types';

/**
 * Returns full Participant objects for all members of a team in their exact order.
 */
export function getTeamMembers(state: AppState, teamId: string): Participant[] {
  const team = state.teams.find((t) => t.id === teamId);
  if (!team) return [];

  const map = new Map(state.participants.map((p) => [p.id, p]));
  const members: Participant[] = [];
  for (const id of team.memberIds) {
    const participant = map.get(id);
    if (participant) {
      members.push(participant);
    }
  }
  return members;
}

/**
 * Returns all participants who are not assigned to any team.
 */
export function getUnassignedParticipants(state: AppState): Participant[] {
  const assignedIds = new Set<string>();
  for (const team of state.teams) {
    for (const id of team.memberIds) {
      assignedIds.add(id);
    }
  }
  return state.participants.filter((p) => !assignedIds.has(p.id));
}

/**
 * Returns the leader of a team (first member), or undefined if empty.
 */
export function getTeamLeader(state: AppState, teamId: string): Participant | undefined {
  const members = getTeamMembers(state, teamId);
  return members[0];
}

/**
 * Map of team ID to its member Participant objects for fast rendering.
 */
export function getAllTeamMembersMap(state: AppState): Map<string, Participant[]> {
  const participantMap = new Map(state.participants.map((p) => [p.id, p]));
  const result = new Map<string, Participant[]>();

  for (const team of state.teams) {
    const list: Participant[] = [];
    for (const id of team.memberIds) {
      const p = participantMap.get(id);
      if (p) list.push(p);
    }
    result.set(team.id, list);
  }

  return result;
}
