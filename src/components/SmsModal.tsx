import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  Copy, 
  Check, 
  Download, 
  Send, 
  Phone, 
  AlertCircle
} from 'lucide-react';
import { BootcampTeam, Participant } from '../types';
import { 
  calculateSmsParts, 
  generateTeamSms, 
  generateAllTeamsSmsBatch, 
  exportToTextFile, 
  toPersianDigits 
} from '../utils/persian';
import { copyTextToClipboard } from '../utils/clipboard';
import { sound } from '../utils/sound';

interface SmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teams: BootcampTeam[];
  teamMembersMap: Map<string, Participant[]>;
  onUpdateParticipantPhone: (participantId: string, phone: string) => void;
  selectedTeamId?: string | null;
  initialFormat?: 'ultra_cheap' | 'compact' | 'standard' | 'result';
  resultsMap?: Record<string, { rank: number; totalTeams: number; grandTotal: number }>;
}

export const SmsModal: React.FC<SmsModalProps> = ({
  isOpen,
  onClose,
  teams,
  teamMembersMap,
  onUpdateParticipantPhone,
  selectedTeamId = null,
  initialFormat = 'ultra_cheap',
  resultsMap,
}) => {
  const [format, setFormat] = useState<'ultra_cheap' | 'compact' | 'standard' | 'result'>(initialFormat);
  const [bootcampName, setBootcampName] = useState('بوت‌کمپ');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Sync format if initialFormat changes
  React.useEffect(() => {
    if (initialFormat) {
      setFormat(initialFormat);
    }
  }, [initialFormat]);

  if (!isOpen) return null;

  const handleCopyText = async (text: string, id: string) => {
    sound.playClick();
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedId(id);
      setCopyError(null);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopyError('خطا در کپی متن در حافظه');
      setTimeout(() => setCopyError(null), 3000);
    }
  };

  const handleCopyBatch = async () => {
    sound.playClick();
    const batch = generateAllTeamsSmsBatch(teams, teamMembersMap, format, bootcampName, resultsMap);
    const ok = await copyTextToClipboard(batch);
    if (ok) {
      setCopiedBatch(true);
      setCopyError(null);
      setTimeout(() => setCopiedBatch(false), 2000);
    } else {
      setCopyError('خطا در کپی متن در حافظه');
      setTimeout(() => setCopyError(null), 3000);
    }
  };

  const handleDownloadFile = () => {
    sound.playFanfare();
    const batch = generateAllTeamsSmsBatch(teams, teamMembersMap, format, bootcampName, resultsMap);
    exportToTextFile(batch, `bootcamp-teams-sms-${format}.txt`);
  };

  const openPhoneSmsApp = (phone: string, text: string) => {
    sound.playClick();
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(text);
    window.location.href = `sms:${cleanPhone}?body=${encoded}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  سامانه پیامک فوق‌خلاصه و کم‌هزینه سرگروه‌ها
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                  کاهش هزینه پیامک 💰
                </span>
              </div>
              <p className="text-xs text-slate-400">
                تولید پیامک بهینه‌شده به تفکیک هر تیم برای ارسال مستقیم به سرگروه‌ها
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

        {/* Format Selector Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          {/* Format Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-700/80">
            <button
              onClick={() => {
                sound.playClick();
                setFormat('ultra_cheap');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                format === 'ultra_cheap'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🚀 فوق‌فشرده (کمترین کاراکتر)
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setFormat('compact');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                format === 'compact'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📝 فشرده و مرتب (۲ پیامک)
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setFormat('standard');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                format === 'standard'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📋 رسمی و کامل
            </button>
            <button
              onClick={() => {
                sound.playClick();
                setFormat('result');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                format === 'result'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🏆 نتیجه مسابقات (رتبه و نمره)
            </button>
          </div>

          {/* Title input */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">عنوان رویداد:</span>
            <input
              type="text"
              value={bootcampName}
              onChange={(e) => setBootcampName(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-bold w-32"
            />
          </div>
        </div>

        {/* Global Action Bar: Copy All / Download All */}
        <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-400">
            <span>تعداد کل تیم‌ها: <strong className="text-white">{toPersianDigits(teams.length)} تیم</strong></span>
            {copyError && (
              <span className="mr-3 text-rose-400 font-bold flex items-center gap-1 inline-flex">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{copyError}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyBatch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 transition-colors font-bold cursor-pointer"
            >
              {copiedBatch ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">کل پیامک‌ها کپی شد!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>کپی یکجای کل تیم‌ها (برای سامانه پیامک انبوه)</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadFile}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold transition-colors shadow-md shadow-cyan-600/20 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>دانلود فایل متنی</span>
            </button>
          </div>
        </div>

        {/* Teams List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {teams.map((team) => {
            const members = teamMembersMap.get(team.id) || [];
            const leader = members[0];
            const leaderPhone = leader?.phone || '';
            const resInfo = resultsMap ? resultsMap[team.id] : undefined;
            const smsText = generateTeamSms(team, members, format, bootcampName, resInfo);
            const { length, parts, isUnderOnePart } = calculateSmsParts(smsText);
            const isTargeted = selectedTeamId === team.id;

            return (
              <div 
                key={team.id}
                className={`rounded-2xl border transition-all p-4 ${
                  isTargeted
                    ? 'bg-slate-850 border-cyan-400 ring-2 ring-cyan-400/30'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Team Info Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: team.color }}
                    />
                    <h4 className="text-base font-black text-white">
                      {team.name}
                    </h4>
                    <span className="text-xs text-slate-400">
                      (سرگروه: <strong className="text-amber-300 font-bold">{leader ? leader.name : 'هنوز انتخاب نشده'}</strong>)
                    </span>
                  </div>

                  {/* Character & Part Counter Badge */}
                  <div className="flex items-center gap-2 text-xs font-mono font-bold">
                    <span className="text-slate-400">
                      طول متن: <span className="text-white">{toPersianDigits(length)}</span> کاراکتر
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full border ${
                      isUnderOnePart
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : parts === 2
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    }`}>
                      {toPersianDigits(parts)} پارت پیامک {isUnderOnePart ? '✅ (حداقل هزینه)' : ''}
                    </span>
                  </div>
                </div>

                {/* Leader Phone Input */}
                <div className="flex items-center gap-2 mb-3 bg-slate-950/60 p-2 rounded-xl border border-slate-800">
                  <Phone className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-slate-400">شماره موبایل سرگروه:</span>
                  <input
                    type="text"
                    dir="ltr"
                    value={leaderPhone}
                    disabled={!leader}
                    onChange={(e) => {
                      if (leader) {
                        onUpdateParticipantPhone(leader.id, e.target.value);
                      }
                    }}
                    placeholder={leader ? "مثلاً: 09121234567" : "ابتدا سرگروه تعیین کنید"}
                    className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono w-40 disabled:opacity-50"
                  />
                  <span className="text-[11px] text-slate-500 mr-auto">
                    {leaderPhone ? 'آماده ارسال' : 'وارد کردن شماره برای ارسال مستقیم ضروری است'}
                  </span>
                </div>

                {/* SMS Text Preview */}
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 font-mono text-xs text-slate-200 whitespace-pre-wrap select-all leading-relaxed">
                  {smsText}
                </div>

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>💡 هر پیامک فارسی تا ۷۰ کاراکتر ۱ صفحه محاسبه می‌شود.</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Copy Button */}
                    <button
                      onClick={() => handleCopyText(smsText, team.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
                    >
                      {copiedId === team.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">کپی شد!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>کپی متن</span>
                        </>
                      )}
                    </button>

                    {/* Direct SMS Button */}
                    <button
                      onClick={() => openPhoneSmsApp(leaderPhone, smsText)}
                      disabled={!leaderPhone}
                      className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
                      title={leaderPhone ? 'باز کردن نرم‌افزار پیامک گوشی برای ارسال' : 'لطفاً ابتدا شماره موبایل را وارد کنید'}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>ارسال پیامک با گوشی</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Batch Operations */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            <span>مجموع تیم‌ها: <strong className="text-white font-mono">{toPersianDigits(teams.length)}</strong> تیم</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownloadFile}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-cyan-400" />
              <span>دانلود فایل متنی (.txt)</span>
            </button>

            <button
              onClick={handleCopyBatch}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              {copiedBatch ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>متن تمام تیم‌ها کپی شد!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>کپی یکجای متن همه تیم‌ها (ویژه پنل پیامک)</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
