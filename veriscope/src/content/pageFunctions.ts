/**
 * Self-contained functions injected on demand via chrome.scripting.executeScript.
 * Each MUST be fully standalone (no module references) — they are serialized with
 * toString(). They only READ DOM text; they never modify pages and never exfiltrate.
 */

export interface VsPageBlock { text: string; start: number; end: number; selector: string }
export interface VsPageExtract {
  ok: boolean;
  title: string;
  url: string;
  blocks: VsPageBlock[];
  text: string;
  truncated: boolean;
  error?: string;
}

export function vsExtractReadable(): VsPageExtract {
  const result: VsPageExtract = { ok: false, title: document.title, url: location.href, blocks: [], text: '', truncated: false };
  try {
    // Untrusted content: we extract TEXT ONLY (textContent), never HTML — so scripts,
    // attributes and event handlers cannot ride along into the extension.
    const rootCandidates = ['article', 'main', '[role="main"]', '.post-content', '#content', 'body'];
    let root: Element | null = null;
    for (const sel of rootCandidates) {
      const el = document.querySelector(sel);
      if (el && (el.textContent ?? '').trim().length > 400) { root = el; break; }
    }
    if (!root) root = document.body;
    const skip = root.querySelectorAll('script,style,noscript,iframe,nav,header,footer,aside,form,button,[aria-hidden="true"]');
    const removed: { node: Element; next: Node | null; parent: Node | null }[] = [];
    skip.forEach((el) => {
      removed.push({ node: el, next: el.nextSibling, parent: el.parentNode });
      el.remove();
    });
    const walkers = root.querySelectorAll('p,li,blockquote,h1,h2,h3,h4,pre,td,th');
    const blocks: VsPageBlock[] = [];
    let cursor = 0;
    const maxChars = 240000;
    if (walkers.length > 40) {
      for (const el of Array.from(walkers)) {
        const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (t.length < 25) continue;
        if (cursor + t.length > maxChars) { result.truncated = true; break; }
        blocks.push({ text: t, start: cursor, end: cursor + t.length, selector: 'p' });
        cursor += t.length + 2;
      }
    }
    let full = blocks.length
      ? blocks.map((b) => b.text).join('\n\n')
      : (root.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, maxChars);
    if (!blocks.length) {
      const t = (root.textContent ?? '').replace(/\s+/g, ' ').trim();
      if (t.length > maxChars) { full = t.slice(0, maxChars); result.truncated = true; }
    }
    // restore DOM exactly as found
    for (let i = removed.length - 1; i >= 0; i--) {
      const r = removed[i];
      if (r.parent) r.parent.insertBefore(r.node, r.next);
    }
    result.blocks = blocks;
    result.text = full;
    result.ok = full.length > 80;
    if (!result.ok) result.error = 'Could not extract readable text (page may render content in frames/shadow DOM). Select text manually and use "Verify selection".';
  } catch (e) {
    result.error = (e as Error).message;
  }
  return result;
}

export interface VsSelection { text: string; url: string; title: string }
export function vsGetSelection(): VsSelection {
  const text = (document.getSelection()?.toString() ?? '').trim();
  return { text, url: location.href, title: document.title };
}

/**
 * AI answer extraction — per-provider adapters with a documented manual fallback.
 * DOM structures change constantly; each selector list is best-effort and READ-ONLY.
 * If nothing matches, the UI instructs the user to select the answer and verify it.
 */
export interface VsAiAnswer { provider: string; text: string; index: number }
export function vsFindAiAnswers(): VsAiAnswer[] {
  const out: VsAiAnswer[] = [];
  const hosts: { provider: string; sels: string[] }[] = [
    { provider: 'ChatGPT', sels: ['[data-message-author-role="assistant"] .markdown', 'div.message.assistant', '[data-message-id] .prose'] },
    { provider: 'Claude', sels: ['[data-testid="assistant-message"]', '.flex-col.gap-6 > div.group p'] },
    { provider: 'Gemini', sels: ['message-content .markdown', 'model-response .markdown'] },
    { provider: 'Perplexity', sels: ['[data-testid="answer"] .c-interactive-markdown'] },
    { provider: 'DeepSeek', sels: ['.ds-markdown'] },
  ];
  const seen = new Set<string>();
  if (!/chatgpt|openai|claude|anthropic|gemini|bard|perplexity|deepseek|copilot/i.test(location.hostname + location.pathname)) {
    return out; // only scan on known AI-assistant hosts
  }
  for (const h of hosts) {
    for (const sel of h.sels) {
      let nodes: NodeListOf<Element>;
      try { nodes = document.querySelectorAll(sel); } catch { continue; }
      nodes.forEach((n, i) => {
        const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (t.length < 40 || seen.has(t.slice(0, 120))) return;
        seen.add(t.slice(0, 120));
        out.push({ provider: h.provider, text: t.slice(0, 24000), index: i });
      });
      if (out.length) break;
    }
    if (out.length) break;
  }
  return out;
}

export interface VsVideoInfo { rect: { x: number; y: number; width: number; height: number }; src: string; time: number; title: string; poster: string }
export function vsGetVideoInfo(): VsVideoInfo | null {
  const v = document.querySelector('video') as HTMLVideoElement | null;
  if (!v) return null;
  const r = v.getBoundingClientRect();
  return { rect: { x: r.x, y: r.y, width: r.width, height: r.height }, src: v.currentSrc || v.src || '', time: v.currentTime, title: document.title, poster: v.poster || '' };
}
