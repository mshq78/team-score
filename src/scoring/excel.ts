import * as XLSX from 'xlsx';
import { ScoringEvent, ScoringIndicator } from '../types';

export const SAMPLE_PRESET_EVENTS: ScoringEvent[] = [
  {
    id: 'preset-ev-1',
    name: 'بازی تیمی صبح',
    weight: 1,
    order: 1,
    status: 'upcoming',
    indicators: [
      { id: 'ind-1-1', name: 'کار تیمی', maxScore: 10, weight: 1, order: 1 },
      { id: 'ind-1-2', name: 'سرعت عمل', maxScore: 10, weight: 1, order: 2 },
      { id: 'ind-1-3', name: 'دقت', maxScore: 10, weight: 1, order: 3 },
    ],
  },
  {
    id: 'preset-ev-2',
    name: 'آشپزی و ناهار',
    weight: 1,
    order: 2,
    status: 'upcoming',
    indicators: [
      { id: 'ind-2-1', name: 'طعم', maxScore: 10, weight: 1, order: 1 },
      { id: 'ind-2-2', name: 'ظاهر و سرو', maxScore: 10, weight: 1, order: 2 },
      { id: 'ind-2-3', name: 'نظافت و بهداشت', maxScore: 10, weight: 1, order: 3 },
      { id: 'ind-2-4', name: 'تقسیم کار', maxScore: 10, weight: 1, order: 4 },
      { id: 'ind-2-5', name: 'رعایت زمان', maxScore: 10, weight: 1, order: 5 },
    ],
  },
  {
    id: 'preset-ev-3',
    name: 'بازی فکری / کارگاه',
    weight: 1,
    order: 3,
    status: 'upcoming',
    indicators: [
      { id: 'ind-3-1', name: 'تفکر استراتژیک', maxScore: 10, weight: 1, order: 1 },
      { id: 'ind-3-2', name: 'حل مسئله', maxScore: 10, weight: 1, order: 2 },
      { id: 'ind-3-3', name: 'خلاقیت', maxScore: 10, weight: 1, order: 3 },
      { id: 'ind-3-4', name: 'کار گروهی', maxScore: 10, weight: 1, order: 4 },
    ],
  },
];

/**
 * Downloads a blank Excel template for scoring events & indicators.
 */
export function downloadScoringTemplate(): void {
  const wsData = [
    ['نام رویداد', 'معیار ۱', 'معیار ۲', 'معیار ۳', 'معیار ۴', 'معیار ۵'],
    ['بازی تیمی صبح', 'کار تیمی', 'سرعت عمل', 'دقت', '', ''],
    ['آشپزی و ناهار', 'طعم', 'ظاهر و سرو', 'نظافت و بهداشت', 'تقسیم کار', 'رعایت زمان'],
    ['بازی فکری / کارگاه', 'تفکر استراتژیک', 'حل مسئله', 'خلاقیت', 'کار گروهی', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 25 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '01_Events_Indicators');

  XLSX.writeFile(wb, 'teamkeshi-events-template.xlsx');
}

/**
 * Parses scoring events and indicators from an uploaded Excel file.
 */
export async function parseScoringEventsFromExcel(
  file: File
): Promise<{ events: ScoringEvent[]; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });

    // Look for sheet '01_Events_Indicators' or use the first sheet
    const sheetName =
      wb.SheetNames.find((s) => s.toLowerCase() === '01_events_indicators') ||
      wb.SheetNames[0];

    if (!sheetName) {
      return { events: [], error: 'شیت معتبری در فایل اکسل یافت نشد.' };
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

    if (!rows || rows.length <= 1) {
      return {
        events: [],
        error: 'فایل اکسل خالی است یا داده‌ای در ردیف‌های بعد از سربرگ وجود ندارد.',
      };
    }

    const parsedEvents: ScoringEvent[] = [];
    const timestamp = Date.now().toString(36);

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const rawEventName = row[0];
      const eventName = typeof rawEventName === 'string' ? rawEventName.trim() : String(rawEventName || '').trim();

      // Check if entire row is empty
      const hasAnyValue = row.some((c) => c !== undefined && c !== null && String(c).trim() !== '');
      if (!hasAnyValue) continue;

      if (!eventName) {
        return {
          events: [],
          error: `ردیف ${r + 1} فاقد نام رویداد است (ستون A).`,
        };
      }

      // Collect indicators from columns 1..N
      const indicators: ScoringIndicator[] = [];
      for (let c = 1; c < row.length; c++) {
        const val = row[c];
        if (val !== undefined && val !== null) {
          const indName = String(val).trim();
          if (indName.length > 0) {
            indicators.push({
              id: `ind-${timestamp}-${r}-${c}-${Math.random().toString(36).substring(2, 6)}`,
              name: indName,
              maxScore: 10,
              weight: 1,
              order: indicators.length + 1,
            });
          }
        }
      }

      if (indicators.length === 0) {
        return {
          events: [],
          error: `رویداد «${eventName}» در ردیف ${r + 1} هیچ معیاری ندارد. حداقل یک معیار الزامی است.`,
        };
      }

      parsedEvents.push({
        id: `ev-${timestamp}-${r}-${Math.random().toString(36).substring(2, 6)}`,
        name: eventName,
        weight: 1,
        order: parsedEvents.length + 1,
        status: 'upcoming',
        indicators,
      });
    }

    if (parsedEvents.length === 0) {
      return {
        events: [],
        error: 'هیچ رویداد معتبری از فایل اکسل استخراج نشد.',
      };
    }

    return { events: parsedEvents };
  } catch (err) {
    console.error('Failed to parse excel file:', err);
    return {
      events: [],
      error: 'خطا در خواندن فایل اکسل. لطفاً ساختار قالب اکسل را بررسی کنید.',
    };
  }
}
