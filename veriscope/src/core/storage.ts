import { APP } from '../config';
import { DEFAULT_SETTINGS } from '../types';
import type { HistoryEntry, Investigation, PendingAction, Settings } from '../types';
import { hasChromeStorage } from './env';
import { nowIso } from './util';

/**
 * Persistence. Everything lives in chrome.storage.local — the user's own browser.
 * No server, no analytics. Keys are namespaced by the app name so a rename can
 * migrate stored settings safely (legacy prefixes are copied then removed).
 */

const NS = APP.storagePrefix;
export const KEYS = {
  settings: `${NS}/settings`,
  history: `${NS}/history`,
  saved: `${NS}/saved`,
  pending: `${NS}/pending`,
};

interface Backend {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

const memory = new Map<string, unknown>();

function backend(): Backend {
  if (hasChromeStorage()) {
    const s = chrome.storage.local;
    return {
      async get(keys) {
        return (await s.get(keys)) as Record<string, unknown>;
      },
      async set(items) {
        await s.set(items);
      },
      async remove(keys) {
        await s.remove(keys);
      },
    };
  }
  // Dev mode fallback (plain browser via `npm run dev`): in-memory. Not for real use.
  return {
    async get(keys) {
      const out: Record<string, unknown> = {};
      for (const k of keys) if (memory.has(k)) out[k] = memory.get(k);
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) memory.set(k, v);
    },
    async remove(keys) {
      for (const k of keys) memory.delete(k);
    },
  };
}

let migrated: Promise<void> | null = null;
async function migrateLegacyKeys(): Promise<void> {
  const b = backend();
  for (const legacy of APP.legacyPrefixes) {
    const pairs: [string, string][] = [
      [`${legacy}/settings`, KEYS.settings],
      [`${legacy}/history`, KEYS.history],
      [`${legacy}/saved`, KEYS.saved],
    ];
    const items = await b.get(pairs.map((p) => p[0]));
    const toSet: Record<string, unknown> = {};
    const toDel: string[] = [];
    for (const [from, to] of pairs) {
      if (items[from] !== undefined) {
        const current = await b.get([to]);
        if (current[to] === undefined) toSet[to] = items[from];
        toDel.push(from);
      }
    }
    if (Object.keys(toSet).length) await b.set(toSet);
    if (toDel.length) await b.remove(toDel);
  }
}

async function ensureMigrated() {
  if (!migrated) migrated = migrateLegacyKeys().catch(() => undefined);
  return migrated;
}

export async function loadSettings(): Promise<Settings> {
  await ensureMigrated();
  const items = await backend().get([KEYS.settings]);
  const stored = items[KEYS.settings] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const merged = { ...(await loadSettings()), ...patch };
  await backend().set({ [KEYS.settings]: merged });
  return merged;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  await ensureMigrated();
  const items = await backend().get([KEYS.history]);
  return (items[KEYS.history] as HistoryEntry[]) ?? [];
}

export async function getSaved(): Promise<Investigation[]> {
  await ensureMigrated();
  const items = await backend().get([KEYS.saved]);
  return (items[KEYS.saved] as Investigation[]) ?? [];
}

export async function putSaved(inv: Investigation): Promise<void> {
  const all = await getSaved();
  const idx = all.findIndex((x) => x.id === inv.id);
  if (idx >= 0) all[idx] = inv;
  else all.unshift(inv);
  const limit = (await loadSettings()).historyLimit;
  const trimmed = all.slice(0, Math.max(20, limit));
  await backend().set({ [KEYS.saved]: trimmed });
  await refreshHistoryIndex();
}

export async function deleteSaved(id: string): Promise<void> {
  const all = (await getSaved()).filter((x) => x.id !== id);
  await backend().set({ [KEYS.saved]: all });
  await refreshHistoryIndex();
}

export async function clearAllData(): Promise<void> {
  await backend().remove([KEYS.saved, KEYS.history, KEYS.pending]);
}

async function refreshHistoryIndex(): Promise<void> {
  const all = await getSaved();
  const entries: HistoryEntry[] = all.map((i) => ({
    id: i.id,
    at: i.updatedAt || i.createdAt,
    claimText: i.claim.text.slice(0, 240),
    verdict: i.verdict.verdict,
    verdictLabel: i.verdict.label,
    evidenceCount: i.evidence.length,
    mode: i.mode,
  }));
  await backend().set({ [KEYS.history]: entries });
}

/** Cross-page handoff (context menu -> side panel). Uses chrome.storage.session when
 *  available so nothing persists to disk; falls back to memory in dev mode. */
export async function setPending(action: PendingAction): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    await chrome.storage.session.set({ [KEYS.pending]: { ...action, at: nowIso() } });
  } else {
    memory.set(KEYS.pending, action);
  }
}

export async function takePending(): Promise<PendingAction | null> {
  let value: PendingAction | null = null;
  if (typeof chrome !== 'undefined' && chrome.storage?.session) {
    const r = await chrome.storage.session.get([KEYS.pending]);
    value = (r[KEYS.pending] as PendingAction) ?? null;
    if (value) await chrome.storage.session.remove([KEYS.pending]);
  } else {
    value = (memory.get(KEYS.pending) as PendingAction) ?? null;
    memory.delete(KEYS.pending);
  }
  return value;
}

export async function storageUsageBytes(): Promise<number | null> {
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return e.usage ?? null;
    }
  } catch {}
  return null;
}
