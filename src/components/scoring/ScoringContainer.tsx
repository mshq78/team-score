import React, { useState } from 'react';
import { AppState } from '../../store/state';
import { AppAction } from '../../store/actions';
import { ScoringSetupView } from './ScoringSetupView';
import { OperatorScoreEntryView } from './OperatorScoreEntryView';
import { FacilitatorAdjustmentsView } from './FacilitatorAdjustmentsView';
import { FinalReportView } from './FinalReportView';
import { PeopleView } from './PeopleView';
import { PublicLinkCard } from './PublicLinkCard';
import { Settings, Edit3, ShieldAlert, BarChart3, Users } from 'lucide-react';

interface ScoringContainerProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onShowToast?: (message: string) => void;
  onOpenSmsResultModal?: (resultsMap: Record<string, { rank: number; totalTeams: number; grandTotal: number }>) => void;
}

type ScoringSubTab = 'setup' | 'judge_scores' | 'facilitator_adjustments' | 'people' | 'reports';

export const ScoringContainer: React.FC<ScoringContainerProps> = ({
  state,
  dispatch,
  onShowToast,
  onOpenSmsResultModal,
}) => {
  const [activeTab, setActiveTab] = useState<ScoringSubTab>('setup');

  return (
    <div className="w-full min-w-0 max-w-[1920px] mx-auto px-3 sm:px-6 py-4 pb-24 md:pb-4 space-y-4 sm:space-y-6">
      {/* Sub-tabs header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 min-w-0">
        <div className="hidden md:flex items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 shadow-inner max-w-full overflow-x-auto">
          {/* Tab 1: تنظیمات */}
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex flex-shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
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
            className={`flex flex-shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
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
            className={`flex flex-shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'facilitator_adjustments'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>امتیاز مجری</span>
          </button>

          {/* Tab: ارزیابی افراد */}
          <button
            onClick={() => setActiveTab('people')}
            className={`flex flex-shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'people'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>ارزیابی افراد</span>
          </button>

          {/* Tab 4: گزارش */}
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
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

      {/* Phone navigation: fixed bottom bar (thumb reach) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {([
          ['setup', 'تنظیمات', Settings, 'text-cyan-400'],
          ['judge_scores', 'ثبت امتیاز', Edit3, 'text-indigo-400'],
          ['facilitator_adjustments', 'مجری', ShieldAlert, 'text-amber-400'],
          ['people', 'افراد', Users, 'text-rose-400'],
          ['reports', 'گزارش', BarChart3, 'text-emerald-400'],
        ] as const).map(([id, label, Icon, tone]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 text-[11px] font-bold cursor-pointer transition-colors ${
              activeTab === id ? `${tone} bg-slate-900` : 'text-slate-500'
            }`}
            aria-current={activeTab === id}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

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

      {activeTab === 'people' && <PeopleView state={state} dispatch={dispatch} onShowToast={onShowToast} />}

      {activeTab === 'reports' && <PublicLinkCard state={state} dispatch={dispatch} onShowToast={onShowToast} />}

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
