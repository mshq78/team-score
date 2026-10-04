import React, { useState } from 'react';
import { ScoringIndicator } from '../../types';
import { X, Check, Target } from 'lucide-react';

interface IndicatorFormModalProps {
  indicator?: ScoringIndicator | null;
  eventName: string;
  onSave: (data: { name: string; maxScore: number; weight: number }) => void;
  onClose: () => void;
}

export const IndicatorFormModal: React.FC<IndicatorFormModalProps> = ({
  indicator,
  eventName,
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(indicator?.name || '');
  const [maxScore, setMaxScore] = useState<number>(indicator?.maxScore ?? 10);
  const [weight, setWeight] = useState<number>(indicator?.weight ?? 1);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('نام معیار نمی‌تواند خالی باشد.');
      return;
    }
    if (maxScore <= 0) {
      setError('حداکثر نمره باید عددی بزرگتر از صفر باشد.');
      return;
    }
    if (weight <= 0) {
      setError('وزن معیار باید عددی بزرگتر از صفر باشد.');
      return;
    }

    onSave({
      name: trimmed,
      maxScore,
      weight,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">
                {indicator ? 'ویرایش شاخص داوری' : 'افزودن معیار جدید'}
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-[200px]">
                رویداد: {eventName}
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
              نام شاخص یا معیار:
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="مثلاً: کار تیمی، سرعت، کیفیت ارائه..."
              className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-colors text-slate-100 placeholder:text-slate-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Max Score */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                سقف نمره (Max Score):
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={maxScore}
                onChange={(e) => {
                  setMaxScore(parseInt(e.target.value, 10) || 10);
                  setError(null);
                }}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-500"
              />
              <span className="block text-[10px] text-slate-400 mt-1">پیش‌فرض: ۱۰</span>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                ضریب وزنی (Weight):
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                value={weight}
                onChange={(e) => {
                  setWeight(parseFloat(e.target.value) || 1);
                  setError(null);
                }}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-center text-sm font-mono font-bold text-indigo-400 focus:outline-none focus:border-cyan-500"
              />
              <span className="block text-[10px] text-slate-400 mt-1">پیش‌فرض: ۱ = امتیاز همان‌طور که داور می‌دهد جمع می‌شود؛ ۲ یعنی دو برابر</span>
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
              <span>{indicator ? 'ذخیره' : 'افزودن معیار'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
