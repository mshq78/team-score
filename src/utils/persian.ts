import { BootcampTeam, Participant } from '../types';

export function toPersianDigits(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/[0-9]/g, (w) => persianDigits[parseInt(w, 10)]);
}

export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Calculates SMS parts according to standard Persian Unicode telecom standards:
 * - 1 part: up to 70 characters
 * - 2 parts: 71 to 134 characters (67 chars/part)
 * - 3 parts: 135 to 201 characters
 * - N parts: ceil(len / 67) for len > 70
 */
export function calculateSmsParts(text: string): { length: number; parts: number; isUnderOnePart: boolean } {
  const len = text.length;
  if (len === 0) return { length: 0, parts: 0, isUnderOnePart: true };
  if (len <= 70) return { length: len, parts: 1, isUnderOnePart: true };
  const parts = Math.ceil(len / 67);
  return { length: len, parts, isUnderOnePart: false };
}

/**
 * Generate ultra-compressed SMS for team leader
 */
export function generateTeamSms(
  team: BootcampTeam,
  members: Participant[],
  format: 'ultra_cheap' | 'compact' | 'standard' | 'result' = 'ultra_cheap',
  bootcampName = 'بوت‌کمپ',
  resultInfo?: { rank: number; totalTeams: number; grandTotal: number }
): string {
  const leader = members[0];
  const otherMembers = members.slice(1);
  const leaderName = leader ? leader.name : 'مشخص نشده';
  const membersList = otherMembers.map(m => m.name).join('، ');

  if (format === 'result') {
    const rankStr = resultInfo ? toPersianDigits(resultInfo.rank) : '—';
    const totalTeamsStr = resultInfo ? toPersianDigits(resultInfo.totalTeams) : '—';
    const scoreVal = resultInfo ? Math.round(resultInfo.grandTotal * 10) / 10 : (team.score ?? '—');
    const scoreStr = toPersianDigits(scoreVal);
    const isFirst = resultInfo?.rank === 1;
    const cheer = isFirst ? 'قهرمان مسابقات!' : 'تبریک!';
    return `تیم ${team.name} | رتبه ${rankStr} از ${totalTeamsStr} | امتیاز ${scoreStr} | ${cheer}`;
  }

  if (format === 'ultra_cheap') {
    // Ultra minimal single-line to save characters (< 70 chars for 1 SMS part)
    let msg = `${team.name}|لیدر:${leaderName}`;
    if (otherMembers.length > 0) {
      msg += `|اعضا:${membersList}`;
    }
    if (team.tableNumber) {
      msg += `|${team.tableNumber}`;
    }
    return msg;
  }

  if (format === 'compact') {
    // 2-3 lines clean compact
    let msg = `${bootcampName}: ${team.name}\nسرگروه: ${leaderName}`;
    if (otherMembers.length > 0) {
      msg += `\nاعضا: ${membersList}`;
    }
    if (team.tableNumber) {
      msg += `\nمحل: ${team.tableNumber}`;
    }
    return msg;
  }

  // Standard format
  let msg = `🏆 ${bootcampName}\nتیم: ${team.name}\n👑 سرگروه: ${leaderName}\n👥 اعضای تیم (${members.length} نفر):\n`;
  members.forEach((m, idx) => {
    msg += `${idx + 1}. ${m.name}${idx === 0 ? ' (سرگروه)' : ''}\n`;
  });
  if (team.tableNumber) {
    msg += `📍 ${team.tableNumber}\n`;
  }
  msg += `موفق و پیروز باشید!`;
  return msg;
}

/**
 * Generate batch export text for all teams
 */
export function generateAllTeamsSmsBatch(
  teams: BootcampTeam[],
  teamMembersMap: Map<string, Participant[]>,
  format: 'ultra_cheap' | 'compact' | 'standard' | 'result' = 'ultra_cheap',
  bootcampName = 'بوت‌کمپ',
  resultsMap?: Record<string, { rank: number; totalTeams: number; grandTotal: number }>
): string {
  return teams
    .map((t, idx) => {
      const members = teamMembersMap.get(t.id) || [];
      const leader = members[0];
      const resInfo = resultsMap ? resultsMap[t.id] : undefined;
      const sms = generateTeamSms(t, members, format, bootcampName, resInfo);
      const phone = leader?.phone || 'بدون شماره';
      return `[تیم ${idx + 1} - گیرنده: ${leader?.name || 'نامشخص'} - ${phone}]\n${sms}`;
    })
    .join('\n\n------------------------------\n\n');
}

export function exportToTextFile(content: string, filename = 'bootcamp-teams.txt'): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
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
