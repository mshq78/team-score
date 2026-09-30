import { AppState, INITIAL_SCORING } from '../store/state';
import { BootcampTeam, Participant, DraftLogItem, AppSettings, ScoringState, RunArchive } from '../types';
import { sanitizeRuns } from '../store/persistence';

/**
 * Generates formatted backup filename: teamkeshi-backup-YYYY-MM-DD-HHmm.json
 */
export function generateBackupFilename(d = new Date()): string {
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `teamkeshi-backup-${yyyy}-${MM}-${dd}-${HH}${mm}.json`;
}

/**
 * Downloads the full AppState as a formatted JSON file.
 */
export function downloadBackupJson(state: AppState, filename: string = generateBackupFilename()): void {
  const jsonString = JSON.stringify(state, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

interface RawTeamData {
  id?: unknown;
  name?: unknown;
  color?: unknown;
  badgeBg?: unknown;
  borderColor?: unknown;
  textColor?: unknown;
  tableNumber?: unknown;
  score?: unknown;
  members?: unknown;
  memberIds?: unknown;
}

/**
 * Validates the structure and schema of an imported backup JSON object.
 * Returns the sanitized AppState if valid, or null if corrupt or incompatible.
 * Strictly avoids 'any'.
 */
export function validateAndSanitizeBackup(parsed: unknown): AppState | null {
  if (!parsed || typeof parsed !== 'object') return null;

  const record = parsed as Record<string, unknown>;

  if (typeof record.schemaVersion !== 'number') return null;
  if (!Array.isArray(record.participants)) return null;
  if (!Array.isArray(record.teams)) return null;

  // Validate participants
  const participants: Participant[] = [];
  for (const item of record.participants) {
    if (!item || typeof item !== 'object') return null;
    const p = item as Record<string, unknown>;
    if (typeof p.id !== 'string' || typeof p.name !== 'string') return null;
    participants.push({
      id: p.id,
      name: p.name,
      phone: typeof p.phone === 'string' ? p.phone : undefined,
      pickedAt: typeof p.pickedAt === 'number' ? p.pickedAt : undefined,
    });
  }

  // Validate teams shape
  const teams: BootcampTeam[] = [];
  for (const item of record.teams) {
    if (!item || typeof item !== 'object') return null;
    const raw = item as RawTeamData;
    if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null;

    const memberIds: string[] = [];
    if (Array.isArray(raw.memberIds)) {
      for (const mId of raw.memberIds) {
        if (typeof mId === 'string') memberIds.push(mId);
      }
    } else if (Array.isArray(raw.members)) {
      for (const m of raw.members) {
        if (typeof m === 'string') {
          memberIds.push(m);
        } else if (m && typeof m === 'object' && 'id' in m) {
          const mObj = m as { id: unknown };
          if (typeof mObj.id === 'string') memberIds.push(mObj.id);
        }
      }
    }

    teams.push({
      id: raw.id,
      name: raw.name,
      color: typeof raw.color === 'string' ? raw.color : '#06b6d4',
      badgeBg: typeof raw.badgeBg === 'string' ? raw.badgeBg : 'bg-cyan-500 text-slate-950 font-black',
      borderColor: typeof raw.borderColor === 'string' ? raw.borderColor : 'border-cyan-400',
      textColor: typeof raw.textColor === 'string' ? raw.textColor : 'text-cyan-400',
      tableNumber: typeof raw.tableNumber === 'string' ? raw.tableNumber : undefined,
      score: typeof raw.score === 'number' ? raw.score : 0,
      memberIds,
    });
  }

  const draftLog: DraftLogItem[] = Array.isArray(record.draftLog)
    ? (record.draftLog as DraftLogItem[])
    : [];

  const rawSettings = (record.settings && typeof record.settings === 'object'
    ? record.settings
    : {}) as Record<string, unknown>;

  const settings: AppSettings = {
    mode:
      rawSettings.mode === 'advanced'
        ? 'advanced'
        : rawSettings.mode === 'scoring'
        ? 'scoring'
        : rawSettings.mode === 'stage'
        ? 'stage'
        : 'simple',
    displaySize:
      rawSettings.displaySize === 'projector'
        ? 'projector'
        : rawSettings.displaySize === 'auditorium'
        ? 'auditorium'
        : 'normal',
    displayTheme: rawSettings.displayTheme === 'bright-stage' ? 'bright-stage' : 'dark-neon',
    soundEnabled: typeof rawSettings.soundEnabled === 'boolean' ? rawSettings.soundEnabled : true,
  };

  const rawScoring = (record.scoring && typeof record.scoring === 'object'
    ? record.scoring
    : {}) as Partial<ScoringState>;

  const scoring: ScoringState = {
    runId: typeof rawScoring.runId === 'string' ? rawScoring.runId : 'run-1',
    runName: typeof rawScoring.runName === 'string' ? rawScoring.runName : '',
    runStartedAt: typeof rawScoring.runStartedAt === 'string' ? rawScoring.runStartedAt : '',
    events: Array.isArray(rawScoring.events) ? rawScoring.events : [],
    judges: Array.isArray(rawScoring.judges) ? rawScoring.judges : [],
    scores: rawScoring.scores && typeof rawScoring.scores === 'object' ? rawScoring.scores : {},
    notes: rawScoring.notes && typeof rawScoring.notes === 'object' ? rawScoring.notes : {},
    adjustments: Array.isArray(rawScoring.adjustments) ? rawScoring.adjustments : [],
    settings: {
      ...INITIAL_SCORING.settings,
      ...(rawScoring.settings || {}),
    },
  };

  const runs: RunArchive[] = sanitizeRuns(record.runs);

  return {
    schemaVersion: 4,
    participants,
    teams,
    draftLog,
    settings,
    scoring,
    runs,
  };
}
