import React, { useMemo, useState } from 'react';
import type { EvidenceRecord, Investigation, RelationSuggestion, VerdictResult } from '../../types';
import { Btn, Chip, Glass, VerdictBadge, openTab } from './ui';
import { buildQuery } from '../../core/searchlinks';

export type SearchLinkLike = {
  sourceId: string; name: string; url: string; kind: 'search-page' | 'homepage';
  performed: false; verifiedTemplate: boolean; note?: string;
};

/* ---------------- evidence card ---------------- */
export function EvidenceCard({
  ev, onAssess, onRemove, onNote,
}: {
  ev: EvidenceRecord;
  onAssess?: (relation: EvidenceRecord['relation']) => void;
  onRemove?: () => void;
  onNote?: () => void;
}) {
  const [showSug, setShowSug] = useState(false);
  const sug: RelationSuggestion | undefined = ev.relationSuggestion;
  return (
    <div className={`evidence-card relation-${ev.relation}`} data-testid="evidence-card">
      <div className="row between">
        <strong>{ev.title || '(untitled source)'}</strong>
        <Chip tone={ev.duplicateOf ? 'warn' : ''}>{ev.duplicateOf ? 'duplicate of another source' : ev.independenceKey}</Chip>
      </div>
      <div className="tiny" style={{ margin: '2px 0 6px' }}>
        {ev.publisher} · {ev.origin}
        {ev.publishedAt ? ` · published ${ev.publishedAt}` : ' · publication date unknown'}
        {` · accessed ${new Date(ev.accessedAt).toLocaleString()}`}
      </div>
      {ev.snippet && <div className="quote" lang="en">{ev.snippet}</div>}
      {ev.notes && <p className="tiny" style={{ color: 'var(--danger)' }}>{ev.notes}</p>}
      {sug && (
        <div className="tiny" style={{ marginBottom: 4 }}>
          Machine suggestion (provisional): <button className="btn-ghost btn-xs" style={{ border: 'none', padding: 0, color: 'var(--accent)' }} onClick={() => setShowSug((s) => !s)} aria-expanded={showSug}>
            {sug.relation}{showSug ? ' ▴' : ' ▾'}
          </button>
          {showSug && <div className="quote">{sug.reason}</div>}
        </div>
      )}
      <div className="row" style={{ marginTop: 6 }}>
        <a href={ev.url} target="_blank" rel="noreferrer noopener" onClick={(e) => { e.preventDefault(); openTab(ev.url); }}>Open original source ↗</a>
        {onAssess && (
          <span className="row" style={{ gap: 4, marginLeft: 'auto' }}>
            <span className="tiny">Mark as:</span>
            <Btn size="xs" onClick={() => onAssess('supports')} aria-pressed={ev.relation === 'supports' && ev.relationSetBy === 'user'}>Supports</Btn>
            <Btn size="xs" onClick={() => onAssess('contradicts')} aria-pressed={ev.relation === 'contradicts' && ev.relationSetBy === 'user'}>Contradicts</Btn>
            <Btn size="xs" onClick={() => onAssess('contextualizes')} aria-pressed={ev.relation === 'contextualizes' && ev.relationSetBy === 'user'}>Context</Btn>
          </span>
        )}
        {onNote && <Btn size="xs" variant="ghost" onClick={onNote}>Note</Btn>}
        {onRemove && <Btn size="xs" variant="ghost" onClick={onRemove} aria-label="Remove this source">Remove</Btn>}
      </div>
      {ev.relationSetBy === 'user' && <div className="tiny" style={{ marginTop: 4 }}>✓ Relation assessed by you.</div>}
    </div>
  );
}

/* ---------------- search links block ---------------- */
export function SearchLinks({ links }: { links: SearchLinkLike[] }) {
  const [open, setOpen] = useState(false);
  if (!links.length) return null;
  return (
    <div className="neo-inset" style={{ padding: 10, borderRadius: 'var(--radius-m)', marginTop: 8 }}>
      <button className="btn-ghost" style={{ border: 'none', padding: 0, font: 'inherit', color: 'var(--text-0)', fontWeight: 650, cursor: 'pointer' }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? '▾' : '▸'} Manual searches ({links.length}) — <span style={{ color: 'var(--danger)', fontWeight: 600 }}>not yet performed</span>
      </button>
      <p className="tiny">
        The extension did <strong>not</strong> run these searches. Each link opens the source’s own search page; findings become evidence only when you add them.
      </p>
      {open && (
        <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
          {links.map((l) => (
            <li key={l.sourceId + l.url} style={{ marginBottom: 4 }}>
              <a href={l.url} onClick={(e) => { e.preventDefault(); openTab(l.url); }} target="_blank" rel="noreferrer noopener">{l.name}</a>{' '}
              <Chip>{l.kind === 'homepage' ? 'homepage' : 'search page'}</Chip>
              {l.verifiedTemplate ? null : <span className="tiny"> (URL pattern not live-verified)</span>}
              {l.note ? <div className="tiny">{l.note}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- verdict & confidence ---------------- */
export function VerdictPanel({ v, onRecheck, onFlag }: { v: VerdictResult; onRecheck?: () => void; onFlag?: () => void }) {
  return (
    <div>
      <div className="row between" style={{ gap: 8 }}>
        <VerdictBadge verdict={v.verdict} label={v.label} />
        <Chip>confidence: {v.confidence.band} ({v.confidence.score}/1)</Chip>
      </div>
      <p style={{ margin: '8px 0' }}>{v.explanation}</p>
      <div className="progress" aria-hidden="true" style={{ marginBottom: 6 }}>
        <div style={{ width: `${Math.round(v.confidence.score * 100)}%` }} />
      </div>
      <details>
        <summary className="tiny" style={{ cursor: 'pointer' }}>Why this confidence? (factors — this is an explainable weighting, not a calibrated probability)</summary>
        <ul className="tiny" style={{ paddingLeft: 16 }}>
          {v.confidence.factors.map((f) => (
            <li key={f.name}><strong>{f.name}</strong> {Math.round(f.value * 100)}% — {f.explanation}</li>
          ))}
        </ul>
        <p className="tiny">{v.confidence.note}</p>
      </details>
      {v.manualOnly && (
        <p className="tiny" style={{ color: 'var(--danger)' }}>
          No automated retrieval happened for this claim — verdicts are based only on local analysis and any sources you add.
        </p>
      )}
      {v.caveats.length > 0 && (
        <ul className="tiny" style={{ paddingLeft: 16, color: 'var(--text-1)' }}>
          {v.caveats.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      )}
      <div className="row" style={{ marginTop: 6 }}>
        {onRecheck && <Btn size="sm" onClick={onRecheck}>↻ Re-check evidence</Btn>}
        {onFlag && <Btn size="sm" variant="ghost" onClick={onFlag}>⚑ Report an issue with this verdict</Btn>}
      </div>
    </div>
  );
}

/* ---------------- claim card (single claim, full workflow) ---------------- */
export function ClaimInvestigationCard({
  inv, links, onAssess, onRemoveEvidence, onAddEvidence, onAnnotate, onRecheck, onFlag, onSave, expandedDefault = true,
}: {
  inv: Investigation;
  links: SearchLinkLike[];
  onAssess?: (evId: string, relation: EvidenceRecord['relation']) => void;
  onRemoveEvidence?: (evId: string) => void;
  onAddEvidence?: () => void;
  onAnnotate?: () => void;
  onRecheck?: () => void;
  onFlag?: () => void;
  onSave?: () => void;
  expandedDefault?: boolean;
}) {
  const [expanded, setExpanded] = useState(expandedDefault);
  const q = useMemo(() => buildQuery(inv.claim), [inv.claim]);
  return (
    <Glass className="card claim-card" data-testid="claim-card">
      <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="row" style={{ gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <Chip tone="accent">{inv.claim.kind}</Chip>
            {inv.claim.isQuotation && <Chip>quotation</Chip>}
            {inv.claim.contextMissing.map((m) => <Chip key={m} tone="warn">missing: {m}</Chip>)}
            {inv.source.documentRef && <Chip>{inv.source.documentRef}</Chip>}
            {inv.userFlag && <Chip tone="warn">user-flagged verdict</Chip>}
          </div>
          <div className="claim-text">“{inv.claim.text}”</div>
          {inv.originalClaimText !== inv.claim.text && (
            <p className="tiny">Original wording preserved separately; edits are annotations, never silent rewrites.</p>
          )}
        </div>
        <Btn size="sm" variant="ghost" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
          {expanded ? 'Collapse ▴' : 'Evidence ▾'}
        </Btn>
      </div>

      <div style={{ margin: '10px 0' }}>
        <VerdictPanel v={inv.verdict} onRecheck={onRecheck} onFlag={onFlag} />
      </div>

      {expanded && (
        <>
          {inv.claim.originalPassage && inv.claim.spans[0] && (
            <PassageRef passage={inv.claim.originalPassage} start={inv.claim.spans[0].start} end={inv.claim.spans[0].end} />
          )}
          <SectionTitleInline>
            Evidence ({inv.evidence.length})
            {onAddEvidence && <Btn size="xs" onClick={onAddEvidence}>+ Add source</Btn>}
          </SectionTitleInline>
          {inv.evidence.length === 0 && (
            <p className="tiny">Nothing added yet. Open a manual search below, find a passage that addresses the claim, then “Add source” with its URL — that becomes assessable evidence.</p>
          )}
          {inv.evidence.map((ev) => (
            <EvidenceCard
              key={ev.id}
              ev={ev}
              onAssess={onAssess && ((rel) => onAssess(ev.id, rel))}
              onRemove={onRemoveEvidence && (() => onRemoveEvidence(ev.id))}
            />
          ))}
          <SearchLinks links={links} />
          <div className="row" style={{ marginTop: 8 }}>
            <Btn size="sm" onClick={() => openTab(`https://duckduckgo.com/?q=${encodeURIComponent(q)}`)}>Search the web (opens DuckDuckGo)</Btn>
            {onAnnotate && <Btn size="sm" variant="ghost" onClick={onAnnotate}>✎ Annotate</Btn>}
            {onSave && <Btn size="sm" variant="ghost" onClick={onSave}>💾 Save investigation</Btn>}
          </div>
          {inv.annotations.length > 0 && (
            <div className="tiny" style={{ marginTop: 6 }}>
              {inv.annotations.map((a, i) => <div key={i}>✎ {a}</div>)}
            </div>
          )}
        </>
      )}
    </Glass>
  );
}

function SectionTitleInline({ children }: { children: React.ReactNode }) {
  return <div className="row between" style={{ margin: '8px 0 4px' }}><h4 style={{ margin: 0 }}>{children}</h4></div>;
}

function PassageRef({ passage, start, end }: { passage: string; start: number; end: number }) {
  const [show, setShow] = useState(false);
  const from = Math.max(0, start - 90);
  const to = Math.min(passage.length, end + 90);
  return (
    <div className="tiny" style={{ marginBottom: 6 }}>
      <button className="btn-ghost btn-xs" style={{ border: 'none', padding: 0, color: 'var(--accent)', background: 'none', cursor: 'pointer', font: 'inherit' }} onClick={() => setShow((s) => !s)} aria-expanded={show}>
        {show ? '▾' : '▸'} page context
      </button>
      {show && (
        <div className="quote">
          …{passage.slice(from, start)}
          <mark style={{ background: 'color-mix(in srgb, var(--accent) 30%, transparent)', color: 'inherit', padding: '0 2px', borderRadius: 3 }}>{passage.slice(start, end)}</mark>
          {passage.slice(end, to)}…
        </div>
      )}
    </div>
  );
}

export function AddEvidenceModal({ onSubmit, onClose }: { onSubmit: (v: { url: string; title: string; snippet: string; publishedAt: string }) => void; onClose: () => void; }) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [snippet, setSnippet] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const valid = /^https?:\/\//.test(url) && title.trim().length > 1;
  return (
    <div className="stack">
      <p className="tiny">You personally verified this source while following a search link (or already had it). Add its address, the exact relevant passage, and — if visible — the publication date. VeriScope never invents sources; this is YOUR evidence record.</p>
      <label>URL (https only)
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.org/report#section" />
      </label>
      <label>Title / short name
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ministry report, Feb 2024 press release, …" />
      </label>
      <label>Exact relevant passage (copy from the source)
        <textarea value={snippet} onChange={(e) => setSnippet(e.target.value)} rows={4} placeholder="Paste the wording the source actually uses — including numbers and dates." />
      </label>
      <label>Published (optional)
        <input type="text" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} placeholder="YYYY-MM-DD if visible" />
      </label>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" disabled={!valid} onClick={() => valid && onSubmit({ url: url.trim(), title: title.trim(), snippet: snippet.trim(), publishedAt: publishedAt.trim() })}>
          Add as evidence
        </Btn>
      </div>
    </div>
  );
}
