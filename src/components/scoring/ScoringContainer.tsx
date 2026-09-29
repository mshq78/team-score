import React, { useState } from 'react';
import { AppState } from '../../store/state';
import { AppAction } from '../../store/actions';
import { ScoringSetupView } from './ScoringSetupView';
import { OperatorScoreEntryView } from './OperatorScoreEntryView';
import { FacilitatorAdjustmentsView } from './FacilitatorAdjustmentsView';
import { FinalReportView } from './FinalReportView';
import { Settings, Edit3, ShieldAlert, BarChart3, Clock, AlertCircle } from 'lucide-react';

interface ScoringContainerProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onShowToast?: (message: string) => void;
  onOpenSmsResultModal?: (resultsMap: Record<string, { rank: number; totalTeams: number; grandTotal: number }>) => void;
}

type ScoringSubTab = 'setup' | 'judge_scores' | 'facilitator_adjustments' | 'reports';

export const ScoringContainer: React.FC<ScoringContainerProps> = ({
  state,
  dispatch,
  onShowToast,
  onOpenSmsResultModal,
}) => {
  const [activeTab, setActiveTab] = useState<ScoringSubTab>('setup');

  return (
    <div className="max-w-[1920px] mx-auto px-3 sm:px-6 py-4 space-y-6">
      {/* Sub-tabs header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
          {/* Tab 1: تنظیمات */}
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'setup'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>تنظیمات</span>
          </button>

          {/* Tab 2: ثبت امتیاز */}
          <button
            onClick={() => setActiveTab('judge_scores')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'judge_scores'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>ثبت امتیاز</span>
          </button>

          {/* Tab 3: امتیاز مجری */}
          <button
            onClick={() => setActiveTab('facilitator_adjustments')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'facilitator_adjustments'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>امتیاز مجری</span>
          </button>

          {/* Tab 4: گزارش */}
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>گزارش</span>
          </button>
        </div>

        {/* Info label */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>سامانه داوری و محاسبه امتیازات بوت‌کمپ</span>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'setup' && (
        <ScoringSetupView
          state={state}
          dispatch={dispatch}
          onShowToast={onShowToast}
        />
      )}

      {activeTab === 'judge_scores' && (
        <OperatorScoreEntryView state={state} dispatch={dispatch} />
      )}

      {activeTab === 'facilitator_adjustments' && (
        <FacilitatorAdjustmentsView
          state={state}
          dispatch={dispatch}
          onShowToast={onShowToast}
        />
      )}

      {activeTab === 'reports' && (
        <FinalReportView
          state={state}
          dispatch={dispatch}
          onOpenSmsResultModal={
            onOpenSmsResultModal ||
            ((map) => {
              if (onShowToast) onShowToast('لطفاً از دکمه پیامک نتایج استفاده کنید');
            })
          }
        />
      )}
    </div>
  );
};
