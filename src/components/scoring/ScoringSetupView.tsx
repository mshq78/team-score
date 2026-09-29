import React, { useState, useRef } from 'react';
import { ScoringEvent, ScoringIndicator, Judge, EventStatus } from '../../types';
import { AppState } from '../../store/state';
import { AppAction } from '../../store/actions';
import { toPersianDigits } from '../../utils/persian';
import { copyToClipboard } from '../../utils/clipboard';
import { downloadScoringTemplate, parseScoringEventsFromExcel, SAMPLE_PRESET_EVENTS } from '../../scoring/excel';
import { computeStandings } from '../../scoring/compute';
import { EventFormModal } from './EventFormModal';
import { IndicatorFormModal } from './IndicatorFormModal';
import { JudgeFormModal } from './JudgeFormModal';
import { ExcelImportModal } from './ExcelImportModal';
import { JudgeQrModal } from './JudgeQrModal';
import { NewRunModal } from './NewRunModal';
import { RunArchiveModal } from './RunArchiveModal';
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  ChevronUp,
  ChevronDown,
  Upload,
  Download,
  Sparkles,
  Users,
  KeyRound,
  Copy,
  Check,
  Sliders,
  Award,
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Flame,
  PlayCircle,
  FolderArchive,
} from 'lucide-react';

interface ScoringSetupViewProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onShowToast?: (message: string) => void;
}

export const ScoringSetupView: React.FC<ScoringSetupViewProps> = ({ state, dispatch, onShowToast }) => {
  const { events, judges, settings } = state.scoring;

  // Modals state
  const [editingEvent, setEditingEvent] = useState<ScoringEvent | null | 'new'>(null);
  const [editingIndicator, setEditingIndicator] = useState<{
    eventId: string;
    indicator: ScoringIndicator | null;
  } | null>(null);
  const [editingJudge, setEditingJudge] = useState<Judge | null | 'new'>(null);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isNewRunModalOpen, setIsNewRunModalOpen] = useState(false);
  const [isRunArchiveModalOpen, setIsRunArchiveModalOpen] = useState(false);

  // Deletion confirms
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<ScoringEvent | null>(null);
  const [confirmDeleteIndicator, setConfirmDeleteIndicator] = useState<{
    eventId: string;
    indicator: ScoringIndicator;
  } | null>(null);
  const [confirmDeleteJudge, setConfirmDeleteJudge] = useState<Judge | null>(null);

  // Excel import state
  const [importedEvents, setImportedEvents] = useState<ScoringEvent[] | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Copy code feedback
  const [copiedCodeJudgeId, setCopiedCodeJudgeId] = useState<string | null>(null);

  // Calculate total event weights
  const totalEventWeight = events.reduce((sum, e) => sum + (e.weight > 0 ? e.weight : 1), 0);

  // Handlers for Events
  const handleSaveEvent = (data: {
    name: string;
    weight: number;
    status: EventStatus;
    awardTitle?: string;
  }) => {
    if (editingEvent === 'new') {
      const newEvent: ScoringEvent = {
        id: `ev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        name: data.name,
        weight: data.weight,
        status: data.status,
        awardTitle: data.awardTitle,
        order: events.length + 1,
        indicators: [
          {
            id: `ind-${Date.now().toString(36)}-1`,
            name: 'عملکرد کلی',
            maxScore: 10,
            weight: 1,
            order: 1,
          },
        ],
      };
      dispatch({ type: 'ADD_SCORING_EVENT', payload: newEvent });
    } else if (editingEvent) {
      dispatch({
        type: 'UPDATE_SCORING_EVENT',
        payload: {
          id: editingEvent.id,
          ...data,
        },
      });
    }
    setEditingEvent(null);
  };

  const handleDeleteEvent = (eventId: string) => {
    dispatch({ type: 'DELETE_SCORING_EVENT', payload: { eventId } });
    setConfirmDeleteEvent(null);
  };

  const handleStatusChange = (eventId: string, newStatus: EventStatus) => {
    dispatch({
      type: 'UPDATE_SCORING_EVENT',
      payload: { id: eventId, status: newStatus },
    });
  };

  // Handlers for Indicators
  const handleSaveIndicator = (data: { name: string; maxScore: number; weight: number }) => {
    if (!editingIndicator) return;
    const { eventId, indicator } = editingIndicator;

    if (!indicator) {
      // Add new indicator
      const targetEvent = events.find((e) => e.id === eventId);
      const newIndicator: ScoringIndicator = {
        id: `ind-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        name: data.name,
        maxScore: data.maxScore,
        weight: data.weight,
        order: (targetEvent?.indicators.length || 0) + 1,
      };
      dispatch({
        type: 'ADD_SCORING_INDICATOR',
        payload: { eventId, indicator: newIndicator },
      });
    } else {
      // Update indicator
      dispatch({
        type: 'UPDATE_SCORING_INDICATOR',
        payload: {
          eventId,
          indicatorId: indicator.id,
          ...data,
        },
      });
    }
    setEditingIndicator(null);
  };

  const handleDeleteIndicator = (eventId: string, indicatorId: string) => {
    dispatch({
      type: 'DELETE_SCORING_INDICATOR',
      payload: { eventId, indicatorId },
    });
    setConfirmDeleteIndicator(null);
  };

  // Handlers for Judges
  const handleSaveJudge = (judgeData: Judge) => {
    if (editingJudge === 'new') {
      dispatch({ type: 'ADD_JUDGE', payload: judgeData });
    } else {
      dispatch({
        type: 'UPDATE_JUDGE',
        payload: judgeData,
      });
    }
    setEditingJudge(null);
  };

  const handleDeleteJudge = (judgeId: string) => {
    dispatch({ type: 'DELETE_JUDGE', payload: { judgeId } });
    setConfirmDeleteJudge(null);
  };

  const handleCopyCode = async (code: string, judgeId: string) => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopiedCodeJudgeId(judgeId);
      setTimeout(() => setCopiedCodeJudgeId(null), 2000);
    }
  };

  // Preset loading
  const handleLoadPreset = () => {
    dispatch({
      type: 'SET_SCORING_EVENTS',
      payload: { events: SAMPLE_PRESET_EVENTS },
    });
  };

  // Excel file pick
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const res = await parseScoringEventsFromExcel(file);
    if (res.error) {
      setExcelError(res.error);
    } else {
      setImportedEvents(res.events);
      setExcelError(null);
    }
    e.target.value = '';
  };

  const handleApplyExcel = (mode: 'replace' | 'append') => {
    if (!importedEvents) return;
    if (mode === 'replace') {
      dispatch({
        type: 'SET_SCORING_EVENTS',
        payload: { events: importedEvents },
      });
    } else {
      const startingOrder = events.length;
      const reordered = importedEvents.map((ev, idx) => ({
        ...ev,
        order: startingOrder + idx + 1,
      }));
      dispatch({
        type: 'SET_SCORING_EVENTS',
        payload: { events: [...events, ...reordered] },
      });
    }
    setImportedEvents(null);
  };

  // Toggle freeze leaderboard
  const handleToggleFreeze = () => {
    if (settings.leaderboardFrozen) {
      dispatch({ type: 'UNFREEZE_LEADERBOARD' });
    } else {
      const snapshot = computeStandings(state);
      dispatch({ type: 'FREEZE_LEADERBOARD', payload: { snapshot } });
    }
  };

  return (
    <div className="space-y-8 pb-16 text-slate-100">
      {/* Top Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur shadow-lg">
        <div>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <span>تنظیمات و پیکربندی مسابقات و رویدادها</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            تعریف رویدادها، شاخص‌های داوری، ثبت داوران و تنظیم قوانین جدول رده‌بندی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Start New Run Button */}
          <button
            onClick={() => setIsNewRunModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
            title="آرشیو اجرای فعلی و شروع دوره جدید"
          >
            <PlayCircle className="w-4 h-4 text-amber-400" />
            <span>شروع اجرای جدید</span>
          </button>

          {/* Past Runs Archive Button */}
          <button
            onClick={() => setIsRunArchiveModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            title="مشاهده آرشیو دوره‌ها و اجراهای قبلی"
          >
            <FolderArchive className="w-4 h-4 text-cyan-400" />
            <span>آرشیو اجراها</span>
            {state.runs && state.runs.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500 text-slate-950">
                {toPersianDigits(state.runs.length)}
              </span>
            )}
          </button>

          {/* Preset Button */}
          <button
            onClick={handleLoadPreset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer"
            title="بارگذاری نمونه آماده شامل ۳ مسابقه بوت‌کمپی"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>بارگذاری نمونه آماده</span>
          </button>

          {/* Excel Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
            title="ورود رویدادها و شاخص‌ها از فایل اکسل"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>ورود رویدادها از اکسل</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls"
            className="hidden"
          />

          {/* Download Template */}
          <button
            onClick={downloadScoringTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer"
            title="دانلود فایل نمونه اکسل جهت تکمیل"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>دانلود قالب خام اکسل</span>
          </button>

          {/* Add New Event */}
          <button
            onClick={() => setEditingEvent('new')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن رویداد جدید</span>
          </button>
        </div>
      </div>

      {excelError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{excelError}</span>
          </div>
          <button
            onClick={() => setExcelError(null)}
            className="text-xs text-slate-400 hover:text-white"
          >
            بستن
          </button>
        </div>
      )}

      {/* SECTION 1: Events & Indicators */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-sm">
              {toPersianDigits(events.length)}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-200">
                رویدادها و معیارهای ارزیابی (Events & Indicators)
              </h3>
              <p className="text-xs text-slate-400">
                هر رویداد می‌تواند ضریب وزنی خاص خود و چندین معیار امتیازدهی داشته باشد.
              </p>
            </div>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-3">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-400">
              هنوز هیچ رویدادی تعریف نشده است.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleLoadPreset}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-md shadow-indigo-600/20"
              >
                بارگذاری نمونه آماده
              </button>
              <button
                onClick={() => setEditingEvent('new')}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
              >
                تعریف رویداد دستی
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event, eventIdx) => {
              const weight = event.weight > 0 ? event.weight : 1;
              const eventSharePercent =
                totalEventWeight > 0 ? (weight / totalEventWeight) * 100 : 0;
              const totalIndicatorWeight = event.indicators.reduce(
                (sum, i) => sum + (i.weight > 0 ? i.weight : 1),
                0
              );

              return (
                <div
                  key={event.id}
                  className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-lg transition-all"
                >
                  {/* Event Header Bar */}
                  <div className="p-4 sm:p-5 bg-slate-850/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Reorder Buttons */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() =>
                            dispatch({
                              type: 'REORDER_SCORING_EVENTS',
                              payload: { eventId: event.id, direction: 'up' },
                            })
                          }
                          disabled={eventIdx === 0}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                          title="انتقال به بالا"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            dispatch({
                              type: 'REORDER_SCORING_EVENTS',
                              payload: { eventId: event.id, direction: 'down' },
                            })
                          }
                          disabled={eventIdx === events.length - 1}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                          title="انتقال به پایین"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Number badge */}
                      <span className="w-7 h-7 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center font-mono">
                        {toPersianDigits(eventIdx + 1)}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-base text-slate-100">{event.name}</h4>
                          {event.awardTitle && (
                            <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                              <Award className="w-3 h-3 text-amber-400" />
                              <span>{event.awardTitle}</span>
                            </span>
                          )}
                        </div>

                        {/* Weight and Share info */}
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span>
                            ضریب وزن:{' '}
                            <strong className="text-cyan-400 font-mono">
                              {toPersianDigits(event.weight)}
                            </strong>
                          </span>
                          <span>•</span>
                          <span className="bg-slate-800 px-2 py-0.5 rounded-md text-[11px] text-slate-300">
                            سهم از نمره نهایی:{' '}
                            <strong className="text-amber-400 font-mono">
                              {toPersianDigits(eventSharePercent.toFixed(1))}٪
                            </strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center flex-wrap gap-2">
                      {/* 3-State Status Control */}
                      <div className="flex items-center bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
                        <button
                          onClick={() => handleStatusChange(event.id, 'upcoming')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            event.status === 'upcoming'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          پیش‌رو
                        </button>
                        <button
                          onClick={() => handleStatusChange(event.id, 'active')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            event.status === 'active'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          در جریان
                        </button>
                        <button
                          onClick={() => handleStatusChange(event.id, 'closed')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            event.status === 'closed'
                              ? 'bg-slate-700/60 text-slate-300 border border-slate-600'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          بسته‌شده
                        </button>
                      </div>

                      {/* Edit Event */}
                      <button
                        onClick={() => setEditingEvent(event)}
                        className="p-2 rounded-xl text-slate-400 hover:text-cyan-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        title="ویرایش مشخصات رویداد"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      {/* Delete Event */}
                      <button
                        onClick={() => setConfirmDeleteEvent(event)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        title="حذف رویداد"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Indicators Body */}
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                      <span>شاخص‌های ارزیابی این رویداد:</span>
                      <button
                        onClick={() =>
                          setEditingIndicator({
                            eventId: event.id,
                            indicator: null,
                          })
                        }
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن معیار جدید</span>
                      </button>
                    </div>

                    {event.indicators.length === 0 ? (
                      <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
                        این رویداد هیچ معیاری ندارد! لطفاً حداقل یک معیار به آن اضافه کنید.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {event.indicators.map((ind, indIdx) => {
                          const indWeight = ind.weight > 0 ? ind.weight : 1;
                          const indSharePercent =
                            totalIndicatorWeight > 0
                              ? (indWeight / totalIndicatorWeight) * 100
                              : 0;

                          return (
                            <div
                              key={ind.id}
                              className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-mono text-slate-500">
                                    {toPersianDigits(indIdx + 1)}.
                                  </span>
                                  <span className="font-bold text-xs text-slate-200 truncate">
                                    {ind.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                                  <span>
                                    سقف:{' '}
                                    <strong className="text-cyan-400 font-mono">
                                      {toPersianDigits(ind.maxScore)}
                                    </strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    وزن:{' '}
                                    <strong className="text-indigo-400 font-mono">
                                      {toPersianDigits(ind.weight)}
                                    </strong>
                                  </span>
                                  <span>•</span>
                                  <span className="text-amber-400/90 font-mono">
                                    {toPersianDigits(indSharePercent.toFixed(0))}٪
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() =>
                                    dispatch({
                                      type: 'REORDER_SCORING_INDICATORS',
                                      payload: {
                                        eventId: event.id,
                                        indicatorId: ind.id,
                                        direction: 'up',
                                      },
                                    })
                                  }
                                  disabled={indIdx === 0}
                                  className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                                  title="انتقال به قبل"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() =>
                                    dispatch({
                                      type: 'REORDER_SCORING_INDICATORS',
                                      payload: {
                                        eventId: event.id,
                                        indicatorId: ind.id,
                                        direction: 'down',
                                      },
                                    })
                                  }
                                  disabled={indIdx === event.indicators.length - 1}
                                  className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 cursor-pointer"
                                  title="انتقال به بعد"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() =>
                                    setEditingIndicator({
                                      eventId: event.id,
                                      indicator: ind,
                                    })
                                  }
                                  className="p-1 rounded text-slate-400 hover:text-cyan-300 cursor-pointer"
                                  title="ویرایش معیار"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() =>
                                    setConfirmDeleteIndicator({
                                      eventId: event.id,
                                      indicator: ind,
                                    })
                                  }
                                  className="p-1 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                                  title="حذف معیار"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 2: Judges Management */}
      <section className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-sm">
              {toPersianDigits(judges.length)}
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-200">
                مدیریت داوران و کدهای دسترسی (Judges)
              </h3>
              <p className="text-xs text-slate-400">
                کد ۴ رقمی هر داور رمز ورود اختصاصی او به سیستم ثبت نمرات است.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
          <button
            onClick={() => setIsQrOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-all cursor-pointer"
          >
            <span>کارت QR داوران</span>
          </button>
          <button
            onClick={() => setEditingJudge('new')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن داور جدید</span>
          </button>
          </div>
        </div>
        {isQrOpen && <JudgeQrModal judges={judges} onClose={() => setIsQrOpen(false)} />}

        {judges.length === 0 ? (
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">هنوز داوری اضافه نشده است.</p>
            <button
              onClick={() => setEditingJudge('new')}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              + ثبت اولین داور
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {judges.map((judge) => {
              const isAll = judge.eventIds.length === 0;
              const assignedEventNames = isAll
                ? 'همه رویدادها'
                : judge.eventIds
                    .map((id) => events.find((e) => e.id === id)?.name)
                    .filter(Boolean)
                    .join('، ');

              const isCopied = copiedCodeJudgeId === judge.id;

              return (
                <div
                  key={judge.id}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">{judge.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        دسترسی: {assignedEventNames || 'هیچ رویدادی'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingJudge(judge)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800 cursor-pointer"
                        title="ویرایش داور"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteJudge(judge)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
                        title="حذف داور"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Access code card */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs text-slate-400">کد ورود ۴ رقمی:</span>
                      <span className="font-mono font-black text-cyan-400 text-sm tracking-wider">
                        {toPersianDigits(judge.accessCode)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyCode(judge.accessCode, judge.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        isCopied
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                      title="کپی کد دسترسی"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>کپی شد</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400" />
                          <span>کپی</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION 3: Scoring Rules & Settings */}
      <section className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-sm">
            ⚙️
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-slate-200">
              تنظیمات مسابقات و جدول رتبه‌بندی (Scoring Settings)
            </h3>
            <p className="text-xs text-slate-400">
              کنترل فریز جدول، نمایش اسامی داوران و نحوه شکستن تساوی‌ها
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Leaderboard Frozen */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm text-slate-200 flex items-center gap-1.5">
                {settings.leaderboardFrozen ? (
                  <Lock className="w-4 h-4 text-amber-400" />
                ) : (
                  <Unlock className="w-4 h-4 text-slate-400" />
                )}
                <span>توقف جدول (فریز نمرات)</span>
              </span>
              <button
                onClick={handleToggleFreeze}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  settings.leaderboardFrozen
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/25'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {settings.leaderboardFrozen ? 'فریز شده' : 'زنده (آزاد)'}
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              هنگام فریز، آخرین وضعیت رتبه‌بندی ثابت مانده و نمرات جدید داوران در جدول نمایش داده نمی‌شود تا زمان اختتامیه اعلام گردد.
            </p>
          </div>

          {/* 2. Show Judge Names */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm text-slate-200 flex items-center gap-1.5">
                {settings.showJudgeNames ? (
                  <Eye className="w-4 h-4 text-cyan-400" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                )}
                <span>نمایش نام داوران</span>
              </span>
              <button
                onClick={() =>
                  dispatch({
                    type: 'UPDATE_SCORING_SETTINGS',
                    payload: { showJudgeNames: !settings.showJudgeNames },
                  })
                }
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  settings.showJudgeNames
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/25'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {settings.showJudgeNames ? 'نمایش داده شود' : 'مخفی (ناشناس)'}
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              آیا نام اختصاصی هر داور در ریزنمرات و گزارش‌ها به تیم‌ها یا روی پرده نمایش داده شود یا امتیازدهی ناشناس بماند.
            </p>
          </div>

          {/* 3. Tie-breaking rule */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <span className="font-bold text-xs sm:text-sm text-slate-200 block">
              قانون شکستن تساوی رتبه‌ها (Tie Break)
            </span>
            <select
              value={settings.tieBreak}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_SCORING_SETTINGS',
                  payload: {
                    tieBreak: e.target.value as 'most_event_wins' | 'highest_last_event' | 'manual',
                  },
                })
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="most_event_wins">بیشترین برد رویداد (پیش‌فرض)</option>
              <option value="highest_last_event">بالاترین نمره در رویداد پایانی</option>
              <option value="manual">دستی / رتبه مشترک</option>
            </select>
            <p className="text-xs text-slate-400 leading-relaxed">
              در صورت برابری امتیاز نهایی دو تیم، این ملاک برای تفکیک رتبه‌های اول و دوم به کار می‌رود.
            </p>
          </div>

          {/* 4. Announce event awards before overall ranking */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 sm:col-span-2 lg:col-span-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs sm:text-sm text-slate-200 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>اعلام جوایز تک‌رویدادها قبل از رده‌بندی کلی (مراسم پایانی)</span>
              </span>
              <button
                onClick={() =>
                  dispatch({
                    type: 'UPDATE_SCORING_SETTINGS',
                    payload: { announceEventAwardsFirst: !settings.announceEventAwardsFirst },
                  })
                }
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  settings.announceEventAwardsFirst
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/25'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {settings.announceEventAwardsFirst ? 'فعال (اعلام جوایز اختصاصی)' : 'غیرفعال (فقط رده‌بندی کلی)'}
              </button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              در صورت فعال بودن، در مراسم اعلام نتایج روی استیج، ابتدا برنده هر مسابقه بسته‌شده به همراه عنوان جایزه (مانند «بهترین آشپز») معرفی می‌شود و سپس رتبه‌بندی نهایی اعلام خواهد شد.
            </p>
          </div>
        </div>
      </section>

      {/* MODALS */}
      {/* 1. Event Form Modal */}
      {editingEvent && (
        <EventFormModal
          event={editingEvent === 'new' ? null : editingEvent}
          onSave={handleSaveEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}

      {/* 2. Indicator Form Modal */}
      {editingIndicator && (
        <IndicatorFormModal
          indicator={editingIndicator.indicator}
          eventName={
            events.find((e) => e.id === editingIndicator.eventId)?.name || ''
          }
          onSave={handleSaveIndicator}
          onClose={() => setEditingIndicator(null)}
        />
      )}

      {/* 3. Judge Form Modal */}
      {editingJudge && (
        <JudgeFormModal
          judge={editingJudge === 'new' ? null : editingJudge}
          events={events}
          existingJudges={judges}
          onSave={handleSaveJudge}
          onClose={() => setEditingJudge(null)}
        />
      )}

      {/* 4. Excel Import Modal */}
      {importedEvents && (
        <ExcelImportModal
          events={importedEvents}
          existingEventsCount={events.length}
          onApply={handleApplyExcel}
          onClose={() => setImportedEvents(null)}
        />
      )}

      {/* 5. Confirm Delete Event Modal */}
      {confirmDeleteEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">حذف رویداد مسابقه</h4>
                <p className="text-xs text-slate-400">{confirmDeleteEvent.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              آیا از حذف رویداد «{confirmDeleteEvent.name}» مطمئن هستید؟ تمامی معیارها، نمرات و یادداشت‌های ثبت‌شده برای این مسابقه به طور کامل حذف خواهند شد.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDeleteEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                onClick={() => handleDeleteEvent(confirmDeleteEvent.id)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20"
              >
                تأیید و حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Confirm Delete Indicator Modal */}
      {confirmDeleteIndicator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">حذف شاخص داوری</h4>
                <p className="text-xs text-slate-400">
                  {confirmDeleteIndicator.indicator.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              با حذف این شاخص، نمرات ثبت‌شده داوران برای این معیار نیز حذف خواهد شد. ادامه می‌دهید؟
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDeleteIndicator(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                onClick={() =>
                  handleDeleteIndicator(
                    confirmDeleteIndicator.eventId,
                    confirmDeleteIndicator.indicator.id
                  )
                }
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20"
              >
                حذف شاخص
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Confirm Delete Judge Modal */}
      {confirmDeleteJudge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-sm p-5 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100">حذف داور</h4>
                <p className="text-xs text-slate-400">{confirmDeleteJudge.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              با حذف داور «{confirmDeleteJudge.name}»، تمامی امتیازات و نظرات ثبت‌شده توسط ایشان از سامانه حذف خواهد شد. آیا مطمئن هستید؟
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmDeleteJudge(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                انصراف
              </button>
              <button
                onClick={() => handleDeleteJudge(confirmDeleteJudge.id)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white shadow-md shadow-rose-500/20"
              >
                تأیید و حذف داور
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. New Run Modal */}
      <NewRunModal
        isOpen={isNewRunModalOpen}
        onClose={() => setIsNewRunModalOpen(false)}
        state={state}
        dispatch={dispatch}
        onSuccess={(msg) => {
          if (onShowToast) onShowToast(msg);
        }}
      />

      {/* 9. Past Runs Archive Modal */}
      <RunArchiveModal
        isOpen={isRunArchiveModalOpen}
        onClose={() => setIsRunArchiveModalOpen(false)}
        state={state}
        dispatch={dispatch}
        onSuccess={(msg) => {
          if (onShowToast) onShowToast(msg);
        }}
      />
    </div>
  );
};
