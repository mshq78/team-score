import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Maximize2, 
  Minimize2, 
  Volume2, 
  VolumeX, 
  MessageSquare, 
  Shuffle, 
  Users, 
  RotateCcw,
  Sun,
  Moon,
  Plus,
  Minus,
  HardDrive,
  Download,
  Upload,
  AlertTriangle,
  SlidersHorizontal,
  Settings,
  Eye,
  EyeOff,
  X,
  Columns3,
  Rows3,
  Maximize,
  HelpCircle,
  CheckCircle2,
  Tv
} from 'lucide-react';
import { AppMode, DisplaySize, DisplayTheme } from '../types';
import { AppState } from '../store/state';
import { validateAndSanitizeBackup } from '../utils/backup';
import { SyncBadge } from './SyncBadge';
import { EventSwitcher, EventNamePill } from './EventSwitcher';
import geraLogo from '../assets/gera-logo.png';
import { sound } from '../utils/sound';
import { toPersianDigits } from '../utils/persian';

interface DatashowHeaderProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  displaySize: DisplaySize;
  onDisplaySizeChange: (size: DisplaySize) => void;
  displayTheme: DisplayTheme;
  onDisplayThemeChange: (theme: DisplayTheme) => void;
  teamsCount: number;
  onTeamsCountChange: (count: number) => void;
  unassignedCount: number;
  totalParticipants: number;
  stageLayout: 'side' | 'stacked' | 'focus_roster';
  onStageLayoutChange: (layout: 'side' | 'stacked' | 'focus_roster') => void;
  rightColWidth: 'compact' | 'ultra_compact' | 'balanced';
  onRightColWidthChange: (w: 'compact' | 'ultra_compact' | 'balanced') => void;
  onOpenSmsModal: () => void;
  onOpenParticipantsModal: () => void;
  onAutoFillRemaining: () => void;
  onResetDraft: () => void;
  onDownloadBackup: () => void;
  onRestoreBackup: (state: AppState) => void;
  isHeaderHidden: boolean;
  onToggleHeaderHidden: () => void;
  /** Online only: applies participants/teams/draftLog from an offline-build file */
  onImportTeams?: (state: AppState) => void;
  /** Offline build: no scoring tab, no online-only menu items */
  offline?: boolean;
}

export const DatashowHeader: React.FC<DatashowHeaderProps> = ({
  mode,
  onModeChange,
  displaySize,
  onDisplaySizeChange,
  displayTheme,
  onDisplayThemeChange,
  teamsCount,
  onTeamsCountChange,
  unassignedCount,
  totalParticipants,
  stageLayout,
  onStageLayoutChange,
  rightColWidth,
  onRightColWidthChange,
  onOpenSmsModal,
  onOpenParticipantsModal,
  onAutoFillRemaining,
  onResetDraft,
  onDownloadBackup,
  onRestoreBackup,
  isHeaderHidden,
  onToggleHeaderHidden,
  onImportTeams,
  offline = false,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(!sound.enabled);
  const [isOperatorPanelOpen, setIsOperatorPanelOpen] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<AppState | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pendingTeams, setPendingTeams] = useState<AppState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const teamsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOperatorPanelOpen(false);
        setShowResetConfirm(false);
        setPendingRestore(null);
        setPendingTeams(null);
        setRestoreError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleFullscreen = () => {
    sound.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const toggleSound = () => {
    sound.enabled = !sound.enabled;
    setIsSoundMuted(!sound.enabled);
    if (sound.enabled) sound.playClick();
  };

  const readBackupFile = (e: React.ChangeEvent<HTMLInputElement>, onValid: (s: AppState) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed: unknown = JSON.parse(text);
        const validState = validateAndSanitizeBackup(parsed);
        if (validState) {
          onValid(validState);
          setRestoreError(null);
        } else {
          setRestoreError('فایل انتخاب‌شده نامعتبر است یا ساختار سازگار با این سامانه را ندارد.');
        }
      } catch {
        setRestoreError('خطا در خواندن فایل. لطفاً مطمئن شوید فایل دارای فرمت صحیح JSON است.');
      }
    };
    reader.onerror = () => {
      setRestoreError('خطا در بارگذاری فایل از دیسک.');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => readBackupFile(e, setPendingRestore);
  const handleTeamsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => readBackupFile(e, setPendingTeams);

  // Render Drawer & Modals via Portal
  const renderModals = () => {
    if (!isMounted || typeof document === 'undefined') return null;

    return createPortal(
      <>
        {/* Operator Control Side Drawer (اسلاید تمیز از سمت چپ بدون اشغال مرکز پرده) */}
        {isOperatorPanelOpen && (
          <div 
            className="fixed inset-0 z-[9999] flex bg-slate-950/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsOperatorPanelOpen(false)}
          >
            <aside 
              className="w-full sm:w-[460px] max-w-full h-full bg-slate-900 border-r border-slate-700/80 shadow-2xl flex flex-col text-right select-none animate-in slide-in-from-left duration-250 ease-out z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-3 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 shadow-inner">
                    <Settings className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                      <span>میز کار و کنترل پنل اپراتور</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        مدیریت سالن
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      راهنمای ساده و قدم‌به‌قدم برای اجرای بی‌دغدغه مراسم
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setIsOperatorPanelOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="بستن پنل (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-5 custom-scrollbar flex-1">

                <EventSwitcher />

                {/* Step 1: Draft Operations */}
                <div className="bg-slate-950/70 border border-amber-500/30 rounded-2xl p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-400">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[11px] font-mono font-bold">
                        ۱
                      </span>
                      <span>قرعه‌کشی و یارکشی زنده</span>
                    </div>
                    <span className="text-[11px] text-amber-300 font-mono font-bold">
                      {toPersianDigits(unassignedCount)} نفر در سالن
                    </span>
                  </div>

                  {/* Big Auto-fill Button */}
                  <button
                    onClick={() => {
                      sound.playShuffle();
                      onAutoFillRemaining();
                      setIsOperatorPanelOpen(false);
                    }}
                    disabled={unassignedCount === 0}
                    className="w-full p-3.5 rounded-xl border border-amber-400/80 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-right transition-all flex items-center justify-between gap-3 shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:pointer-events-none cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-950/20 flex items-center justify-center text-slate-950 flex-shrink-0">
                        <Shuffle className="w-4 h-4" />
                      </div>
                      <div>
                        <strong className="text-sm block">توزیع خودکار و تصادفی نفرات</strong>
                        <span className="text-[11px] text-slate-900/80 block font-normal">
                          {unassignedCount > 0 
                            ? `تقسیم عادلانه ${toPersianDigits(unassignedCount)} نفر بین تیم‌ها` 
                            : 'همه افراد در تیم‌ها قرار گرفته‌اند'}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs bg-slate-950 text-amber-300 px-2 py-1 rounded-lg font-bold font-mono">
                      اجرا ⚡
                    </span>
                  </button>

                  {/* Team Count Stepper */}
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-between gap-3">
                    <div>
                      <strong className="text-xs font-bold text-white block">تعداد تیم‌های فعال</strong>
                      <span className="text-[11px] text-slate-400 block mt-0.5">قابل تنظیم بین ۲ تا ۸ تیم</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 rounded-xl p-1">
                      <button
                        onClick={() => {
                          sound.playClick();
                          onTeamsCountChange(Math.max(2, teamsCount - 1));
                        }}
                        disabled={teamsCount <= 2}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer"
                        title="کاهش تعداد تیم‌ها"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-black text-cyan-400 px-2.5 font-mono text-sm">
                        {toPersianDigits(teamsCount)} تیم
                      </span>
                      <button
                        onClick={() => {
                          sound.playClick();
                          onTeamsCountChange(Math.min(8, teamsCount + 1));
                        }}
                        disabled={teamsCount >= 8}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-30 cursor-pointer"
                        title="افزایش تعداد تیم‌ها"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-900/50 p-2 rounded-lg border border-slate-800/80">
                    💡 <strong className="text-slate-300">انتقال دستی:</strong> همچنین می‌توانید اسم هر فرد را با ماوس بکشید و داخل کادر تیم مورد نظر رها کنید.
                  </p>
                </div>

                {/* Step 2: Participants & SMS */}
                <div className="bg-slate-950/70 border border-cyan-500/30 rounded-2xl p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-black text-cyan-400">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-[11px] font-mono font-bold">
                      ۲
                    </span>
                    <span>شرکت‌کنندگان و پیامک سرگروه‌ها</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {/* Manage Participants */}
                    <button
                      onClick={() => {
                        sound.playClick();
                        setIsOperatorPanelOpen(false);
                        onOpenParticipantsModal();
                      }}
                      className="p-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-850 hover:border-cyan-400/60 text-right transition-all flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <Users className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <strong className="text-xs font-bold text-white block">
                          مدیریت و افزودن شرکت‌کنندگان
                        </strong>
                        <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                          افزودن نام جدید، بارگذاری از اکسل یا کپی لیست
                        </span>
                      </div>
                    </button>

                    {/* SMS for Leaders */}
                    <button
                      onClick={() => {
                        sound.playClick();
                        setIsOperatorPanelOpen(false);
                        onOpenSmsModal();
                      }}
                      className="p-3 rounded-xl border border-cyan-500/40 bg-slate-900 hover:bg-slate-850 hover:border-cyan-400 text-right transition-all flex items-center gap-3 cursor-pointer group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <strong className="text-xs font-bold text-cyan-200 block">
                          ارسال پیامک به سرگروه‌ها
                        </strong>
                        <span className="text-[11px] text-slate-400 block truncate mt-0.5">
                          متن آماده و کم‌هزینه اسامی اعضا جهت کپی و ارسال
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Step 3: Projector & Screen Layout */}
                <div className="bg-slate-950/70 border border-indigo-500/30 rounded-2xl p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-400">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[11px] font-mono font-bold">
                      ۳
                    </span>
                    <span>تنظیمات تصویر روی پرده پروژکتور</span>
                  </div>

                  {/* Fullscreen & Stage Layout */}
                  <div className="space-y-2.5">
                    <button
                      onClick={toggleFullscreen}
                      className="w-full py-2.5 px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4 text-amber-400" /> : <Maximize2 className="w-4 h-4 text-cyan-400" />}
                      <span>{isFullscreen ? 'خروج از حالت تمام‌صفحه' : 'حالت تمام‌صفحه روی پرده پروژکتور (F11)'}</span>
                    </button>

                    {/* Font Scaling */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block mb-1.5">
                        درشتی اندازه قلم برای دید بهتر حضار:
                      </span>
                      <div className="grid grid-cols-3 gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1">
                        <button
                          onClick={() => {
                            sound.playClick();
                            onDisplaySizeChange('normal');
                          }}
                          className={`py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                            displaySize === 'normal' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          عادی
                        </button>
                        <button
                          onClick={() => {
                            sound.playClick();
                            onDisplaySizeChange('projector');
                          }}
                          className={`py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                            displaySize === 'projector' ? 'bg-amber-500 text-slate-950 font-black shadow-sm' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          پروژکتور
                        </button>
                        <button
                          onClick={() => {
                            sound.playClick();
                            onDisplaySizeChange('auditorium');
                          }}
                          className={`py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                            displaySize === 'auditorium' ? 'bg-rose-500 text-white font-black shadow-sm' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          سالن بزرگ
                        </button>
                      </div>
                    </div>

                    {/* Stage Layout Selection */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block mb-1.5">
                        چیدمان صحنه پرده:
                      </span>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          onClick={() => {
                            sound.playClick();
                            onStageLayoutChange('side');
                          }}
                          className={`p-2 rounded-xl border text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            stageLayout === 'side'
                              ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-400'
                              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Columns3 className="w-3.5 h-3.5" />
                          <span>دو ستونه</span>
                        </button>

                        <button
                          onClick={() => {
                            sound.playClick();
                            onStageLayoutChange('stacked');
                          }}
                          className={`p-2 rounded-xl border text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            stageLayout === 'stacked'
                              ? 'border-amber-400 bg-amber-500/20 text-amber-300 ring-1 ring-amber-400'
                              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Rows3 className="w-3.5 h-3.5" />
                          <span>پرده افقی</span>
                        </button>

                        <button
                          onClick={() => {
                            sound.playClick();
                            onStageLayoutChange('focus_roster');
                          }}
                          className={`p-2 rounded-xl border text-[11px] font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                            stageLayout === 'focus_roster'
                              ? 'border-rose-400 bg-rose-500/20 text-rose-300 ring-1 ring-rose-400'
                              : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Maximize className="w-3.5 h-3.5" />
                          <span>تابلوی اسامی</span>
                        </button>
                      </div>
                    </div>

                    {/* Theme & Sound Controls */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => {
                          sound.playClick();
                          onDisplayThemeChange(displayTheme === 'dark-neon' ? 'bright-stage' : 'dark-neon');
                        }}
                        className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {displayTheme === 'dark-neon' ? (
                          <>
                            <Sun className="w-3.5 h-3.5 text-amber-400" />
                            <span>سالن تاریک</span>
                          </>
                        ) : (
                          <>
                            <Moon className="w-3.5 h-3.5 text-cyan-400" />
                            <span>سالن روشن</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={toggleSound}
                        className="py-2 px-3 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSoundMuted ? (
                          <>
                            <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                            <span>صدا: خاموش</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>صدا: فعال</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 4: Sections & Backup */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-400">
                    <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[11px] font-mono font-bold">
                      ۴
                    </span>
                    <span>سایر بخش‌ها و پشتیبان‌گیری</span>
                  </div>

                  {/* Mode switcher tabs */}
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1.5 font-medium">جابجایی به بخش:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          sound.playClick();
                          onModeChange('simple');
                          setIsOperatorPanelOpen(false);
                        }}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all text-center ${
                          mode === 'simple' ? 'bg-cyan-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-300 hover:text-white'
                        }`}
                      >
                        ⚡ یارکشی ساده
                      </button>

                      <button
                        onClick={() => {
                          sound.playClick();
                          onModeChange('advanced');
                          setIsOperatorPanelOpen(false);
                        }}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all text-center ${
                          mode === 'advanced' ? 'bg-indigo-600 text-white font-black' : 'bg-slate-900 text-slate-300 hover:text-white'
                        }`}
                      >
                        🚀 یارکشی پیشرفته
                      </button>

                      {!offline && (
                        <button
                          onClick={() => {
                            sound.playClick();
                            onModeChange('scoring');
                            setIsOperatorPanelOpen(false);
                          }}
                          className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all text-center ${
                            mode === 'scoring' ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-900 text-slate-300 hover:text-white'
                          }`}
                        >
                          🏆 امتیازدهی داوران
                        </button>
                      )}

                      <button
                        onClick={() => {
                          sound.playClick();
                          onModeChange('stage');
                          setIsOperatorPanelOpen(false);
                        }}
                        className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all text-center ${
                          mode === 'stage' ? 'bg-rose-500 text-white font-black' : 'bg-slate-900 text-slate-300 hover:text-white'
                        }`}
                      >
                        📺 استیج نهایی
                      </button>
                    </div>
                  </div>

                  {/* Backup actions */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => {
                        sound.playClick();
                        onDownloadBackup();
                      }}
                      className="py-2 px-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>دانلود پشتیبان</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        fileInputRef.current?.click();
                      }}
                      className="py-2 px-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>بازیابی از فایل</span>
                    </button>

                    {!offline && onImportTeams && (
                      <button
                        onClick={() => {
                          sound.playClick();
                          teamsInputRef.current?.click();
                        }}
                        className="col-span-2 py-2 px-2.5 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 text-emerald-400" />
                        <span>ورود تیم‌ها از فایل آفلاین</span>
                      </button>
                    )}
                  </div>

                  {/* Reset button */}
                  <button
                    onClick={() => {
                      sound.playClick();
                      setShowResetConfirm(true);
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-rose-900/60 bg-rose-950/20 hover:bg-rose-950/40 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                    <span>ریست کامل یارکشی و بازگشت به سالن</span>
                  </button>
                </div>

              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <SyncBadge />
                  <span className="text-[11px]">آفلاین و بلادرنگ</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      sound.playClick();
                      onToggleHeaderHidden();
                      setIsOperatorPanelOpen(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isHeaderHidden ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{isHeaderHidden ? 'نمایش منوی پرده' : 'مخفی‌سازی منو'}</span>
                  </button>

                  <button
                    onClick={() => setIsOperatorPanelOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors cursor-pointer"
                  >
                    بستن پنل
                  </button>
                </div>
              </div>

            </aside>
          </div>
        )}

        {/* Hidden File Input for Backup Restore */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={teamsInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleTeamsFileChange}
        />

        {pendingTeams && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full my-auto shadow-2xl text-right select-none">
              <h3 className="text-base font-black text-white mb-2">ورود تیم‌ها از فایل آفلاین</h3>
              <p className="text-xs text-slate-400 mb-3">
                فقط شرکت‌کنندگان، تیم‌ها و لاگ یارکشی جایگزین می‌شوند؛ رویدادها، داورها و امتیازها دست‌نخورده می‌مانند.
                ({toPersianDigits(pendingTeams.participants.length)} نفر، {toPersianDigits(pendingTeams.teams.length)} تیم)
              </p>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setPendingTeams(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300 cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  onClick={() => {
                    onImportTeams?.(pendingTeams);
                    setPendingTeams(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer"
                >
                  ورود تیم‌ها
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-App Confirmation Modal for Restoring Backup */}
        {pendingRestore && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full my-auto shadow-2xl text-right select-none animate-scaleUp">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">بازیابی اطلاعات از فایل پشتیبان</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تمامی اسامی و تیم‌های فعلی با اطلاعات فایل جایگزین خواهند شد.
                  </p>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5 mb-4">
                <div className="flex justify-between text-slate-300">
                  <span>تعداد شرکت‌کنندگان:</span>
                  <strong className="text-white font-mono">{toPersianDigits(pendingRestore.participants.length)} نفر</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>تعداد تیم‌ها:</span>
                  <strong className="text-white font-mono">{toPersianDigits(pendingRestore.teams.length)} تیم</strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setPendingRestore(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  onClick={() => {
                    sound.playFanfare();
                    onRestoreBackup(pendingRestore);
                    setPendingRestore(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                >
                  بله، بازیابی کن
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-App Error Dialog for Corrupt/Invalid Backup File */}
        {restoreError && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn overflow-y-auto">
            <div className="bg-slate-900 border border-rose-700/80 rounded-2xl p-5 max-w-md w-full my-auto shadow-2xl text-right select-none animate-scaleUp">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">خطا در بازیابی فایل پشتیبان</h3>
                  <p className="text-xs text-rose-300 mt-1 leading-relaxed">{restoreError}</p>
                </div>
              </div>
              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button
                  onClick={() => setRestoreError(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                >
                  متوجه شدم
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-App Confirmation Modal for Reset Draft */}
        {showResetConfirm && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-fadeIn overflow-y-auto">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full my-auto shadow-2xl text-right select-none animate-scaleUp">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">ریست و بازگشت تمام افراد به سالن</h3>
                  <p className="text-xs text-slate-400 mt-0.5">تمام اعضای تیم‌ها خالی شده و به لیست افراد منتظر انتخاب برمی‌گردند.</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  onClick={() => {
                    sound.playWhistle();
                    onResetDraft();
                    setShowResetConfirm(false);
                    setIsOperatorPanelOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition-all cursor-pointer"
                >
                  بله، ریست کن
                </button>
              </div>
            </div>
          </div>
        )}
      </>,
      document.body
    );
  };

  // When Header is Hidden (صفحه پرده کاملاً خلوت و ویژه حضار در سالن)
  if (isHeaderHidden) {
    return (
      <>
        {/* Floating Minimal Operator Trigger (تنها کنترل کوچک در گوشه صفحه) */}
        <div className="fixed top-3 left-3 z-40 flex items-center gap-2 animate-fadeIn">
          <button
            onClick={() => {
              sound.playClick();
              setIsOperatorPanelOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400 text-amber-300 hover:text-amber-200 font-bold text-xs shadow-2xl backdrop-blur-md transition-all cursor-pointer hover:shadow-amber-500/10 group"
            title="میز کار و کنترل پنل اپراتور"
          >
            <Settings className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
            <span className="hidden sm:inline">کنترل پنل اپراتور</span>
          </button>
          
          <button
            onClick={() => {
              sound.playClick();
              onToggleHeaderHidden();
            }}
            className="p-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-400 hover:text-white text-xs shadow-2xl backdrop-blur-md transition-colors cursor-pointer"
            title="نمایش نوار عنوان پرده"
          >
            <Eye className="w-4 h-4" />
          </button>
          <EventNamePill />
        </div>

        {renderModals()}
      </>
    );
  }

  // When Header is Visible (نوار تمیز و آرام بالای صفحه)
  return (
    <header className={`relative z-30 border-b transition-colors select-none ${
      displayTheme === 'dark-neon'
        ? 'bg-slate-950/90 border-slate-850 backdrop-blur-md text-slate-100'
        : 'bg-white border-slate-200 text-slate-900 shadow-sm'
    }`}>
      <div className="max-w-[1920px] mx-auto px-4 py-2 flex items-center justify-between gap-3">
        
        {/* Brand & Event Title */}
        <div className="flex items-center gap-3">
          <img src={geraLogo} alt="گرابرد" className="w-9 h-9 object-contain flex-shrink-0" draggable={false} />
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm sm:text-base font-black tracking-tight text-white">
              گرابرد
            </h1>
            <EventNamePill />
            <span className="text-slate-600 text-sm hidden sm:inline">·</span>
            {/* Live Count */}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
              <span className="text-amber-400 font-mono font-bold">{toPersianDigits(unassignedCount)}</span>
              <span>نفر در سالن</span>
              <span className="text-slate-600">·</span>
              <span className="text-cyan-400 font-mono font-bold">{toPersianDigits(teamsCount)}</span>
              <span>تیم</span>
            </div>
          </div>
        </div>

        {/* Minimal Controls Zone */}
        <div className="flex items-center gap-2">
          {/* Operator Control Panel Trigger */}
          <button
            onClick={() => {
              sound.playClick();
              setIsOperatorPanelOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-400/80 text-amber-300 hover:text-amber-200 text-xs font-black shadow-md transition-all cursor-pointer group"
            title="باز کردن میز کار و ابزارهای اپراتور"
          >
            <Settings className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-45 transition-transform" />
            <span className="hidden sm:inline">کنترل پنل اپراتور</span>
          </button>

          {/* Hide Top Menu for Full Focus */}
          <button
            onClick={() => {
              sound.playClick();
              onToggleHeaderHidden();
            }}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="مخفی کردن منو برای خلوت شدن کامل صفحه پرده"
          >
            <EyeOff className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer hidden sm:flex"
            title={isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه روی پرده'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {renderModals()}
    </header>
  );
};
