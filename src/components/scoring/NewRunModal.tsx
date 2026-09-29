import React, { useState } from 'react';
import { AppState } from '../../store/state';
import { AppAction } from '../../store/actions';
import { buildRunArchive } from '../../scoring/archive';
import { downloadBackupJson } from '../../utils/backup';
import { X, PlayCircle, AlertTriangle, CheckCircle2, Save } from 'lucide-react';

interface NewRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onSuccess: (message: string) => void;
}

export const NewRunModal: React.FC<NewRunModalProps> = ({
  isOpen,
  onClose,
  state,
  dispatch,
  onSuccess,
}) => {
  const [runName, setRunName] = useState<string>(() => 'اجرای ' + new Date().toLocaleDateString('fa-IR'));
  const [clearParticipants, setClearParticipants] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleConfirm = () => {
    // (a) call downloadBackupJson(state) from src/utils/backup.ts
    downloadBackupJson(state);

    // (b) build archive with buildRunArchive(state, new Date().toISOString())
    const nowIso = new Date().toISOString();
    const archive = buildRunArchive(state, nowIso);

    // (c) dispatch START_NEW_RUN with newRunId = 'run-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const newRunId = 'run-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    dispatch({
      type: 'START_NEW_RUN',
      payload: {
        newRunId,
        newRunName: runName.trim() || 'اجرای جدید',
        nowIso,
        archive,
        clearParticipants,
      },
    });

    // (d) close modal and show toast with «اجرای جدید شروع شد»
    onClose();
    onSuccess('اجرای جدید شروع شد');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <PlayCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">شروع اجرای جدید بوت‌کمپ</h3>
              <p className="text-xs text-slate-400">آرشیو اجرای فعلی و آماده‌سازی برای دور یا روز جدید</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Run Name input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              نام اجرای جدید:
            </label>
            <input
              type="text"
              value={runName}
              onChange={(e) => setRunName(e.target.value)}
              placeholder="مثلاً: اجرای روز دوم یا بوت‌کمپ پاییز"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-cyan-500 transition-colors text-slate-100"
              autoFocus
            />
          </div>

          {/* Clear participants checkbox */}
          <label className="flex items-center gap-3 p-3 bg-slate-950/60 border border-slate-800 rounded-2xl cursor-pointer hover:bg-slate-950 transition-colors">
            <input
              type="checkbox"
              checked={clearParticipants}
              onChange={(e) => setClearParticipants(e.target.checked)}
              className="w-4 h-4 rounded accent-cyan-500 cursor-pointer"
            />
            <span className="text-xs font-bold text-slate-200">
              پاک کردن لیست شرکت‌کنندگان
            </span>
          </label>

          {/* Warning box */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>اقداماتی که در شروع اجرای جدید انجام می‌شود:</span>
            </div>
            <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed pr-1">
              <li>نمره‌ها، یادداشت‌ها و امتیازهای مجری پاک می‌شوند</li>
              <li>وضعیت همه رویدادها به «در انتظار» برمی‌گردد</li>
              <li>تیم‌ها خالی می‌شوند</li>
              <li>رویدادها، شاخص‌ها و داورها می‌مانند</li>
              <li>نتیجه اجرای فعلی در آرشیو ذخیره می‌شود</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 flex items-center justify-end gap-2.5 bg-slate-950/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>ذخیره در آرشیو و شروع اجرای جدید</span>
          </button>
        </div>
      </div>
    </div>
  );
};
