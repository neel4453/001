import { useRef, useState } from 'react';
import type { DocumentFinding, ParsedDocument, Settings } from '../../types';
import { Btn, Chip, Glass, SectionTitle, Spinner, useToast } from '../components/ui';
import { parseDocument } from '../../core/documents/parse';
import { analyzeDocument, unsupportedAssertions } from '../../core/documents/checks';
import { runAdapter } from '../../core/adapters';
import { downloadText } from '../../core/export';

import { ClaimInvestigationCard } from '../components/investigation';
import { useWorkbench } from './useWorkbench';

/**
 * Document analysis (§11). Files are read with FileReader in this extension page and
 * parsed LOCALLY (pdfjs / fflate). Nothing is uploaded. Scanned PDFs → OCR via the
 * optional LOCAL engine only, with explicit OCR error caveats.
 */
export function DocsTab({ settings }: { settings: Settings }) {
  const [doc, setDoc] = useState<ParsedDocument | null>(null);
  const [findings, setFindings] = useState<DocumentFinding[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const wb = useWorkbench(settings);

  const handleFile = async (file: File) => {
    setBusy(`Parsing ${file.name}…`);
    setDoc(null); setFindings([]); setOcrNote(null);
    try {
      const buf = await file.arrayBuffer();
      let parsed = await parseDocument(file.name, buf);
      if (parsed.warnings.some((w) => /SCANNED/i.test(w)) && settings.localEngineEnabled) {
        setBusy('Running local OCR via companion engine… (this can take a while)');
        const { engineOcr } = await import('../../core/localengine');
        const r = await engineOcr(settings, file);
        if (r.ok && r.text) {
          parsed = { ...parsed, text: r.text, warnings: [...parsed.warnings, r.warning ?? ''] };
          setOcrNote('Text recovered by LOCAL OCR — numbers, names and citations may be misread; verify visually.');
        } else if (r.error) {
          setOcrNote(`Local OCR failed: ${r.error}`);
        }
      } else if (parsed.warnings.some((w) => /SCANNED/i.test(w))) {
        setOcrNote('Scanned PDF: enable the optional local engine (Settings) for local OCR. Files are never uploaded to any server.');
      }
      setDoc(parsed);
      if (parsed.text.trim()) {
        setBusy('Checking consistency…');
        const doiLookup = settings.mode === 'online' && settings.autoQueries
          ? async (doi: string) => {
              const r = await runAdapter('crossref', doi, settings);
              return { ok: r.ok, found: r.ok && r.docs.length > 0, error: r.error };
            }
          : undefined;
        const f = await analyzeDocument(parsed, { doiLookup });
        setFindings(f);
      }
    } catch (e) {
      toast({ kind: 'error', text: `Parse failed: ${(e as Error).message}` });
    } finally {
      setBusy(null);
    }
  };

  const verifySection = async (span?: { start: number; end: number }) => {
    if (!doc) return;
    const passage = span ? doc.text.slice(Math.max(0, span.start - 40), span.end + 40) : doc.text.slice(0, 60000);
    await wb.verify(passage, { documentName: doc.name, sourceKind: 'document', title: doc.name }, 'page');
  };

  const reportMd = () => {
    if (!doc) return;
    const lines = [
      `# ${doc.name} — ${settings.autoQueries ? 'document check report' : 'document check report'}`,
      '', `Format: ${doc.format} · parsed characters: ${doc.text.length}`,
      '', '## Findings (each requires human review)',
      ...findings.map((f) => `- [${f.kind}/${f.severity}] ${f.message}${f.section ? ` (${f.section})` : ''}`),
      '', '## Unsupported-assertion candidates',
      ...unsupportedAssertions(doc.text).slice(0, 50).map((u) => `- ${u.text} — ${u.why}`),
      '', '---', 'Produced locally by VeriScope. “No finding” ≠ “document verified”; heuristics flag candidates, humans judge.',
    ];
    downloadText(`${doc.name}-report.md`, lines.join('\n'), 'text/markdown');
  };

  return (
    <div className="stack">
      <Glass className="card">
        <SectionTitle right={<Chip>local parsing only — never uploaded</Chip>}>Document analysis</SectionTitle>
        <div
          className="neo-inset"
          style={{ padding: 18, textAlign: 'center', border: drag ? '1px dashed var(--accent)' : undefined, cursor: 'pointer' }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          onClick={() => fileRef.current?.click()}
          role="button" tabIndex={0} aria-label="Choose or drop a document to analyze"
          onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
        >
          {busy ? <Spinner label={busy} /> : (
            <>
              <strong>Drop a document here or click to choose</strong>
              <div className="tiny" style={{ marginTop: 4 }}>PDF (text-layer) · TXT · Markdown · HTML · DOCX · CSV · JSON — parsed on your device</div>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" hidden accept=".pdf,.txt,.md,.markdown,.html,.htm,.docx,.csv,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        {ocrNote && <p className="tiny" style={{ color: 'var(--danger)' }}>{ocrNote}</p>}
        {doc && doc.warnings.map((w, i) => <p key={i} className="tiny">⚠ {w}</p>)}
      </Glass>

      {doc && doc.text.trim() && (
        <>
          <Glass className="card">
            <SectionTitle right={<span className="row">
              <Btn size="sm" onClick={reportMd}>⬇ Export report</Btn>
              <Btn size="sm" variant="ghost" onClick={() => verifySection()}>🔎 Verify key passages</Btn>
            </span>}>
              Findings ({findings.length})
            </SectionTitle>
            {findings.length === 0 && <p className="tiny">No heuristic findings — that means the checks (dates, numbers, duplicates, citations, definitions, ambiguity) found nothing suspicious. It is NOT proof the document is correct or externally supported.</p>}
            <div style={{ maxHeight: 340, overflow: 'auto' }}>
              {findings.map((f) => (
                <div key={f.id} className={`evidence-card relation-${f.severity === 'strong' ? 'contradicts' : f.severity === 'review' ? 'contextualizes' : 'unassessed'}`}>
                  <div className="row between">
                    <Chip tone={f.severity === 'strong' ? 'warn' : ''}>{f.kind}</Chip>
                    <span className="row"><span className="tiny">{f.section ?? ''}</span><Btn size="xs" onClick={() => verifySection(f.span)}>verify span</Btn></span>
                  </div>
                  <p style={{ margin: '4px 0' }}>{f.message}</p>
                  <div className="quote" style={{ maxHeight: 90, overflow: 'auto' }}>{doc.text.slice(f.span.start, Math.min(doc.text.length, f.span.end + 160))}</div>
                </div>
              ))}
            </div>
          </Glass>

          <Glass className="card">
            <SectionTitle>Extracted text ({doc.text.length.toLocaleString()} chars{doc.pages ? ` · ${doc.pages.length} pages` : ''})</SectionTitle>
            <pre className="mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', background: 'var(--surface-2)', padding: 10, borderRadius: 'var(--radius-s)' }}>
              {doc.text.slice(0, 6000)}{doc.text.length > 6000 ? '\n… (preview truncated; analysis used the full parsed text)' : ''}
            </pre>
          </Glass>
        </>
      )}

      {wb.items.map((inv) => (
        <ClaimInvestigationCard
          key={inv.id}
          inv={inv}
          links={wb.links.get(inv.claim.id) ?? []}
          onAssess={(evId, rel) => wb.assess(inv.id, evId, rel)}
          onRemoveEvidence={(evId) => wb.removeEvidence(inv.id, evId)}
          onSave={async () => { await wb.save(inv.id); toast({ kind: 'ok', text: 'Saved.' }); }}
          expandedDefault={wb.items.length <= 2}
        />
      ))}
    </div>
  );
}
