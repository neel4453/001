import type { Claim, EvidenceRecord, Mode, SourceEntry, Verdict, VerdictResult } from '../types';
import { freshnessWeight, independentCount, sourceQualityWeight } from './evidence';
import { clamp } from './util';

/**
 * Verdict engine. RULES, not vibes: every output line can be traced to a count of
 * user-assessed / suggested evidence, independence, and freshness. Never TRUE/FALSE.
 */

export const VERDICT_LABELS: Record<Verdict, string> = {
  supported: 'Supported',
  'mostly-supported': 'Mostly supported',
  'partially-supported': 'Partially supported',
  misleading: 'Misleading',
  contradicted: 'Contradicted',
  outdated: 'Outdated',
  unverified: 'Unverified — insufficient evidence',
  disputed: 'Disputed',
  opinion: 'Opinion (not a verifiable fact)',
  prediction: 'Prediction (not yet verifiable)',
  ambiguous: 'Ambiguous — missing context',
  'satire-hypothetical': 'Satire or hypothetical',
};

export interface VerdictInput {
  claim: Claim;
  evidence: EvidenceRecord[];
  sourceTypeById: Map<string, SourceEntry>;
  mode: Mode;
  attemptedSources: number; // sources we tried to query automatically
  accessedSources: number;   // sources that actually returned data
  blockedReasons: string[];  // honest errors surfaced to the user
}

export function verdictColorToken(v: Verdict): string {
  return v; // css maps [data-verdict]
}

export function computeVerdict(input: VerdictInput): VerdictResult {
  const { claim, evidence, sourceTypeById, mode, attemptedSources, accessedSources, blockedReasons } = input;
  const caveats: string[] = [];
  const manualOnly = accessedSources === 0;

  // Non-factual statements short-circuit with explanatory verdicts.
  switch (claim.kind) {
    case 'opinion':
      return finish('opinion', 'This statement expresses a judgment. Opinions cannot be verified as facts; the evidence gathered (if any) is contextual only.', []);
    case 'prediction':
      return finish('prediction', 'This is a forecast about the future. It can be compared with trends and official projections, but it cannot currently be confirmed or refuted.', []);
    case 'question':
      return finish('ambiguous', 'This is a question, not an assertion. Phrase it as a checkable statement to verify it.', ['no assertive content to verify']);
    case 'recommendation':
      return finish('opinion', 'This is a recommendation (“should”), which is a normative judgment rather than a verifiable factual claim.', []);
    case 'hypothetical':
    case 'satire-candidate':
      return finish('satire-hypothetical', 'This reads as hypothetical or satirical. Such text is not asserted as fact — label it before treating it as evidence of anything.', ['classify with the source context (satire needs adequate establishment)']);
    default:
      break;
  }

  if (claim.contextMissing.length) {
    caveats.push(`Missing context: ${claim.contextMissing.join('; ')}.`);
  }

  const assessed = evidence.filter((e) => e.relationSetBy === 'user' && e.relation !== 'unassessed' && !e.duplicateOf);
  const dupAssessed = evidence.filter((e) => e.relationSetBy === 'user' && e.relation !== 'unassessed' && e.duplicateOf);
  if (dupAssessed.length) caveats.push(`${dupAssessed.length} assessed evidence item(s) duplicate other sources and were not counted as independent.`);

  const supports = assessed.filter((e) => e.relation === 'supports');
  const contradicts = assessed.filter((e) => e.relation === 'contradicts');
  const contextual = assessed.filter((e) => e.relation === 'contextualizes');

  // Fallback: if nothing user-assessed, use strong provisional suggestions (explicitly flagged).
  let usedProvisional = false;
  let sup = supports;
  let con = contradicts;
  if (!assessed.length) {
    const strong = evidence.filter((e) => e.relationSuggestion && e.relationSuggestion.strength === 2 && !e.duplicateOf);
    if (strong.length) {
      usedProvisional = true;
      sup = strong.filter((e) => e.relationSuggestion!.relation === 'supports');
      con = strong.filter((e) => e.relationSuggestion!.relation === 'contradicts');
      caveats.push('No evidence has been assessed by you yet — this verdict uses ONLY provisional numeric-matching heuristics (clearly marked on each card). Confirm or correct each relation to finalize it.');
    }
  }

  const indSup = independentCount(sup);
  const indCon = independentCount(con);
  const total = sup.length + con.length;

  if (mode === 'offline') {
    caveats.push('Strict offline mode: no fresh online evidence could be retrieved. Judge against the local sources you supply (Settings → mode).');
  }

  if (attemptedSources > 0 && accessedSources === 0 && !evidence.length) {
    return finish('unverified',
      `No usable evidence was retrieved (attempted ${attemptedSources} automated source(s)). ${blockedReasons.join(' ') || 'All automated queries failed or were unavailable.'} No evidence found does NOT mean the claim is false.`,
      ['automated retrieval failed; try manual search links']);
  }

  if (!total) {
    const why = blockedReasons.length
      ? `Evidence could not be retrieved automatically: ${blockedReasons[0]}`
      : manualOnly
        ? 'Only search links were prepared — opening them is a manual step and was not performed by the extension.'
        : 'The retrieved items did not address this claim.';
    return finish('unverified', `Insufficient evidence to judge. ${why}. This is NOT a finding that the claim is false — it is a finding that the available evidence does not settle it.`,
      [manualOnly ? 'open the search links and mark any evidence you find' : 'add sources manually or re-run']);
  }

  const claimYears = claim.dates.map((d) => d.year).filter((y): y is number => y != null);
  const fresh = sup.concat(con).map((e) => freshnessWeight(e.publishedAt, claimYears)).filter((f): f is number => f != null);
  const minFresh = fresh.length ? Math.min(...fresh) : null;
  const maxFresh = fresh.length ? Math.max(...fresh) : null;

  let verdict: Verdict;
  let explanation: string;

  if (indSup >= 1 && indCon >= 1) {
    verdict = 'disputed';
    explanation = `Independent sources disagree: ${indSup} supporting vs ${indCon} contradicting independent source(s). The disagreement is real — it is summarized below rather than resolved by fiat. Inspect the exact wording of each source.`;
  } else if (indCon > 0 && indSup === 0) {
    verdict = 'contradicted';
    explanation = `Contradicted by ${con.length} assessed source(s) (${indCon} independent). Supporting evidence: none assessed. Check whether the contradicting source addresses the exact wording of the claim.`;
  } else if (indSup >= 2 && con.length === 0) {
    verdict = 'supported';
    explanation = `Supported by ${indSup} independent source(s) with no contradicting evidence you assessed. ${usedProvisional ? '(Provisional numeric matching — confirm the passages.)' : 'Relation assessments are yours; verify the linked passages.'}`;
  } else if (indSup === 1 && con.length === 0) {
    verdict = 'mostly-supported';
    explanation = `Consistent with ${indSup} independent source(s), but a single source is thin support — find at least one more independent confirmation. ${usedProvisional ? '(Provisional numeric matching — confirm the passages.)' : ''}`;
  } else {
    verdict = 'partially-supported';
    explanation = `Some aspects are supported (${sup.length}), but ${con.length} contradicting item(s) exist that did not rise to independent-source level, or context was only partial. Read both sides below.`;
  }

  // Outdated: supporting evidence predates the claim period, or newer contradicting evidence exists.
  if (minFresh != null && minFresh <= 0.25 && maxFresh != null && maxFresh >= 0.8 && verdict !== 'disputed') {
    caveats.push('Evidence freshness is mixed — some corroborating sources predate the period the claim refers to.');
    if (verdict === 'supported' && minFresh <= 0.25) verdict = 'outdated';
    if (verdict === 'outdated') explanation = 'Some corroborating evidence appears to be from before the period referenced; figures may have changed since. Re-check the newest official data.';
  }
  if (verdict === 'supported' && contextual.length && !claim.numbers.length) {
    // keep supported; contextual adds color only
    caveats.push(`${contextual.length} additional source(s) provide context without direct confirmation.`);
  }
  if (usedProvisional && verdict === 'supported') verdict = 'mostly-supported';

  // Confidence: explainable weighted score, explicitly not calibrated.
  const quality =
    sup.concat(con).length === 0 ? 0
      : sup.concat(con).reduce((acc, e) => acc + sourceQualityWeight(sourceTypeById.get(e.sourceId ?? '')?.sourceType ?? 'user-supplied'), 0) /
        (sup.concat(con).length);
  const directness = sup.concat(con).some((e) => e.relationSuggestion?.strength === 2) ? 1
    : sup.concat(con).some((e) => (e.snippet?.length ?? 0) > 80) ? 0.7 : 0.4;
  const agreement = total ? clamp(sup.length / total, 0, 1) : 0;
  const freshness = maxFresh ?? 0.5;
  const completeness = clamp(accessedSources / Math.max(attemptedSources, 1), 0, 1);
  const missing = claim.contextMissing.length ? 0.45 : 1;
  const factors = [
    { name: 'Source quality', value: +quality.toFixed(2), explanation: 'Mean type-weight across assessed evidence (primary=1.0 … social=0.2).' },
    { name: 'Directness', value: +directness.toFixed(2), explanation: 'Whether passages address the claim’s exact numbers/wording.' },
    { name: 'Agreement', value: +agreement.toFixed(2), explanation: `Share of assessed evidence supporting: ${sup.length}/${total}.` },
    { name: 'Freshness', value: +freshness.toFixed(2), explanation: 'Publication dates vs. the claim’s time period.' },
    { name: 'Retrieval completeness', value: +completeness.toFixed(2), explanation: `${accessedSources} of ${Math.max(attemptedSources, 0)} attempted automated sources returned data.` },
    { name: 'Context completeness', value: +missing.toFixed(2), explanation: claim.contextMissing.length ? `Missing: ${claim.contextMissing.join('; ')}.` : 'Time, place and units identified.' },
  ];
  const score = clamp(
    factors[0].value * 0.22 + factors[1].value * 0.2 + factors[2].value * 0.2 + factors[3].value * 0.14 + factors[4].value * 0.14 + factors[5].value * 0.1,
    0, 1,
  );
  const band = score >= 0.72 ? 'high' : score >= 0.45 ? 'medium' : 'low';

  return {
    verdict,
    label: VERDICT_LABELS[verdict],
    explanation,
    confidence: {
      band, score: +score.toFixed(2), factors,
      note: 'This is an explainable weighting of evidence properties — NOT a calibrated probability and not an LLM’s self-confidence.',
    },
    retrievedCount: accessedSources,
    manualOnly,
    caveats,
  };

  function finish(verdict: Verdict, explanation: string, extraCaveats: string[]): VerdictResult {
    return {
      verdict,
      label: VERDICT_LABELS[verdict],
      explanation,
      confidence: {
        band: 'low',
        score: 0.2,
        factors: [{ name: 'Applicability', value: verdict === 'unverified' ? 0.2 : 1, explanation: 'Verdict reflects evidence availability, not truth certainty.' }],
        note: 'Confidence here describes the assessment process, not the probability that the claim is true.',
      },
      retrievedCount: accessedSources,
      manualOnly,
      caveats: [...caveats, ...extraCaveats],
    };
  }
}
