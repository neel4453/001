import { useCallback, useEffect, useRef, useState } from 'react';
import type { Investigation, Settings } from '../types';
import { loadSettings, saveSettings, takePending, putSaved, deleteSaved } from '../core/storage';

export function useSettings(): [Settings, (patch: Partial<Settings>) => Promise<Settings>] {
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      // first-run side effect handled by options page (welcome tab)
    });
  }, []);
  const update = useCallback(async (patch: Partial<Settings>) => {
    const next = await saveSettings(patch);
    setSettings(next);
    return next;
  }, []);
  return [settings as Settings, update];
}

export function usePendingAction<T>(factory: (p: any) => T | null) {
  const [value, setValue] = useState<T | null>(null);
  const consumed = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const grab = async () => {
      if (consumed.current) return;
      const p = await takePending();
      if (p && !cancelled) {
        consumed.current = true;
        setValue(factory(p));
      }
    };
    grab();
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
        if (area === 'session' && Object.keys(changes).length) grab();
      };
      chrome.storage.onChanged.addListener(listener);
      return () => { cancelled = true; chrome.storage.onChanged.removeListener(listener); };
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [value, setValue] as const;
}

export function useInvestigationStore() {
  const [list, setList] = useState<Investigation[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const { getSaved } = await import('../core/storage');
    setList(await getSaved());
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const save = useCallback(async (inv: Investigation) => { await putSaved(inv); await refresh(); }, [refresh]);
  const remove = useCallback(async (id: string) => { await deleteSaved(id); await refresh(); }, [refresh]);
  return { list, loading, refresh, save, remove };
}

export function useNow(intervalMs = 1000, active = false) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, active]);
  return now;
}
