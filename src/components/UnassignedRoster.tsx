import React, { useState, useRef } from 'react';
import { 
  Search, 
  UserCheck, 
  GripVertical, 
  UserPlus, 
  CheckCircle2, 
  ArrowLeft,
  LayoutGrid,
  List,
  Eye
} from 'lucide-react';
import { Participant, BootcampTeam, DisplaySize } from '../types';
import { toPersianDigits } from '../utils/persian';
import { sound } from '../utils/sound';

interface UnassignedRosterProps {
  unassigned: Participant[];
  teams: BootcampTeam[];
  displaySize: DisplaySize;
  onAssignToTeam: (participantId: string, teamId: string) => void;
  onOpenAddModal: () => void;
  activeTeamIdForPick?: string; // Optional indicator of whose turn it is
  isNarrowColumn?: boolean;
  onReturnToHall?: (participantId: string) => void;
  onSelectParticipant?: (participant: Participant) => void;
}

export const UnassignedRoster: React.FC<UnassignedRosterProps> = ({
  unassigned,
  teams,
  displaySize,
  onAssignToTeam,
  onOpenAddModal,
  activeTeamIdForPick,
  isNarrowColumn = false,
  onReturnToHall,
  onSelectParticipant,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [cardDensity, setCardDensity] = useState<'dense' | 'comfortable'>('comfortable');
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const filtered = unassigned.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, participantId: string) => {
    e.dataTransfer.setData('text/plain', participantId);
    e.dataTransfer.effectAllowed = 'move';
    sound.playClick();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);
    const participantId = e.dataTransfer.getData('text/plain');
    if (participantId && onReturnToHall) {
      sound.playPop();
      onReturnToHall(participantId);
    }
  };

  // Font and sizing classes based on projector mode & density
  const nameTextSize = isNarrowColumn
    ? cardDensity === 'dense'
      ? 'text-xs sm:text-sm font-black py-1 px-1.5'
      : displaySize === 'auditorium'
      ? 'text-base sm:text-lg font-black py-2 px-2.5'
      : displaySize === 'projector'
      ? 'text-sm sm:text-base font-black py-1.5 px-2'
      : 'text-xs sm:text-sm font-bold py-1.5 px-2'
    : cardDensity === 'dense'
    ? 'text-xs sm:text-sm font-bold py-1.5 px-2'
    : displaySize === 'auditorium'
    ? 'text-lg sm:text-2xl font-black py-3 px-3.5'
    : displaySize === 'projector'
    ? 'text-base sm:text-xl font-black py-2 px-3'
    : 'text-sm sm:text-base font-bold py-2 px-2.5';

  const headerTitleSize = isNarrowColumn
    ? 'text-base sm:text-lg'
    : displaySize === 'auditorium' ? 'text-2xl sm:text-3xl' : displaySize === 'projector' ? 'text-xl sm:text-2xl' : 'text-lg';

  // Dynamic grid columns: strictly 1 column in dense (فشرده) mode for side column
  const gridColumns = isNarrowColumn
    ? cardDensity === 'dense'
      ? 'grid-cols-1 gap-1.5'
      : 'grid-cols-2 gap-2'
    : cardDensity === 'dense'
    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-1.5'
    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3';

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`bg-slate-900/95 border-2 transition-all rounded-2xl flex flex-col h-full min-h-0 shadow-2xl backdrop-blur-md overflow-hidden relative ${
        isDragOver 
          ? 'border-amber-400 ring-4 ring-amber-400/40 bg-slate-850' 
          : 'border-slate-700/80'
      }`}
    >
      {/* Visual Drop Overlay to Return to Hall (pointer-events-none prevents infinite flicker and event cancellation) */}
      {isDragOver && (
        <div className="absolute inset-0 z-40 bg-amber-500/25 border-2 border-dashed border-amber-400 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-amber-300 font-black animate-pulse pointer-events-none select-none">
          <UserCheck className="w-12 h-12 text-amber-300 animate-bounce drop-shadow-md" />
          <span className="text-base sm:text-lg drop-shadow font-black">رها کنید تا فرد به سالن بازگردد</span>
        </div>
      )}

      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className={`${headerTitleSize} font-black text-amber-300 tracking-tight flex items-center gap-1.5 flex-wrap`}>
              <span>{isNarrowColumn ? 'افراد در سالن' : 'افراد حاضر در سالن (منتظر انتخاب)'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-black border border-amber-500/30">
                {toPersianDigits(unassigned.length)} نفر
              </span>
            </h2>
            {!isNarrowColumn && (
              <p className="text-xs text-slate-400 hidden sm:block mt-0.5">
                تمامی اسامی با فونت وزیر و به طور کامل بدون برش نمایش داده می‌شوند
              </p>
            )}
          </div>
        </div>

        {/* View density and Add button */}
        <div className="flex items-center gap-2">
          {/* Density toggle to see all names at once on projector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-700 shadow-inner">
            <button
              onClick={() => {
                sound.playClick();
                setCardDensity('comfortable');
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                cardDensity === 'comfortable' 
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black ring-1 ring-amber-400' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="نمای کارت‌های درشت ۲ ستونه"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="text-[11px]">درشت</span>
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setCardDensity('dense');
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                cardDensity === 'dense' 
                  ? 'bg-amber-500 text-slate-950 shadow-md font-black ring-1 ring-amber-400' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="نمای متراکم و فشرده تک‌ستونی (مشاهده منظم اسامی در یک ستون)"
            >
              <List className="w-3.5 h-3.5" />
              <span className="text-[11px]">فشرده</span>
            </button>
          </div>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 border border-slate-700 text-cyan-300 hover:text-cyan-200 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>افزودن نام جدید</span>
          </button>
        </div>
      </div>

      {/* Search Input for fast operator typing */}
      <div className="px-3 pt-3 pb-2 bg-slate-900/80 border-b border-slate-800/80">
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی سریع اسم (مثلاً: سارا)..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white bg-slate-800 px-2 py-0.5 rounded"
            >
              پاک کردن
            </button>
          )}
        </div>
      </div>

      {/* Participants Cards Grid - No Truncation, Full Long Names Visible! */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 custom-scrollbar overscroll-contain">
        {filtered.length === 0 ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-800 rounded-xl text-slate-400">
            {unassigned.length === 0 ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3 animate-bounce" />
                <h3 className="text-xl font-black text-emerald-300">
                  همه شرکت‌کنندگان در تیم‌ها قرار گرفتند! 🎉
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-sm">
                  مراسم یارکشی با موفقیت تکمیل شد. اکنون می‌توانید پیامک خلاصه را برای سرگروه‌ها ارسال کنید.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-300">شرکت‌کننده‌ای با نام «{searchTerm}» پیدا نشد.</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-2 text-xs text-amber-400 hover:underline font-bold"
                >
                  نمایش همه {toPersianDigits(unassigned.length)} شرکت‌کننده
                </button>
              </>
            )}
          </div>
        ) : (
          <div className={`grid ${gridColumns}`}>
            {filtered.map((participant, index) => {
              return (
                <div
                  key={participant.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, participant.id)}
                  className="group relative rounded-xl border border-slate-700/90 hover:border-amber-400/80 bg-slate-800/95 hover:bg-slate-750 shadow-md hover:shadow-amber-500/15 transition-all cursor-grab active:cursor-grabbing select-none flex flex-col justify-between"
                >
                  {/* Name section: completely untruncated, multiline support with break-words */}
                  <div className={`flex items-start justify-between gap-2 ${nameTextSize}`}>
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <GripVertical className="w-4 h-4 text-slate-500 group-hover:text-amber-400 flex-shrink-0 mt-0.5 transition-colors" />
                      <button
                        type="button"
                        onClick={() => onSelectParticipant?.(participant)}
                        className="text-slate-100 hover:text-amber-300 hover:underline decoration-amber-400/50 underline-offset-4 font-black tracking-normal break-words whitespace-normal leading-snug text-right cursor-pointer transition-colors"
                        title="مشاهده و ویرایش مشخصات یا افزودن شماره موبایل"
                      >
                        {participant.name}
                      </button>
                    </div>
                    <span className="text-xs font-mono text-amber-400/80 bg-slate-900/90 px-1.5 py-0.5 rounded font-black flex-shrink-0">
                      {toPersianDigits(index + 1)}
                    </span>
                  </div>

                  {/* Quick Action Bar on Card Footer */}
                  <div className="px-2 py-1.5 border-t border-slate-700/60 bg-slate-900/60 flex items-center justify-between gap-1 text-[11px] rounded-b-xl">
                    <button
                      type="button"
                      onClick={() => onSelectParticipant?.(participant)}
                      className="text-slate-400 hover:text-amber-300 text-[10px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      title="ویرایش نام یا افزودن شماره موبایل"
                    >
                      <span>ویرایش مشخصات</span>
                    </button>

                    {/* Quick Move controls */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {activeTeamIdForPick && (
                        <button
                          onClick={() => {
                            sound.playPop();
                            onAssignToTeam(participant.id, activeTeamIdForPick);
                          }}
                          className="px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black transition-all flex items-center gap-0.5 cursor-pointer shadow-sm text-[10px]"
                          title="انتخاب توسط تیمِ نوبت‌دار"
                        >
                          <span>انتخاب</span>
                          <ArrowLeft className="w-2.5 h-2.5" />
                        </button>
                      )}

                      {/* Dropdown for any team */}
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            sound.playPop();
                            onAssignToTeam(participant.id, val);
                          }
                        }}
                        defaultValue=""
                        className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-amber-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer max-w-[100px] truncate"
                        title="انتقال سریع به تیم"
                      >
                        <option value="" disabled>
                          انتقال...
                        </option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/90 text-xs text-slate-300 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-amber-400 font-medium">
          <Eye className="w-3.5 h-3.5" />
          <span>تمامی {toPersianDigits(unassigned.length)} شرکت‌کننده جهت انتخاب سرگروه‌ها روی پرده حاضرند</span>
        </div>
        <span className="font-mono text-slate-400">
          نمایش: {toPersianDigits(filtered.length)} مورد
        </span>
      </div>
    </div>
  );
};
