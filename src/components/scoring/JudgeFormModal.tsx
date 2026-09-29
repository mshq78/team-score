import React, { useState } from 'react';
import { Judge, ScoringEvent } from '../../types';
import { toPersianDigits } from '../../utils/persian';
import { X, Check, KeyRound, User, Award, RefreshCw } from 'lucide-react';

interface JudgeFormModalProps {
  judge?: Judge | null;
  events: ScoringEvent[];
  existingJudges: Judge[];
  onSave: (judge: Judge) => void;
  onClose: () => void;
}

export function generateRandomAccessCode(existingJudges: Judge[], currentJudgeId?: string): string {
  const existingCodes = new Set(
    existingJudges
      .filter((j) => !currentJudgeId || j.id !== currentJudgeId)
      .map((j) => j.accessCode)
  );

  let code = '';
  let attempts = 0;
  do {
    code = Math.floor(1000 + Math.random() * 9000).toString();
    attempts++;
  } while (existingCodes.has(code) && attempts < 1000);

  return code;
}

export const JudgeFormModal: React.FC<JudgeFormModalProps> = ({
  judge,
  events,
  existingJudges,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(judge?.name || '');
  const [accessCode, setAccessCode] = useState(
    judge?.accessCode || generateRandomAccessCode(existingJudges, judge?.id)
  );
  const [allEvents, setAllEvents] = useState(!judge || judge.eventIds.length === 0);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>(judge?.eventIds || []);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerateCode = () => {
    setAccessCode(generateRandomAccessCode(existingJudges, judge?.id));
  };

  const handleToggleEvent = (eventId: string) => {
    if (selectedEventIds.includes(eventId)) {
      setSelectedEventIds(selectedEventIds.filter((id) => id !== eventId));
    } else {
      setSelectedEventIds([...selectedEventIds, eventId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('نام داور نمی‌تواند خالی باشد.');
      return;
    }

    const trimmedCode = accessCode.trim();
    if (!/^\d{4}$/.test(trimmedCode)) {
      setError('کد ورود باید دقیقاً یک عدد ۴ رقمی باشد (مثلاً ۲۵۴۸).');
      return;
    }

    // Check duplicate code
    const isDuplicate = existingJudges.some(
      (j) => j.accessCode === trimmedCode && (!judge || j.id !== judge.id)
    );
    if (isDuplicate) {
      setError('این کد ورود قبلاً برای داور دیگری استفاده شده است. لطفاً کد متفاوتی وارد کنید.');
      return;
    }

    if (!allEvents && selectedEventIds.length === 0) {
      setError('حداقل یک رویداد را انتخاب کنید یا گزینه «دسترسی به تمام رویدادها» را فعال نمایید.');
      return;
    }

    const finalJudge: Judge = {
      id: judge?.id || `judge-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      accessCode: trimmedCode,
      eventIds: allEvents ? [] : selectedEventIds,
    };

    onSave(finalJudge);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {judge ? 'ویرایش مشخصات داور' : 'افزودن داور جدید'}
              </h3>
              <p className="text-xs text-slate-400">
                تعیین کد ورود و دامنه دسترسی به رویدادها
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              نام داور یا ارزیاب:
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                placeholder="مثلاً: دکتر علوی، مهندس شجاعی..."
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-colors text-slate-100 placeholder:text-slate-500"
                autoFocus
              />
            </div>
          </div>

          {/* Access Code */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>کد دسترسی ۴ رقمی (رمز ورود اختصاصی):</span>
              <button
                type="button"
                onClick={handleRegenerateCode}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>تولید کد جدید</span>
              </button>
            </label>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-slate-500 absolute right-3 pointer-events-none" />
              <input
                type="text"
                maxLength={4}
                value={accessCode}
                onChange={(e) => {
                  setAccessCode(e.target.value.replace(/\D/g, ''));
                  setError(null);
                }}
                placeholder="۴ رقم"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pr-9 pl-3 py-2.5 text-center font-mono font-black text-lg tracking-widest text-cyan-400 focus:outline-none focus:border-cyan-500 transition-colors"
                dir="ltr"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              داور با وارد کردن این کد ۴ رقمی وارد سامانه داوری می‌شود.
            </p>
          </div>

          {/* Event Assignments */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs font-bold text-slate-300 mb-2">
              رویدادهای مجاز برای نمره‌دهی این داور:
            </label>

            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/60 cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={allEvents}
                  onChange={(e) => {
                    setAllEvents(e.target.checked);
                    if (e.target.checked) setSelectedEventIds([]);
                  }}
                  className="w-4 h-4 rounded text-cyan-500 accent-cyan-500"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-200">همه رویدادها (پیش‌فرض)</span>
                  <span className="block text-[11px] text-slate-400">
                    داور مجاز به امتیازدهی در تمامی مسابقات خواهد بود.
                  </span>
                </div>
              </label>

              {!allEvents && (
                <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2 max-h-40 overflow-y-auto">
                  {events.length === 0 ? (
                    <p className="text-xs text-slate-500">هنوز رویدادی تعریف نشده است.</p>
                  ) : (
                    events.map((ev, idx) => (
                      <label
                        key={ev.id}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedEventIds.includes(ev.id)}
                            onChange={() => handleToggleEvent(ev.id)}
                            className="w-4 h-4 rounded text-cyan-500 accent-cyan-500"
                          />
                          <span className="text-xs font-medium text-slate-200">
                            {ev.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          #{toPersianDigits(idx + 1)}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/25 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{judge ? 'ذخیره تغییرات' : 'افزودن داور'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
