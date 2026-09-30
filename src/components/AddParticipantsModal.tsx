import React, { useState } from 'react';
import { 
  X, 
  UserPlus, 
  ClipboardPaste, 
  Trash2, 
  Sparkles 
} from 'lucide-react';
import { Participant } from '../types';
import { BOOTCAMP_PRESETS } from '../utils/defaultData';
import { toPersianDigits } from '../utils/persian';
import { parseParticipantLines } from '../utils/parse';
import { sound } from '../utils/sound';

interface AddParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Participant[];
  onAddParticipants: (participants: Participant[]) => void;
  onRemoveParticipant: (participantId: string) => void;
  onReplaceParticipants: (participants: Participant[]) => void;
  onResetEverything: () => void;
}

export const AddParticipantsModal: React.FC<AddParticipantsModalProps> = ({
  isOpen,
  onClose,
  participants,
  onAddParticipants,
  onRemoveParticipant,
  onReplaceParticipants,
  onResetEverything,
}) => {
  const [pasteText, setPasteText] = useState('');
  const [singleName, setSingleName] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  if (!isOpen) return null;

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim()) return;

    sound.playPop();
    const newParticipant: Participant = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: singleName.trim(),
      phone: singlePhone.trim() || undefined,
    };

    onAddParticipants([newParticipant]);
    setSingleName('');
    setSinglePhone('');
  };

  const handleBulkAdd = () => {
    if (!pasteText.trim()) return;

    sound.playFanfare();
    const parsed = parseParticipantLines(pasteText);
    if (parsed.length === 0) return;

    const newItems: Participant[] = parsed.map((item, idx) => ({
      id: `p-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      name: item.name,
      phone: item.phone,
    }));

    onAddParticipants(newItems);
    setPasteText('');
  };

  const handleLoadPreset = (presetKey: string) => {
    sound.playShuffle();
    const preset = BOOTCAMP_PRESETS[presetKey];
    if (!preset) return;

    const newParticipants: Participant[] = preset.names.map((name, idx) => ({
      id: `preset-${presetKey}-${idx}-${Date.now()}`,
      name,
    }));

    onReplaceParticipants(newParticipants);
  };

  const handleRemoveOne = (id: string) => {
    sound.playClick();
    onRemoveParticipant(id);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-3xl max-h-[90vh] my-auto flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white">
                مدیریت اسامی و ثبت‌نامی‌های بوت‌کمپ
              </h3>
              <p className="text-xs text-slate-400">
                افزودن تکی، پیست کردن لیست کلاسی یا استفاده از نمونه‌های آماده
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Preset Buttons */}
          <div>
            <div className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>بارگذاری سریع نمونه اسامی بوت‌کمپ (جهت تست و شروع فوری):</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {Object.entries(BOOTCAMP_PRESETS).map(([key, item]) => (
                <button
                  key={key}
                  onClick={() => handleLoadPreset(key)}
                  className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 hover:border-cyan-500/60 text-right transition-all group cursor-pointer"
                >
                  <div className="font-black text-xs sm:text-sm text-cyan-300 group-hover:text-cyan-200">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {item.subtitle}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Bulk Paste Area */}
          <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <label className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <ClipboardPaste className="w-4 h-4 text-cyan-400" />
              <span>افزودن دسته‌ای اسامی (هر شرکت‌کننده در یک سطر):</span>
            </label>
            <textarea
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`مثال:
سید محمدرضا میرمحمدصادقی - 09121111111
سارا کریمی-دهکردی ۰۹۱۲۲۲۲۲۲۲۲
امیرحسین ابراهیمی فراهانی | 09123333333
نیلوفر امینی راد`}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[11px] text-slate-400">
                هر سطر یک نفر؛ شماره موبایل به طور هوشمند از سطر تشخیص داده شده و از نام جدا می‌شود.
              </span>
              <button
                onClick={handleBulkAdd}
                disabled={!pasteText.trim()}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
              >
                افزودن به لیست
              </button>
            </div>
          </div>

          {/* Single Add Form */}
          <form onSubmit={handleAddSingle} className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <div className="text-xs font-bold text-slate-300 mb-2">
              افزودن تکی شرکت‌کننده:
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="نام و نام خانوادگی..."
                className="flex-1 min-w-[160px] bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-400"
              />
              <input
                type="text"
                dir="ltr"
                value={singlePhone}
                onChange={(e) => setSinglePhone(e.target.value)}
                placeholder="شماره موبایل (اختیاری)"
                className="w-36 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-400 font-mono"
              />
              <button
                type="submit"
                disabled={!singleName.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                افزودن
              </button>
            </div>
          </form>

          {/* Existing List Preview */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
              <span>لیست فعلی شرکت‌کنندگان: ({toPersianDigits(participants.length)} نفر)</span>
              {participants.length > 0 && (
                isConfirmingClear ? (
                  <div className="flex items-center gap-1.5 bg-rose-950/60 border border-rose-800/80 px-2 py-0.5 rounded-lg animate-in fade-in">
                    <span className="text-[11px] text-rose-300 font-bold">پاک شود؟</span>
                    <button
                      onClick={() => {
                        sound.playWhistle();
                        onResetEverything();
                        setIsConfirmingClear(false);
                      }}
                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] cursor-pointer"
                    >
                      بله، پاک کن
                    </button>
                    <button
                      onClick={() => setIsConfirmingClear(false)}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white text-[10px] cursor-pointer"
                    >
                      انصراف
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      sound.playClick();
                      setIsConfirmingClear(true);
                    }}
                    className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>پاکسازی کل لیست</span>
                  </button>
                )
              )}
            </div>

            <div className="max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {participants.length === 0 ? (
                <div className="col-span-full py-6 text-center text-xs text-slate-500">
                  هیچ شرکت‌کننده‌ای ثبت نشده است. از گزینه‌های بالا برای افزودن استفاده کنید.
                </div>
              ) : (
                participants.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="font-mono text-slate-500 font-bold flex-shrink-0 mt-0.5">{toPersianDigits(idx + 1)}.</span>
                      <span className="text-white font-bold break-words whitespace-normal leading-snug">{p.name}</span>
                      {p.phone && <span className="text-slate-500 font-mono text-[10px] flex-shrink-0">({toPersianDigits(p.phone)})</span>}
                    </div>
                    <button
                      onClick={() => handleRemoveOne(p.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                      title="حذف"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
          >
            تایید و بازگشت به یارکشی
          </button>
        </div>

      </div>
    </div>
  );
};
