import React, { useState } from 'react';
import { ScoringEvent, EventStatus } from '../../types';
import { X, Check, Calendar, Award } from 'lucide-react';

interface EventFormModalProps {
  event?: ScoringEvent | null;
  onSave: (eventData: {
    name: string;
    weight: number;
    status: EventStatus;
    awardTitle?: string;
  }) => void;
  onClose: () => void;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  event,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(event?.name || '');
  const [weight, setWeight] = useState<number>(event?.weight ?? 1);
  const [status, setStatus] = useState<EventStatus>(event?.status || 'upcoming');
  const [awardTitle, setAwardTitle] = useState(event?.awardTitle || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('نام رویداد الزامی است.');
      return;
    }

    if (weight <= 0) {
      setError('وزن رویداد باید عددی بزرگتر از صفر باشد.');
      return;
    }

    onSave({
      name: trimmed,
      weight,
      status,
      awardTitle: awardTitle.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {event ? 'ویرایش مشخصات رویداد' : 'افزودن رویداد مسابقه جدید'}
              </h3>
              <p className="text-xs text-slate-400">
                تعیین نام، ضریب وزن و وضعیت برگزاری
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
              نام رویداد مسابقه:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="مثلاً: بازی تیمی صبح، دستپخت و ناهار..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-colors text-slate-100 placeholder:text-slate-500"
              autoFocus
            />
          </div>

          {/* Weight */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              ضریب وزنی در نمره کل (Weight):
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0.1"
                step="any"
                value={weight}
                onChange={(e) => {
                  setWeight(parseFloat(e.target.value) || 1);
                  setError(null);
                }}
                className="w-28 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-500"
              />
              <span className="text-xs text-slate-400">
                (پیش‌فرض: ۱ — هرچه بیشتر باشد، تأثیر نمره این رویداد در مجموع نهایی بالاتر است)
              </span>
            </div>
          </div>

          {/* Status (3-state control) */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              وضعیت برگزاری رویداد:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('upcoming')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                  status === 'upcoming'
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                ⏳ پیش‌رو
              </button>
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                  status === 'active'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                🟢 در جریان
              </button>
              <button
                type="button"
                onClick={() => setStatus('closed')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                  status === 'closed'
                    ? 'bg-slate-700/80 border-slate-500 text-slate-200 shadow-sm'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                🔒 بسته‌شده
              </button>
            </div>
          </div>

          {/* Optional Award Title */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>عنوان جایزه ویژه رویداد (اختیاری):</span>
            </label>
            <input
              type="text"
              value={awardTitle}
              onChange={(e) => setAwardTitle(e.target.value)}
              placeholder="مثلاً: تندیس خلاقیت، کاپ طلایی آشپزی..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-cyan-500 transition-colors text-slate-100 placeholder:text-slate-500"
            />
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
              <span>{event ? 'ذخیره تغییرات' : 'افزودن رویداد'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
