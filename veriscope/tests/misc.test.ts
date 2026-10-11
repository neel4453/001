import { describe, expect, it } from 'vitest';
import { parseTranscript } from '../src/core/speech';
import { extractClaims } from '../src/core/claims';
import { investigationToMarkdown } from '../src/core/export';
import { nowIso } from '../src/core/util';
import type { Investigation } from '../src/types';

describe('transcript import', () => {
  it('parses VTT cues with timestamps', () => {
    const rows = parseTranscript(`WEBVTT\n\n00:01.000 --> 00:04.000\nOur emissions fell ten percent.\n\n00:05.000 --> 00:08.000\nThe treaty entered force in 1998.`);
    expect(rows).toHaveLength(2);
    expect(rows[0].t0).toBe(1);
    expect(rows[1].text).toContain('1998');
  });
  it('parses [mm:ss] inline markers and assigns sequential times to plain lines', () => {
    const rows = parseTranscript(`[02:10] GDP grew by six percent.\nAnd we built 40 gigawatts.`);
    expect(rows[0].t0).toBe(130);
    expect(rows[1].t0).toBe(0);
  });
  it('extracts claims from transcript lines without inventing verdicts', () => {
    const rows = parseTranscript('[00:30] India launched Chandrayaan-3 in 2023.');
    const { claims } = extractClaims(rows.map((r) => r.text).join(' '));
    expect(claims[0].kind).toBe('factual');
    expect(claims[0].dates.some((d) => d.year === 2023)).toBe(true);
  });
});

describe('export integrity', () => {
  it('markdown preserves original claim, caveats, and change log (no silent edits)', () => {
    const inv: Investigation = {
      id: 'i', createdAt: nowIso(), updatedAt: nowIso(), mode: 'offline', status: 'user-flagged',
      source: { kind: 'manual' },
      claim: { id: 'c', text: 'Edited: emissions fell 30%.', kind: 'factual', isQuotation: false, numbers: [], dates: [], entities: [], topics: [], spans: [], contextMissing: [] },
      originalClaimText: 'Original: emissions fell by a third.',
      annotations: ['user note'],
      evidence: [{ id: 'e', claimId: 'c', publisher: 'x', domain: 'x', title: 'A source', url: 'https://x.example', accessedAt: nowIso(), origin: 'user-added', relation: 'supports', relationSetBy: 'user', independenceKey: 'x' }],
      verdict: { verdict: 'mostly-supported', label: 'Mostly supported', explanation: 'One source.', confidence: { band: 'low', score: 0.3, factors: [], note: 'not calibrated' }, retrievedCount: 0, manualOnly: true, caveats: ['single source'] },
      userFlag: { reason: 'date mismatch', at: nowIso() },
      changeLog: [{ at: nowIso(), what: 'claim text changed by user' }],
    };
    const md = investigationToMarkdown(inv);
    expect(md).toContain('Original: emissions fell by a third.');
    expect(md).toContain('claim text changed by user');
    expect(md).toContain('user-flagged');
    expect(md).toContain('https://x.example');
    expect(md).toContain('NOT proof of falsehood');
  });
});
