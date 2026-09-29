import React, { useState } from 'react';
import { 
  Crown, 
  Trash2, 
  ArrowUp, 
  Dice5, 
  Edit2, 
  Check, 
  Phone, 
  MapPin, 
  UserMinus,
  Sparkles,
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
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(team.name);
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  const leader = members[0];
  const regularMembers = members.slice(1);
  const [editedPhone, setEditedPhone] = useState(leader?.phone || '');

  // Keep edited phone in sync when leader changes
  React.useEffect(() => {
    setEditedPhone(leader?.phone || '');
  }, [leader?.id, leader?.phone]);

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

  const savePhone = () => {
    if (leader && onUpdateParticipantPhone) {
      onUpdateParticipantPhone(leader.id, editedPhone.trim());
    }
    setIsEditingPhone(false);
  };

  // Font size classes based on display mode
  const titleSize =
    displaySize === 'auditorium'
      ? 'text-2xl sm:text-3xl'
      : displaySize === 'projector'
      ? 'text-xl sm:text-2xl'
      : 'text-lg sm:text-xl';

  const memberNameSize =
    displaySize === 'auditorium'
      ? 'text-lg sm:text-xl font-extrabold'
      : displaySize === 'projector'
      ? 'text-base sm:text-lg font-bold'
      : 'text-sm sm:text-base font-semibold';

  const leaderNameSize =
    displaySize === 'auditorium'
      ? 'text-xl sm:text-2xl font-black'
      : displaySize === 'projector'
      ? 'text-lg sm:text-xl font-black'
      : 'text-base sm:text-lg font-extrabold';

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
        className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-2"
        style={{ borderTop: `4px solid ${team.color}` }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 w-full">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                  className="bg-slate-950 border border-cyan-400 rounded-lg px-2.5 py-1 text-sm font-bold text-white focus:outline-none w-full"
                  autoFocus
                />
                <button
                  onClick={saveName}
                  className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                  title="ذخیره نام"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <h3 className={`${titleSize} font-black text-white tracking-tight truncate`}>
                  {team.name}
                </h3>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                  title="ویرایش نام تیم"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={rollRandomName}
                  className="p-1 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-slate-800"
                  title="پیشنهاد نام تصادفی"
                >
                  <Dice5 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Table Number & Quick Meta */}
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-slate-300 font-medium">
              <MapPin className="w-3 h-3 text-cyan-400" />
              <span>{team.tableNumber || `میز ${teamIndex + 1}`}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>ظرفیت فعلی: <strong className="text-white font-mono">{toPersianDigits(members.length)}</strong> نفر</span>
          </div>
        </div>

        {/* Member count badge */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg font-mono shadow-md flex-shrink-0"
          style={{ backgroundColor: team.color, color: '#020617' }}
          title={`تعداد اعضا: ${members.length}`}
        >
          {toPersianDigits(members.length)}
        </div>
      </div>

      {/* Leader Showcase (نفر اول = سرگروه) */}
      <div className="p-3 sm:p-4 bg-slate-950/60 border-b border-slate-800">
        <div className="text-xs font-bold text-amber-400 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Crown className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
            <span>سرگروه (لیدر تیم)</span>
          </span>
          {leader && onOpenSmsForTeam && (
            <button
              onClick={() => onOpenSmsForTeam(team)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
            >
              <MessageSquare className="w-3 h-3" />
              <span>پیامک سرگروه</span>
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
            className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/10 border border-amber-500/40 hover:border-amber-400/80 rounded-xl p-3 flex items-center justify-between gap-3 shadow-inner cursor-grab active:cursor-grabbing transition-all group select-none"
            title="بکشید و در تیم دیگر بیندازید"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2 flex-1">
                <GripVertical className="w-4 h-4 text-amber-500/60 group-hover:text-amber-400 flex-shrink-0 mt-0.5 cursor-grab transition-colors" />
                <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center font-mono flex-shrink-0 mt-0.5">
                  ۱
                </span>
                <span className={`${leaderNameSize} text-amber-200 tracking-tight break-words whitespace-normal leading-snug`}>
                  {leader.name}
                </span>
              </div>

              {/* Leader Phone Input / Display */}
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400 mr-8">
                <Phone className="w-3 h-3 text-amber-400/80" />
                {isEditingPhone ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      dir="ltr"
                      value={editedPhone}
                      onChange={(e) => setEditedPhone(e.target.value)}
                      placeholder="0912xxxxxxx"
                      className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs text-white w-28 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={savePhone}
                      className="px-1.5 py-0.5 bg-amber-500 text-slate-950 rounded font-bold text-[10px]"
                    >
                      ثبت
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditedPhone(leader.phone || '');
                      setIsEditingPhone(true);
                    }}
                    className="hover:text-amber-300 transition-colors font-mono"
                    title="کلیک برای تنظیم شماره تماس جهت ارسال پیامک"
                  >
                    {leader.phone ? (
                      <span className="text-amber-300/90 font-bold">{toPersianDigits(leader.phone)}</span>
                    ) : (
                      <span className="text-slate-500 italic">+ افزودن شماره موبایل</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Actions: Move to another team or Return to hall */}
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
                  className="bg-slate-950 border border-slate-700 hover:border-amber-400/80 text-amber-300 rounded px-1.5 py-1 text-[10px] font-bold focus:outline-none cursor-pointer max-w-[80px] truncate transition-colors"
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

              {/* Remove / return leader */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveMember(team.id, leader.id);
                }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
                title="خروج از تیم و بازگشت به سالن"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="py-3 px-4 border border-dashed border-amber-500/30 rounded-xl text-center text-xs text-amber-300/70 bg-amber-500/5">
            اولین فردی که انتخاب شود، سرگروه این تیم خواهد شد 👑
          </div>
        )}
      </div>

      {/* Regular Members List */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-2 min-h-[140px]">
        <div className="text-xs font-semibold text-slate-400 mb-1 flex items-center justify-between">
          <span>سایر اعضای تیم:</span>
          <span className="font-mono">{toPersianDigits(regularMembers.length)} نفر</span>
        </div>

        {regularMembers.length === 0 ? (
          <div className="h-24 flex items-center justify-center text-center p-3 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
            {leader ? 'هنوز عضو دیگری انتخاب نشده است' : 'اسم‌ها را به این قسمت بکشید'}
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
              className="bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/60 rounded-xl p-2.5 flex items-center justify-between gap-2 group transition-all cursor-grab active:cursor-grabbing select-none"
              title="بکشید و در تیم دیگر بیندازید"
            >
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <GripVertical className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 flex-shrink-0 mt-0.5 transition-colors cursor-grab" />
                <span className="w-5 h-5 rounded-md bg-slate-700 text-slate-300 font-mono text-xs flex items-center justify-center font-bold flex-shrink-0 mt-0.5">
                  {toPersianDigits(idx + 2)}
                </span>
                <span className={`${memberNameSize} text-slate-200 tracking-wide break-words whitespace-normal leading-snug`}>
                  {member.name}
                </span>
              </div>

              {/* Action buttons: quick transfer, promote to leader or remove */}
              <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity flex-shrink-0">
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
                    className="bg-slate-900 hover:bg-slate-950 border border-slate-700 hover:border-cyan-400/80 rounded px-1.5 py-1 text-[10px] text-cyan-300 font-bold focus:outline-none cursor-pointer max-w-[75px] truncate transition-colors"
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
                  className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-slate-700 text-xs"
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
                  className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-700 text-xs"
                  title="حذف از تیم و بازگشت به سالن"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Drop Zone Visual Footer */}
      <div 
        className={`p-2.5 text-center text-xs font-bold border-t transition-all ${
          isDragOver
            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 animate-pulse'
            : 'bg-slate-950/40 text-slate-400 border-slate-800/80'
        }`}
      >
        {isDragOver ? '✨ نام را رها کنید تا به این تیم اضافه شود' : '📥 محل رها کردن (Drag & Drop)'}
      </div>
    </div>
  );
};
