import { useCallback, useRef, useState } from 'react';
import type { EvidenceRecord, Investigation, Settings } from '../../types';
import type { SearchLink } from '../../core/searchlinks';
import { verifyPassage, rerunInvestigation, type VerifyRequest } from '../../core/verify';
import { computeVerdict } from '../../core/verdicts';
import { markDuplicates } from '../../core/evidence';
import { loadRegistry } from '../../core/registry';
import { independenceKey } from '../../core/evidence';
import { nowIso, uid } from '../../core/util';
import { putSaved } from '../../core/storage';

/**
 * Workbench: live investigation state for the side panel. Persists only when the
 * user saves. All transitions append to the change log (spec: no silent edits).
 */
export function useWorkbench(settings: Settings) {
  const [items, setItems] = useState<Investigation[]>([]);
  const [links, setLinks] = useState<Map<string, SearchLink[]>>(new Map());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ step: string; done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<{ adapter: string; ok: boolean; error?: string; note?: string; count: number }[]>([]);
  const cancelRef = useRef(false);

  const verify = useCallback(async (
    passage: string,
    extra: Partial<VerifyRequest> = {},
    mode: VerifyRequest['mode'] = 'single-claim',
  ) => {
    if (!settings) return;
    setBusy(true); setError(null); cancelRef.current = false;
    try {
      const outcome = await verifyPassage(
        { passage, mode, sourceKind: extra.sourceKind ?? 'manual', settings, ...extra },
        (p) => { if (cancelRef.current) throw new Error('cancelled'); setProgress(p); },
      );
      setItems(outcome.investigations);
      setLinks(outcome.searchLinksByClaim);
      setReports(outcome.adapterReports);
      if (outcome.droppedClaims) setError(`Processing stopped after ${outcome.claims.length} claims (long input). Remaining text was skipped, not judged.`);
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg === 'cancelled' ? 'Verification cancelled. Partial results were discarded.' : `Verification failed: ${msg}`);
    } finally {
      setBusy(false); setProgress(null);
    }
  }, [settings]);

  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  const patch = useCallback((invId: string, fn: (inv: Investigation) => Investigation) => {
    setItems((list) => list.map((i) => (i.id === invId ? { ...fn(i), updatedAt: nowIso() } : i)));
  }, []);

  const assess = useCallback((invId: string, evId: string, relation: EvidenceRecord['relation']) => {
    patch(invId, (inv) => {
      const evidence = markDuplicates(
        inv.evidence.map((e) => (e.id === evId ? { ...e, relation, relationSetBy: 'user' as const } : e)),
      );
      const verdict = computeVerdict({
        claim: inv.claim,
        evidence,
        sourceTypeById: new Map(loadRegistry().sources.map((s) => [s.id, s])),
        mode: inv.mode,
        attemptedSources: inv.verdict.retrievedCount || evidence.filter((e) => e.origin === 'automatic').length,
        accessedSources: inv.verdict.retrievedCount,
        blockedReasons: [],
      });
      return {
        ...inv, evidence, verdict,
        status: 'verdict-proposed',
        changeLog: [...inv.changeLog, { at: nowIso(), what: `User marked evidence “${evidence.find((e) => e.id === evId)?.title ?? evId}” as ${relation}; verdict recomputed → ${verdict.label}` }],
      };
    });
  }, [patch]);

  const addEvidence = useCallback((invId: string, v: { url: string; title: string; snippet: string; publishedAt: string }) => {
    patch(invId, (inv) => {
      let domain = 'manual';
      try { domain = new URL(v.url).hostname; } catch { /* validated upstream */ }
      const rec: EvidenceRecord = {
        id: uid('ev'), claimId: inv.claim.id, publisher: domain, domain,
        title: v.title, url: v.url, snippet: v.snippet || undefined,
        publishedAt: /^\d{4}(-\d{2}-\d{2})?$/.test(v.publishedAt) ? v.publishedAt : undefined,
        accessedAt: nowIso(), origin: 'user-added', relation: 'unassessed', relationSetBy: null,
        independenceKey: independenceKey(v.url),
        notes: 'Added by the user from a manual search.',
      };
      const evidence = markDuplicates([...inv.evidence, rec]);
      return { ...inv, evidence, status: 'evidence-gathered', changeLog: [...inv.changeLog, { at: nowIso(), what: `User added source “${v.title}” (unassessed)` }] };
    });
  }, [patch]);

  const removeEvidence = useCallback((invId: string, evId: string) => {
    patch(invId, (inv) => ({
      ...inv,
      evidence: markDuplicates(inv.evidence.filter((e) => e.id !== evId)),
      changeLog: [...inv.changeLog, { at: nowIso(), what: `User removed evidence item ${evId}` }],
    }));
  }, [patch]);

  const annotate = useCallback((invId: string, note: string) => {
    patch(invId, (inv) => ({ ...inv, annotations: [...inv.annotations, `${new Date().toISOString().slice(0, 16)} — ${note}`], changeLog: [...inv.changeLog, { at: nowIso(), what: 'User added an annotation' }] }));
  }, [patch]);

  const flag = useCallback((invId: string, reason: string) => {
    patch(invId, (inv) => ({
      ...inv, status: 'user-flagged',
      userFlag: { reason, at: nowIso() },
      changeLog: [...inv.changeLog, { at: nowIso(), what: `User flagged verdict as questionable: ${reason}` }],
    }));
  }, [patch]);

  const recheck = useCallback(async (invId: string) => {
    const inv = items.find((i) => i.id === invId);
    if (!inv) return;
    setBusy(true); setError(null);
    try {
      const { investigation, links: newLinks } = await rerunInvestigation(inv, settings);
      setItems((list) => list.map((i) => (i.id === invId ? investigation : i)));
      setLinks((m) => new Map(m).set(investigation.claim.id, newLinks));
    } catch (e) {
      setError(`Re-check failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [items, settings]);

  const save = useCallback(async (invId: string) => {
    const inv = items.find((i) => i.id === invId);
    if (!inv) return;
    await putSaved({ ...inv, changeLog: [...inv.changeLog, { at: nowIso(), what: 'Saved by user' }] });
  }, [items]);

  return { items, setItems, links, busy, progress, error, reports, verify, cancel, assess, addEvidence, removeEvidence, annotate, flag, recheck, save };
}
