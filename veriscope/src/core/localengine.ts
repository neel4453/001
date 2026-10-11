import type { Settings } from '../types';
import { gatedFetch, safeFetchJson } from './net';

/**
 * Optional local companion engine client (see /local-engine). Bound to localhost,
 * token-authenticated, off by default. All calls are local; strict offline mode
 * still blocks even these (the engine is "installed software", not the network —
 * but the gate keeps behavior predictable and testable).
 */

export interface EngineHealth { reachable: boolean; version?: string; features?: string[]; error?: string }

export async function checkEngine(settings: Settings): Promise<EngineHealth> {
  const base = settings.localEngineUrl.replace(/\/$/, '');
  const r = await safeFetchJson<any>(`${base}/health`, settings, { timeoutMs: 3000, headers: tokenHeaders(settings) });
  if (!r.ok) return { reachable: false, error: r.error ?? 'Local engine unreachable.' };
  return { reachable: true, version: r.data?.version, features: r.data?.features ?? [] };
}

function tokenHeaders(settings: Settings): Record<string, string> {
  const tok = (settings as any).localEngineToken;
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

export async function engineOcr(settings: Settings, file: File): Promise<{ ok: boolean; text?: string; error?: string; warning?: string }> {
  const base = settings.localEngineUrl.replace(/\/$/, '');
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res = await gatedFetch(`${base}/v1/ocr`, settings, { method: 'POST', body: fd, headers: tokenHeaders(settings) }, 180000);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return { ok: false, error: j.detail ?? `Engine returned HTTP ${res.status}` };
    }
    const j = (await res.json()) as any;
    return { ok: true, text: j.text, warning: j.warning ?? 'OCR can misread names, numbers, equations and citations. Treat every extracted number as needing visual verification.' };
  } catch (e) {
    return { ok: false, error: `Local engine unreachable: ${(e as Error).message}` };
  }
}
