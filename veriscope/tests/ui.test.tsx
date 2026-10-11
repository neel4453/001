// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VerdictBadge, Toggle } from '../src/ui/components/ui';
import { EvidenceCard, SearchLinks } from '../src/ui/components/investigation';
import type { EvidenceRecord } from '../src/types';

const ev: EvidenceRecord = {
  id: 'e', claimId: 'c', publisher: 'snopes.com', domain: 'snopes.com', title: 'Snopes: the real story',
  url: 'https://snopes.com/fact-check/x', snippet: 'The law was passed on 12 March 2019.', accessedAt: new Date().toISOString(),
  origin: 'automatic', relation: 'unassessed', relationSetBy: null, independenceKey: 'snopes.com',
  relationSuggestion: { relation: 'supports', reason: 'date matches', strength: 2, provisional: true },
};

describe('verdict & evidence UI', () => {
  it('verdict badge carries text + data token (never color alone)', () => {
    render(<VerdictBadge verdict="partially-supported" label="Partially supported" />);
    const el = screen.getByRole('status');
    expect(el.textContent).toContain('Partially supported');
    expect(el.getAttribute('data-verdict')).toBe('partially-supported');
  });

  it('evidence card shows provisional suggestion + original link + assessment buttons', () => {
    const onAssess = vi.fn();
    render(
      <EvidenceCard ev={ev} onAssess={onAssess} />,
    );
    expect(screen.getByText(/Machine suggestion/i)).toBeTruthy();
    fireEvent.click(screen.getByText(/supports ▾/i));
    expect(screen.getByText(/date matches/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Supports' }));
    expect(onAssess).toHaveBeenCalledWith('supports');
    const link = screen.getByRole('link', { name: /Open original source/i });
    expect(link.getAttribute('href')).toBe(ev.url);
  });

  it('search links block is labeled as NOT performed and lists sources', () => {
    render(
      <SearchLinks links={[{ sourceId: 'a', name: 'PolitiFact', url: 'https://politifact.com/?s=x', kind: 'search-page', performed: false, verifiedTemplate: false }]} />,
    );
    expect(screen.getByText(/not yet performed/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Manual searches/i }));
    expect(screen.getByRole('link', { name: 'PolitiFact' })).toBeTruthy();
  });

  it('toggle switch exposes label via aria', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Enable X" />);
    fireEvent.click(screen.getByLabelText('Enable X'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
