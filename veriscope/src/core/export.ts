import type { Investigation } from '../types';
import { APP } from '../config';

/** Local export (JSON + Markdown). No upload ever happens here. */

export function investigationToJson(invs: Investigation[]): string {
  return JSON.stringify({ app: APP.name, version: APP.version, exportedAt: new Date().toISOString(), investigations: invs }, null, 2);
}

export function investigationToMarkdown(inv: Investigation): string {
  const L: string[] = [];
  L.push(`# ${APP.name} investigation report`);
  L.push('');
  L.push(`- **Claim (original wording):** ${inv.originalClaimText}`);
  L.push(`- **Extracted claim:** ${inv.claim.text}`);
  L.push(`- **Claim kind:** ${inv.claim.kind}${inv.claim.isQuotation ? ' (quotation)' : ''}`);
  if (inv.source.url) L.push(`- **Source page:** ${inv.source.url}${inv.source.title ? ` — ${inv.source.title}` : ''}`);
  if (inv.source.documentName) L.push(`- **Document:** ${inv.source.documentName}`);
  if (inv.source.speaker) L.push(`- **Speaker/context:** ${[inv.source.speaker, inv.source.committee, inv.source.country, inv.source.period, inv.source.documentRef].filter(Boolean).join(' · ')}`);
  L.push(`- **Mode at verification:** ${inv.mode === 'offline' ? 'strict offline (no external requests were possible)' : 'online evidence mode'}`);
  L.push(`- **Created:** ${inv.createdAt} · **Updated:** ${inv.updatedAt} · **Status:** ${inv.status}`);
  L.push('');
  L.push(`## Verdict: ${inv.verdict.label}`);
  L.push('');
  L.push(inv.verdict.explanation);
  L.push('');
  L.push(`**Confidence:** ${inv.verdict.confidence.band} (explainable score ${inv.verdict.confidence.score}/1 — ${inv.verdict.confidence.note})`);
  for (const f of inv.verdict.confidence.factors) L.push(`- ${f.name}: ${f.value} — ${f.explanation}`);
  if (inv.verdict.caveats.length) {
    L.push('');
    L.push('**Caveats:**');
    for (const c of inv.verdict.caveats) L.push(`- ${c}`);
  }
  L.push('');
  L.push(`## Evidence trail (${inv.evidence.length} item(s), ${inv.verdict.retrievedCount} retrieved automatically)`);
  L.push('');
  for (const e of inv.evidence) {
    L.push(`### ${e.title}`);
    L.push(`- Source: ${e.publisher}${e.sourceId ? ` (${e.sourceId})` : ''} · Relation: **${e.relation}**${e.relationSetBy ? ` (set by ${e.relationSetBy}${e.relationSuggestion?.provisional && e.relationSetBy === 'heuristic' ? ', provisional heuristic' : ''})` : ' (unassessed)'}`);
    if (e.publishedAt) L.push(`- Published: ${e.publishedAt}`);
    L.push(`- Accessed: ${e.accessedAt} · Independence group: ${e.independenceKey}${e.duplicateOf ? ` — DUPLICATE of ${e.duplicateOf} (not counted independently)` : ''}`);
    L.push(`- Link: ${e.url}`);
    if (e.snippet) L.push(`> ${e.snippet.replace(/\n/g, ' ')}`);
    if (e.relationSuggestion) L.push(`- Heuristic suggestion: ${e.relationSuggestion.relation} — ${e.relationSuggestion.reason}`);
    if (e.notes) L.push(`- Notes: ${e.notes}`);
    L.push('');
  }
  const links = inv.annotations.length ? inv.annotations : [];
  if (links.length) {
    L.push('## User annotations');
    for (const a of links) L.push(`- ${a}`);
    L.push('');
  }
  if (inv.userFlag) {
    L.push(`> ⚑ User flagged this verdict as incorrect: ${inv.userFlag.reason} (${inv.userFlag.at})`);
    L.push('');
  }
  L.push('## Change log');
  for (const c of inv.changeLog) L.push(`- ${c.at}: ${c.what}`);
  L.push('');
  L.push(`---`);
  L.push(`Generated locally by ${APP.name} v${APP.version}. ${APP.name} does not fabricate evidence: “unverified” means the available evidence did not settle the question — it is NOT proof of falsehood.`);
  return L.join('\n');
}

export function transcriptReportToMarkdown(title: string, rows: { t0: number; text: string }[], findings: { claim: string; note: string }[]): string {
  const L = [`# ${APP.name} — live session report`, '', `_${title}_`, '', '## Transcript', ''];
  for (const r of rows) {
    const mm = String(Math.floor(r.t0 / 60)).padStart(2, '0');
    const ss = String(Math.floor(r.t0 % 60)).padStart(2, '0');
    L.push(`**[${mm}:${ss}]** ${r.text}`);
  }
  L.push('', '## Checkable claims extracted', '');
  if (!findings.length) L.push('_No clearly checkable factual claims were extracted._');
  for (const f of findings) L.push(`- ${f.claim}${f.note ? ` — ${f.note}` : ''}`);
  L.push('', '---', 'Verdicts and evidence for each queued claim are stored in the investigations list; export them individually for the full evidence trail.');
  return L.join('\n');
}

export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
