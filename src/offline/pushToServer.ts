import type { AppState } from '../store/state';
import { normalizeServerUrl, type ServerEvent } from './serverScores';

/** Where the offline operator sends its data (saved after the first successful send). The admin key is NOT part of this. */
export interface PushTarget {
  url: string;
  eventId: string;
  eventName: string;
  /** hash of the state that was last sent, to tell whether there are unsent changes */
  sentHash?: string;
  sentAt?: number;
}

export const PUSH_TARGET_KEY = 'teamkeshi_offline_push_target';

export function getPushTarget(): PushTarget | null {
  try {
    const t = JSON.parse(localStorage.getItem(PUSH_TARGET_KEY) || 'null');
    return t && typeof t.url === 'string' && typeof t.eventId === 'string' ? (t as PushTarget) : null;
  } catch {
    return null;
  }
}

export function setPushTarget(t: PushTarget | null): void {
  try {
    if (t) localStorage.setItem(PUSH_TARGET_KEY, JSON.stringify(t));
    else localStorage.removeItem(PUSH_TARGET_KEY);
  } catch {
    // storage unavailable
  }
}

/** Cheap change detector (not cryptographic). */
export function stateHash(state: AppState): string {
  const text = JSON.stringify(state);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}:${(h >>> 0).toString(36)}`;
}

type Fail = { ok: false; error: string };
const OFFLINE_MSG = 'اینترنت یا سرور در دسترس نیست. اطلاعات روی همین دستگاه ذخیره است؛ بعداً دوباره «ارسال به سرور» را بزنید.';

async function call(
  fetchImpl: typeof fetch,
  method: 'PUT' | 'POST',
  url: string,
  adminKey: string,
  body: unknown
): Promise<{ status: number; data: Record<string, unknown> } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetchImpl(url, {
      method,
      headers: { 'x-admin-key': adminKey.trim(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, data };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Creates a new event on the server (operator action). */
export async function createServerEvent(
  rawUrl: string,
  adminKey: string,
  name: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: true; event: ServerEvent } | Fail> {
  const res = await call(fetchImpl, 'POST', `${normalizeServerUrl(rawUrl)}/api/events`, adminKey, { name });
  if (!res) return { ok: false, error: OFFLINE_MSG };
  if (res.status === 401) return { ok: false, error: 'کلید اپراتور نادرست است (۴۰۱).' };
  const event = res.data.event as ServerEvent | undefined;
  if (res.status !== 200 || !event) {
    return { ok: false, error: res.status === 404 ? 'این سرور از چند رویداد پشتیبانی نمی‌کند؛ نسخه‌ی سرور را به‌روز کنید.' : `ساخت رویداد ناموفق بود (کد ${res.status}).` };
  }
  return { ok: true, event };
}

/** Sends the whole state to one event on the server (the server merges it; judges' scores are never erased). */
export async function pushState(
  rawUrl: string,
  adminKey: string,
  eventId: string,
  state: AppState,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: true; rev: number } | Fail> {
  const query = eventId && eventId !== 'default' ? `?event=${encodeURIComponent(eventId)}` : '';
  const res = await call(fetchImpl, 'PUT', `${normalizeServerUrl(rawUrl)}/api/state${query}`, adminKey, { state });
  if (!res) return { ok: false, error: OFFLINE_MSG };
  if (res.status === 200) return { ok: true, rev: Number(res.data.rev) || 0 };
  if (res.status === 401) return { ok: false, error: 'کلید اپراتور نادرست است (۴۰۱).' };
  if (res.status === 409) return { ok: false, error: 'روی سرور «اجرای» جدیدتری از این رویداد هست؛ ارسال انجام نشد تا چیزی روی سرور خراب نشود.' };
  if (res.status === 404) return { ok: false, error: 'این رویداد روی سرور پیدا نشد.' };
  if (res.status === 413) return { ok: false, error: 'حجم اطلاعات برای ارسال زیاد است.' };
  return { ok: false, error: `سرور پاسخ نامعتبر داد (کد ${res.status}).` };
}
