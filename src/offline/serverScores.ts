import type { AppState } from '../store/state';
import { validateAndSanitizeBackup } from '../utils/backup';

export const SERVER_URL_KEY = 'teamkeshi_offline_server_url';
export const SERVER_KEY_KEY = 'teamkeshi_offline_server_key';

export type ServerScoresResult = { ok: true; state: AppState } | { ok: false; error: string };

export function normalizeServerUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, '');
  if (url && !/^https?:\/\//i.test(url)) {
    url = (/^(localhost|127\.|192\.168\.|10\.)/.test(url) ? 'http://' : 'https://') + url;
  }
  return url.replace(/\/api$/, '');
}

/** READ-ONLY: a single GET of the operator state. The offline build never writes to the server. */
export async function fetchServerScores(
  rawUrl: string,
  adminKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<ServerScoresResult> {
  const url = normalizeServerUrl(rawUrl);
  if (!url || !adminKey.trim()) return { ok: false, error: 'آدرس سرور و کلید اپراتور را وارد کنید.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetchImpl(`${url}/api/state`, {
      method: 'GET',
      headers: { 'x-admin-key': adminKey.trim() },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (res.status === 401) return { ok: false, error: 'کلید اپراتور نادرست است (۴۰۱).' };
    if (!res.ok) return { ok: false, error: `سرور پاسخ نامعتبر داد (کد ${res.status}).` };
    const data = (await res.json().catch(() => null)) as { state?: unknown } | null;
    if (!data || data.state === null || data.state === undefined) {
      return { ok: false, error: 'هنوز هیچ اطلاعاتی روی سرور ذخیره نشده است (وضعیت سرور خالی است).' };
    }
    const state = validateAndSanitizeBackup(data.state);
    if (!state) return { ok: false, error: 'اطلاعات دریافتی از سرور معتبر نیست.' };
    return { ok: true, state };
  } catch {
    return { ok: false, error: 'اتصال برقرار نشد. اینترنت و آدرس سرور را بررسی کنید.' };
  } finally {
    clearTimeout(timer);
  }
}
