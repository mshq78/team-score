import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  User, 
  Phone, 
  X, 
  Check, 
  Trash2, 
  Crown, 
  ArrowLeft, 
  Shield, 
  Users, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { Participant, BootcampTeam } from '../types';
import { toPersianDigits } from '../utils/persian';
import { sound } from '../utils/sound';

interface ParticipantModalProps {
  participant: Participant | null;
  isOpen: boolean;
  onClose: () => void;
  teams: BootcampTeam[];
  currentTeam?: BootcampTeam | null;
  isLeader?: boolean;
  onUpdateParticipant: (id: string, name: string, phone?: string) => void;
  onAssignToTeam: (participantId: string, teamId: string) => void;
  onReturnToHall: (participantId: string) => void;
  onPromoteToLeader?: (teamId: string, participantId: string) => void;
  onDeleteParticipant?: (participantId: string) => void;
}

export const ParticipantModal: React.FC<ParticipantModalProps> = ({
  participant,
  isOpen,
  onClose,
  teams,
  currentTeam,
  isLeader = false,
  onUpdateParticipant,
  onAssignToTeam,
  onReturnToHall,
  onPromoteToLeader,
  onDeleteParticipant,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (participant) {
      setName(participant.name || '');
      setPhone(participant.phone || '');
      setShowDeleteConfirm(false);
    }
  }, [participant]);

  if (!isOpen || !participant) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    sound.playPop();
    onUpdateParticipant(participant.id, name.trim(), phone.trim() || undefined);
    onClose();
  };

  const handleTeamChange = (targetTeamId: string) => {
    if (!targetTeamId) return;
    sound.playFanfare();
    onAssignToTeam(participant.id, targetTeamId);
  };

  const handleSendToHall = () => {
    sound.playClick();
    onReturnToHall(participant.id);
  };

  const handleMakeLeader = () => {
    if (currentTeam && onPromoteToLeader) {
      sound.playFanfare();
      onPromoteToLeader(currentTeam.id, participant.id);
    }
  };

  const handleDelete = () => {
    if (onDeleteParticipant) {
      sound.playClick();
      onDeleteParticipant(participant.id);
      onClose();
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg my-auto shadow-2xl overflow-hidden flex flex-col text-right select-none animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-amber-500/20 border border-indigo-500/30 flex items-center justify-center text-cyan-300 flex-shrink-0 shadow-inner">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>مشخصات و ویرایش شرکت‌کننده</span>
                {isLeader && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                    <Crown className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span>سرگروه</span>
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                تغییر مشخصات فردی، شماره موبایل و وضعیت عضویت در تیم
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh] custom-scrollbar">
          
          {/* Current Placement Status Card */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0"
                style={{ 
                  backgroundColor: currentTeam ? currentTeam.color : 'rgba(245, 158, 11, 0.15)',
                  color: currentTeam ? '#020617' : '#f59e0b'
                }}
              >
                {currentTeam ? (isLeader ? '👑' : <Shield className="w-4 h-4" />) : <Users className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-xs text-slate-400 font-medium block">وضعیت فعلی:</span>
                <span className="text-sm font-bold text-white">
                  {currentTeam 
                    ? `${isLeader ? 'سرگروه' : 'عضو'} «${currentTeam.name}»` 
                    : 'حاضر در سالن (منتظر انتخاب)'}
                </span>
              </div>
            </div>

            {currentTeam && (
              <button
                onClick={handleSendToHall}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-rose-300 hover:text-rose-200 border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="خروج از تیم و بازگشت به لیست سالن"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>بازگشت به سالن</span>
              </button>
            )}
          </div>

          {/* Full Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              نام و نام خانوادگی شرکت‌کننده
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: سارا کریمی..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-medium"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              نام کامل فرد روی پرده پروژکتور برای همه نمایش داده می‌شود.
            </p>
          </div>

          {/* Phone Number Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-cyan-400" />
                <span>شماره موبایل (جهت هماهنگی و پیامک)</span>
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                محفوظ و دور از دید پرده
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09123456789"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all text-right"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              🔒 <strong className="text-slate-300">نکته حریم خصوصی:</strong> این شماره زیر اسم فرد در پرده نمایش داده نمی‌شود و فقط برای سامانه ارسال پیامک تیم‌ها استفاده می‌شود.
            </p>
          </div>

          {/* Quick Team Assignment Controls */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2">
              تغییر تیم یا انتساب مستقیم
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {teams.map((t) => {
                const isSelected = currentTeam?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => handleTeamChange(t.id)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-cyan-400 border-cyan-400 bg-slate-800'
                        : 'border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-900 text-slate-300'
                    }`}
                  >
                    <span 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="truncate w-full text-center">{t.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono font-normal">
                      {toPersianDigits(t.memberIds.length)} عضو
                    </span>
                  </button>
                );
              })}
            </div>

            {currentTeam && !isLeader && onPromoteToLeader && (
              <button
                onClick={handleMakeLeader}
                className="mt-2.5 w-full py-2 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>ارتقا به عنوان سرگروه «{currentTeam.name}»</span>
              </button>
            )}
          </div>

          {/* Delete Participant Section */}
          <div className="pt-2 border-t border-slate-800/80">
            {showDeleteConfirm ? (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-300">
                <span>از حذف این شخص از سامانه مطمئن هستید؟</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                  >
                    بله، حذف کن
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer py-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف این فرد از فهرست کل شرکت‌کنندگان</span>
              </button>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors cursor-pointer"
          >
            انصراف
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-cyan-500 to-indigo-600 hover:brightness-110 active:scale-95 text-white shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>ذخیره تغییرات</span>
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
