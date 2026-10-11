import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeFetchJson, NetworkBlockedError, assertOnline } from '../src/core/net';
import { verifyPassage } from '../src/core/verify';
import { DEFAULT_SETTINGS } from '../src/types';

const offline = { ...DEFAULT_SETTINGS, mode: 'offline' as const };
const online = { ...DEFAULT_SETTINGS, mode: 'online' as const };

describe('strict offline mode network guarantee', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('refuses before touching the network', async () => {
    await expect(safeFetchJson('https://api.openalex.org/works?search=x', offline)).resolves.toMatchObject({ ok: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it('assertOnline throws the typed error', () => {
    expect(() => assertOnline(offline)).toThrow(NetworkBlockedError);
    expect(() => assertOnline(online)).not.toThrow();
  });
  it('full verification pipeline performs zero requests in offline mode', async () => {
    const out = await verifyPassage({
      passage: 'India launched Chandrayaan-3 in 2023.', mode: 'single-claim', sourceKind: 'manual', settings: offline,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    const inv = out.investigations[0];
    expect(inv.evidence.filter((e) => e.origin === 'automatic')).toHaveLength(0);
    expect(inv.verdict.manualOnly).toBe(true);
    expect(inv.verdict.caveats.join(' ')).toMatch(/offline/i);
    expect(inv.verdict.verdict).toBe('unverified');
    // BUT it stays useful: links and claim structure exist
    expect(out.searchLinksByClaim.get(inv.claim.id)!.length).toBeGreaterThan(0);
  });
  it('adapters never bypass the gate (online fetch failures are honest errors)', async () => {
    fetchSpy.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
    const out = await verifyPassage({
      passage: 'A peer-reviewed study found the vaccine reduced infection by 50 percent in trials (DOI 10.1000/xyz).',
      mode: 'single-claim', sourceKind: 'manual', settings: online,
    });
    const r = out.adapterReports.find((x) => x.adapter === 'openalex');
    expect(r?.ok).toBe(false);
    expect(r?.error).toMatch(/Network|fetch/i);
  });
  it('429s map to a rate-limit explanation (graceful degradation)', async () => {
    fetchSpy.mockImplementation(async () => new Response('', { status: 429 }));
    const res = await safeFetchJson('https://api.example/x', online);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/rate limit/i);
    expect(res.status).toBe(429);
  });
});
