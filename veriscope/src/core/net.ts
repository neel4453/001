import type { Settings } from '../types';
import { LIMITS } from '../config';

/**
 * THE network gate. Strict offline mode performs zero external requests:
 * safeFetch is the ONLY fetch path in the app and it refuses before touching
 * the network when the user has selected offline mode.
 */

export class NetworkBlockedError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'NetworkBlockedError';
  }
}

export interface NetResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export function assertOnline(settings: Pick<Settings, 'mode'>): void {
  if (settings.mode !== 'online') {
    throw new NetworkBlockedError(
      'Strict offline mode is active: no external network requests are permitted. Switch to online evidence mode in Settings to retrieve fresh evidence.',
    );
  }
}

export async function safeFetchPost<T = unknown>(
  url: string,
  settings: Pick<Settings, 'mode'>,
  body: unknown,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<NetResult<T>> {
  try {
    assertOnline(settings);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 120000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.headers ?? {}) },
      body: JSON.stringify(body),
      credentials: 'omit',
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, status: res.status };
    return { ok: true, data: (await res.json()) as T, status: res.status };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}

/** The single network door. Everything routes through here so the offline
 *  guarantee is enforced in ONE auditable place (tests prove it). */
export async function gatedFetch(url: string, settings: Pick<Settings, 'mode'>, init: RequestInit = {}, timeoutMs?: number): Promise<Response> {
  assertOnline(settings);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs ?? 120000);
  try {
    return await fetch(url, { credentials: 'omit', redirect: 'follow', ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function safeFetchJson<T = unknown>(
  url: string,
  settings: Pick<Settings, 'mode'>,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<NetResult<T>> {
  try {
    assertOnline(settings);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? LIMITS.autoQueryTimeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(opts.headers ?? {}) },
      credentials: 'omit',
      redirect: 'follow',
    });
    if (!res.ok) {
      const why =
        res.status === 429
          ? 'Rate limited by the public API (free tier). Wait and retry, or use a manual search link.'
          : res.status === 403
            ? 'Access restricted (403). The site may block programmatic access — its terms apply.'
            : res.status >= 500
              ? `Source server error (${res.status}).`
              : `HTTP ${res.status}`;
      return { ok: false, error: why, status: res.status };
    }
    const data = (await res.json()) as T;
    return { ok: true, data, status: res.status };
  } catch (e) {
    const err = e as Error;
    const msg =
      err.name === 'AbortError'
        ? 'Request timed out.'
        : /Failed to fetch|NetworkError|ERR_/i.test(err.message)
          ? 'Network unreachable or blocked (CORS/permission). If you enabled online mode but did not grant host permissions, retrieval is blocked — the manual search links still work.'
          : err.message;
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}
