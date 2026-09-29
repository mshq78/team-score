import { BootcampTeam, Participant } from '../types';

export const TEAM_COLOR_PALETTES = [
  {
    id: 'team-1',
    color: '#06b6d4', // cyan-500
    badgeBg: 'bg-cyan-500 text-slate-950 font-black',
    borderColor: 'border-cyan-400 shadow-cyan-500/20',
    textColor: 'text-cyan-400',
    defaultName: 'تیم کوانتوم',
    defaultTable: 'میز ۱',
  },
  {
    id: 'team-2',
    color: '#eab308', // yellow-500
    badgeBg: 'bg-yellow-400 text-slate-950 font-black',
    borderColor: 'border-yellow-400 shadow-yellow-500/20',
    textColor: 'text-yellow-400',
    defaultName: 'تیم سایبر',
    defaultTable: 'میز ۲',
  },
  {
    id: 'team-3',
    color: '#10b981', // emerald-500
    badgeBg: 'bg-emerald-500 text-slate-950 font-black',
    borderColor: 'border-emerald-400 shadow-emerald-500/20',
    textColor: 'text-emerald-400',
    defaultName: 'تیم نکسوس',
    defaultTable: 'میز ۳',
  },
  {
    id: 'team-4',
    color: '#f43f5e', // rose-500
    badgeBg: 'bg-rose-500 text-white font-black',
    borderColor: 'border-rose-400 shadow-rose-500/20',
    textColor: 'text-rose-400',
    defaultName: 'تیم فونیکس',
    defaultTable: 'میز ۴',
  },
  {
    id: 'team-5',
    color: '#a855f7', // purple-500
    badgeBg: 'bg-purple-500 text-white font-black',
    borderColor: 'border-purple-400 shadow-purple-500/20',
    textColor: 'text-purple-400',
    defaultName: 'تیم آپولو',
    defaultTable: 'میز ۵',
  },
  {
    id: 'team-6',
    color: '#f97316', // orange-500
    badgeBg: 'bg-orange-500 text-slate-950 font-black',
    borderColor: 'border-orange-400 shadow-orange-500/20',
    textColor: 'text-orange-400',
    defaultName: 'تیم ماتریکس',
    defaultTable: 'میز ۶',
  },
  {
    id: 'team-7',
    color: '#ec4899', // pink-500
    badgeBg: 'bg-pink-500 text-white font-black',
    borderColor: 'border-pink-400 shadow-pink-500/20',
    textColor: 'text-pink-400',
    defaultName: 'تیم سیناپس',
    defaultTable: 'میز ۷',
  },
  {
    id: 'team-8',
    color: '#38bdf8', // sky-400
    badgeBg: 'bg-sky-400 text-slate-950 font-black',
    borderColor: 'border-sky-300 shadow-sky-500/20',
    textColor: 'text-sky-300',
    defaultName: 'تیم الگوریتم',
    defaultTable: 'میز ۸',
  },
];

export const BOOTCAMP_TEAM_NAMES = [
  'کوانتوم',
  'سایبر',
  'نکسوس',
  'فونیکس',
  'آپولو',
  'ماتریکس',
  'سیناپس',
  'الگوریتم',
  'رادیکال',
  'پرتو',
  'هگزان',
  'کیهان',
  'آلفا',
  'تنسور',
  'پالس',
  'وکتور',
];

export function createInitialBootcampTeams(count = 4): BootcampTeam[] {
  return Array.from({ length: count }, (_, idx) => {
    const palette = TEAM_COLOR_PALETTES[idx % TEAM_COLOR_PALETTES.length];
    return {
      id: `team-${idx + 1}`,
      name: palette.defaultName,
      color: palette.color,
      badgeBg: palette.badgeBg,
      borderColor: palette.borderColor,
      textColor: palette.textColor,
      tableNumber: palette.defaultTable,
      memberIds: [],
      score: 0,
    };
  });
}

export const SAMPLE_BOOTCAMP_PARTICIPANTS: Participant[] = [
  { id: 'p1', name: 'سید محمدرضا میرمحمدصادقی', phone: '09121111111' },
  { id: 'p2', name: 'فاطمه السادات حسینی نسب', phone: '09122222222' },
  { id: 'p3', name: 'امیرحسین ابراهیمی فراهانی', phone: '09123333333' },
  { id: 'p4', name: 'سارا کریمی دهکردی', phone: '09124444444' },
  { id: 'p5', name: 'کیارش پارسا منش' },
  { id: 'p6', name: 'نیلوفر امینی راد' },
  { id: 'p7', name: 'پوریا شجاعی نژاد' },
  { id: 'p8', name: 'زهرا کاظمی پور' },
  { id: 'p9', name: 'علیرضا اسکندری فرد' },
  { id: 'p10', name: 'هستی رحیمی صادق' },
  { id: 'p11', name: 'دانیال فراهانی اصل' },
  { id: 'p12', name: 'فرناز احمدی مطلق' },
  { id: 'p13', name: 'مهرداد رستمی جاوید' },
  { id: 'p14', name: 'یاسمن صادقی بروجردی' },
  { id: 'p15', name: 'آرمین میرزایی نیا' },
  { id: 'p16', name: 'نگین کریمی طاهری' },
  { id: 'p17', name: 'محمدعلی شایان خلیلی' },
  { id: 'p18', name: 'بهناز طاهری مقدم' },
  { id: 'p19', name: 'میلاد مرادی باقرپور' },
  { id: 'p20', name: 'روژین نوری انصاری' },
  { id: 'p21', name: 'سینا انصاری فرد' },
  { id: 'p22', name: 'دنیا صبوری کاشانی' },
  { id: 'p23', name: 'عرفان نامدار حسینی' },
  { id: 'p24', name: 'کیانا رفیعی شمس آبادی' },
];

export const BOOTCAMP_PRESETS: Record<string, { title: string; subtitle: string; names: string[] }> = {
  ai: {
    title: '🤖 بوت‌کمپ هوش مصنوعی و پایتون',
    subtitle: '۲۴ نفر شرکت‌کننده با تخصص‌های دیتا، یادگیری ماشین و برنامه‌نویسی',
    names: [
      'علی رضایی', 'مریم حسینی', 'نوید محمدی', 'سارا ابراهیمی',
      'کیارش پارسا', 'نیلوفر امینی', 'پوریا شجاعی', 'زهرا کاظمی',
      'امیرحسین کرمی', 'هستی رحیمی', 'دانیال فراهانی', 'فرناز احمدی',
      'مهرداد رستمی', 'یاسمن صادقی', 'آرمین میرزایی', 'نگین کریمی',
      'شایان خلیلی', 'بهناز طاهری', 'میلاد مرادی', 'روژین نوری',
      'سینا انصاری', 'دنیا صبوری', 'عرفان نامدار', 'کیانا رفیعی',
    ],
  },
  web: {
    title: '💻 بوت‌کمپ فرانت‌اند و فول‌استک',
    subtitle: '۲۰ نفر توسعه‌دهنده وب برای ساخت پروژه‌های نهایی تیمی',
    names: [
      'امیرعلی ناصری', 'مهسا کمالی', 'پیمان فرهمند', 'صبا جلالی',
      'کامران حیدری', 'نیما فرزانه', 'تینا خسروی', 'بهرام دادخواه',
      'غزاله نادری', 'آیدین صبور', 'الناز عباسی', 'سهیل غفاری',
      'شقایق مهرابی', 'وحید دهقان', 'پردیس مهدوی', 'رضا باقری',
      'فاطمه قنبری', 'بابک شریفی', 'پریا بهرامی', 'کیوان مختاری',
    ],
  },
  product: {
    title: '🎨 بوت‌کمپ طراحی محصول و استارتاپ',
    subtitle: '۱۶ نفر برای هکاتون و چالش ساخت MVP در تیم‌های ۴ نفره',
    names: [
      'سهراب سپهری', 'رویا ملکی', 'سامان پاشا', 'طناز فراهانی',
      'اردوان یوسفی', 'سیمین بهبهانی', 'فرهاد مجیدی', 'مونا صالحی',
      'کسری امانی', 'لیدا شمس', 'همایون ارجمند', 'نسترن معتمد',
      'پویان سلطانی', 'شیوا کرمانی', 'مازیار فرزان', 'سحر یگانه',
    ],
  },
};
