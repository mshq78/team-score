import React, { useState } from 'react';
import { 
  Crown, 
  ArrowUp, 
  Dice5, 
  Edit2, 
  Check, 
  UserMinus,
  MessageSquare,
  GripVertical
} from 'lucide-react';
import { BootcampTeam, DisplaySize, Participant } from '../types';
import { toPersianDigits } from '../utils/persian';
import { sound } from '../utils/sound';
import { BOOTCAMP_TEAM_NAMES } from '../utils/defaultData';

interface TeamCardProps {
  team: BootcampTeam;
  teamIndex: number;
  displaySize: DisplaySize;
  members: Participant[];
  allTeams?: BootcampTeam[];
  isActiveTurn?: boolean;
  onUpdateTeam: (team: BootcampTeam) => void;
  onRemoveMember: (teamId: string, participantId: string) => void;
  onPromoteToLeader: (teamId: string, participantId: string) => void;
  onDropParticipant: (participantId: string, teamId: string) => void;
  onOpenSmsForTeam?: (team: BootcampTeam) => void;
  onUpdateParticipantPhone?: (participantId: string, phone: string) => void;
  onSelectParticipant?: (participant: Participant, team?: BootcampTeam, isLeader?: boolean) => void;
}

export const TeamCard: React.FC<TeamCardProps> = ({
  team,
  teamIndex,
  displaySize,
  members,
  allTeams,
  isActiveTurn = false,
  onUpdateTeam,
  onRemoveMember,
  onPromoteToLeader,
  onDropParticipant,
  onOpenSmsForTeam,
  onUpdateParticipantPhone,
  onSelectParticipant,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(team.name);

  const leader = members[0];
  const regularMembers = members.slice(1);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const participantId = e.dataTransfer.getData('text/plain');
    if (participantId) {
      sound.playFanfare();
      onDropParticipant(participantId, team.id);
    }
  };

  const saveName = () => {
    if (editedName.trim()) {
      onUpdateTeam({ ...team, name: editedName.trim() });
    }
    setIsEditingName(false);
  };

  const rollRandomName = () => {
    sound.playPop();
    const available = BOOTCAMP_TEAM_NAMES.filter((n) => n !== team.name);
    const randomPick = available[Math.floor(Math.random() * available.length)];
    onUpdateTeam({ ...team, name: `تیم ${randomPick}` });
    setEditedName(`تیم ${randomPick}`);
  };

  // Font size classes based on display mode
  const titleSize =
    displaySize === 'auditorium'
      ? 'text-lg sm:text-xl lg:text-2xl font-black'
      : displaySize === 'projector'
      ? 'text-base sm:text-lg lg:text-xl font-black'
      : 'text-sm sm:text-base font-bold';

  const memberNameSize =
    displaySize === 'auditorium'
      ? 'text-base sm:text-lg font-bold'
      : displaySize === 'projector'
      ? 'text-sm sm:text-base font-bold'
      : 'text-xs sm:text-sm font-semibold';

  const leaderNameSize =
    displaySize === 'auditorium'
      ? 'text-base sm:text-lg lg:text-xl font-black'
      : displaySize === 'projector'
      ? 'text-sm sm:text-base lg:text-lg font-black'
      : 'text-xs sm:text-sm font-extrabold';

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-2xl border-2 transition-all flex flex-col h-full bg-slate-900/90 backdrop-blur-md shadow-xl overflow-hidden relative ${
        isDragOver
          ? 'border-cyan-300 ring-4 ring-cyan-400/40 scale-[1.01] bg-slate-850'
          : isActiveTurn
          ? 'border-amber-400 ring-4 ring-amber-400/30'
          : team.borderColor
      }`}
    >
      {/* Active turn badge */}
      {isActiveTurn && (
        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs animate-pulse shadow-md">
          نوبت انتخاب ⭐
        </div>
      )}

      {/* Header */}
      <div 
        className="p-3 border-b border-slate-800 flex items-center justify-between gap-2"
        style={{ borderTop: `4px solid ${team.color}` }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 w-full">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="bg-slate-950 border border-cyan-400 rounded-lg px-2 py-1 text-sm font-bold text-white focus:outline-none w-full"
                  autoFocus
                />
                <button
                  onClick={saveName}
                  className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 cursor-pointer"
                  title="ذخیره نام"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <h3 className={`${titleSize} text-white tracking-tight truncate`} title={team.name}>
                  {team.name}
                </h3>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer flex-shrink-0"
                  title="ویرایش نام تیم"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={rollRandomName}
                  className="p-1 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-800 cursor-pointer flex-shrink-0"
                  title="پیشنهاد نام تصادفی"
                >
                  <Dice5 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Meta */}
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
            <span>ظرفیت فعلی: <strong className="text-white font-mono">{toPersianDigits(members.length)}</strong> نفر</span>
          </div>
        </div>

        {/* Member count badge */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-base font-mono shadow-md flex-shrink-0"
          style={{ backgroundColor: team.color, color: '#020617' }}
          title={`تعداد اعضا: ${members.length}`}
        >
          {toPersianDigits(members.length)}
        </div>
      </div>

      {/* Leader Showcase (نفر اول = سرگروه) */}
      <div className="p-2.5 sm:p-3 bg-slate-950/70 border-b border-slate-800">
        <div className="text-xs font-bold text-amber-400 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Crown className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
            <span>سرگروه (لیدر تیم)</span>
          </span>
          {leader && onOpenSmsForTeam && (
            <button
              onClick={() => onOpenSmsForTeam(team)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
            >
              <MessageSquare className="w-3 h-3" />
              <span>پیامک</span>
            </button>
          )}
        </div>

        {leader ? (
          <div 
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', leader.id);
              e.dataTransfer.setData('source-team-id', team.id);
              e.dataTransfer.effectAllowed = 'move';
              sound.playClick();
            }}
            className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/10 border border-amber-500/40 hover:border-amber-400/80 rounded-xl p-2.5 flex flex-col gap-2 shadow-inner cursor-grab active:cursor-grabbing transition-all group select-none"
            title="بکشید و در تیم دیگر بیندازید یا برای ویرایش کلیک کنید"
          >
            {/* Row 1: Handle + Number + Full Name (Zero overlap!) */}
            <div className="flex items-center gap-2 w-full min-w-0">
              <GripVertical className="w-4 h-4 text-amber-500/60 group-hover:text-amber-400 flex-shrink-0 cursor-grab transition-colors" />
              <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center font-mono flex-shrink-0">
                ۱
              </span>
              <button
                type="button"
                onClick={() => onSelectParticipant?.(leader, team, true)}
                className={`${leaderNameSize} text-amber-200 hover:text-amber-100 hover:underline decoration-amber-400/60 font-black tracking-tight text-right truncate cursor-pointer transition-colors flex-1`}
                title="کلیک برای مشاهده و ویرایش مشخصات یا افزودن شماره موبایل"
              >
                {leader.name}
              </button>
            </div>

            {/* Row 2: Action Bar (Separated cleanly) */}
            <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-amber-500/20 text-[11px]">
              <button
                type="button"
                onClick={() => onSelectParticipant?.(leader, team, true)}
                className="text-amber-400/90 hover:text-amber-200 text-[10px] font-medium transition-colors cursor-pointer"
                title="ویرایش مشخصات یا شماره موبایل"
              >
                ویرایش
              </button>

              <div className="flex items-center gap-1 flex-shrink-0">
                {allTeams && allTeams.length > 1 && (
                  <select
                    value=""
                    onChange={(e) => {
                      const targetTeamId = e.target.value;
                      if (targetTeamId) {
                        sound.playFanfare();
                        onDropParticipant(leader.id, targetTeamId);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-slate-950 border border-slate-700 hover:border-amber-400/80 text-amber-300 rounded px-1.5 py-0.5 text-[10px] font-bold focus:outline-none cursor-pointer max-w-[80px] truncate transition-colors"
                    title="انتقال سرگروه به تیم دیگر"
                  >
                    <option value="" disabled>انتقال...</option>
                    {allTeams.filter((t) => t.id !== team.id).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveMember(team.id, leader.id);
                  }}
                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                  title="خروج از تیم و بازگشت به سالن"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-2.5 px-3 border border-dashed border-amber-500/30 rounded-xl text-center text-xs text-amber-300/70 bg-amber-500/5">
            اولین فردی که انتخاب شود، سرگروه این تیم خواهد شد 👑
          </div>
        )}
      </div>

      {/* Regular Members List */}
      <div className="flex-1 p-2.5 sm:p-3 overflow-y-auto space-y-1.5 min-h-[140px] custom-scrollbar">
        <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
          <span>سایر اعضای تیم:</span>
          <span className="font-mono">{toPersianDigits(regularMembers.length)} نفر</span>
        </div>

        {regularMembers.length === 0 ? (
          <div className="h-20 flex items-center justify-center text-center p-3 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            {leader ? 'هنوز عضو دیگری اضافه نشده است' : 'اسم‌ها را به این کادر بکشید'}
          </div>
        ) : (
          regularMembers.map((member, idx) => (
            <div
              key={member.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', member.id);
                e.dataTransfer.setData('source-team-id', team.id);
                e.dataTransfer.effectAllowed = 'move';
                sound.playClick();
              }}
              className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/60 rounded-xl p-2 flex flex-col gap-1.5 group transition-all cursor-grab active:cursor-grabbing select-none"
              title="بکشید و در تیم دیگر بیندازید"
            >
              {/* Row 1: Grip + Badge Number + Member Name (Zero overlap!) */}
              <div className="flex items-center gap-2 w-full min-w-0">
                <GripVertical className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 flex-shrink-0 cursor-grab transition-colors" />
                <span className="w-5 h-5 rounded-md bg-slate-700 text-slate-300 font-mono text-[11px] flex items-center justify-center font-bold flex-shrink-0">
                  {toPersianDigits(idx + 2)}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectParticipant?.(member, team, false)}
                  className={`${memberNameSize} text-slate-200 hover:text-cyan-300 hover:underline decoration-cyan-400/50 font-bold tracking-tight text-right truncate flex-1 cursor-pointer transition-colors`}
                  title="کلیک برای مشاهده و ویرایش مشخصات"
                >
                  {member.name}
                </button>
              </div>

              {/* Row 2: Action Bar */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-700/40 text-[10px]">
                <button
                  type="button"
                  onClick={() => onSelectParticipant?.(member, team, false)}
                  className="text-slate-400 hover:text-cyan-300 text-[10px] cursor-pointer"
                  title="ویرایش مشخصات"
                >
                  ویرایش
                </button>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  {allTeams && allTeams.length > 1 && (
                    <select
                      value=""
                      onChange={(e) => {
                        const targetTeamId = e.target.value;
                        if (targetTeamId) {
                          sound.playFanfare();
                          onDropParticipant(member.id, targetTeamId);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="bg-slate-900 border border-slate-700 hover:border-cyan-400/80 rounded px-1.5 py-0.5 text-[10px] text-cyan-300 font-bold focus:outline-none cursor-pointer max-w-[70px] truncate transition-colors"
                      title="انتقال سریع به تیم دیگر"
                    >
                      <option value="" disabled>انتقال...</option>
                      {allTeams.filter((t) => t.id !== team.id).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playPop();
                      onPromoteToLeader(team.id, member.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-700 transition-colors cursor-pointer"
                    title="ارتقا به سرگروه این تیم"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      sound.playClick();
                      onRemoveMember(team.id, member.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors cursor-pointer"
                    title="حذف از تیم و بازگشت به سالن"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Drag & Drop Hint Footer */}
      <div className="px-3 py-1.5 bg-slate-950/80 border-t border-slate-800 text-[11px] text-slate-500 text-center flex items-center justify-center gap-1">
        <span>📥 محل رها کردن (Drag & Drop)</span>
      </div>
    </div>
  );
};
