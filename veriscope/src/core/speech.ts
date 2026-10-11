/**
 * Live speech (§12). Two paths, clearly labeled:
 *  - Cloud Web Speech API (Chrome uses Google services for it) → requires opt-in.
 *  - Transcript import / paste (works fully offline).
 * Microphone capture ≠ system/tab audio: documented limitation; tab audio capture
 * uses getDisplayMedia with the tab selector when the user grants it.
 */

export interface TranscriptSegment { t0: number; text: string; final: boolean; }

export function speechApiAvailable(): boolean {
  return typeof (window as any).SpeechRecognition !== 'undefined' || typeof (window as any).webkitSpeechRecognition !== 'undefined';
}

export interface LiveSession { stop(): void; }

export function startCloudTranscription(handlers: {
  onSegment: (seg: TranscriptSegment) => void;
  onState: (state: 'idle' | 'listening' | 'error' | 'stopped', msg?: string) => void;
}): LiveSession | { error: string } {
  const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  if (!Ctor) return { error: 'The browser SpeechRecognition API is unavailable here. Use transcript import instead (works offline).' };
  try {
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || 'en-US';
    const t0 = Date.now();
    let stopped = false;
    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        handlers.onSegment({ t0: (r.$vsStart ?? t0) - t0 + 0, text: r[0].transcript, final: r.isFinal });
      }
    };
    rec.onerror = (ev: any) => {
      const why = ev.error === 'not-allowed' ? 'Microphone permission denied by the browser.'
        : ev.error === 'no-speech' ? 'No speech detected.'
        : `Recognition error: ${ev.error}`;
      handlers.onState('error', why);
    };
    rec.onend = () => handlers.onState(stopped ? 'stopped' : 'listening', stopped ? undefined : 'Session ended unexpectedly; restarting.');
    rec.onstart = () => handlers.onState('listening');
    const micStart = navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => { rec.start(); return stream; })
      .catch((e) => { handlers.onState('error', `Microphone unavailable: ${e.message}`); throw e; });
    void micStart.catch(() => undefined);
    return {
      stop() {
        stopped = true;
        try { rec.stop(); } catch {}
        void micStart.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => undefined);
        handlers.onState('stopped');
      },
    };
  } catch (e) {
    return { error: `Could not start speech recognition: ${(e as Error).message}` };
  }
}

/** Parse pasted transcript: VTT/SRT cue times, "[mm:ss]" markers, or plain text lines. */
export function parseTranscript(raw: string): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  const vtt = raw.includes('-->');
  if (vtt) {
    const time = /(\d{1,2}:)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?/;
    const blocks = raw.split(/\r?\n\r?\n+/);
    for (const b of blocks) {
      const m = time.exec(b);
      if (!m) continue;
      const t0 = (m[1] ? +m[1].replace(':', '') * 3600 : 0) + +m[2] * 60 + +m[3];
      const lines = b.split(/\r?\n/).filter((l) => l && !time.test(l) && !/^\d+$/.test(l.trim()));
      if (lines.length) out.push({ t0, text: lines.join(' ').trim(), final: true });
    }
    return out;
  }
  const inline = /^\s*\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*(.+)$/;
  for (const line of raw.split(/\r?\n/)) {
    const m = inline.exec(line);
    if (m) {
      const secs = m[3] != null ? +m[1] * 3600 + +m[2] * 60 + +m[3] : +m[1] * 60 + +m[2];
      out.push({ t0: secs, text: m[4].trim(), final: true });
    } else if (line.trim()) {
      out.push({ t0: -1, text: line.trim(), final: true });
    }
  }
  let t = 0;
  for (const s of out) if (s.t0 === -1) { s.t0 = t; t += 5; }
  return out;
}

/** Tab/system audio capture via documented getDisplayMedia (user picks the tab). */
export async function captureTabStream(): Promise<{ stream: MediaStream | null; error?: string }> {
  try {
    const md = (navigator as any).mediaDevices;
    if (!md?.getDisplayMedia) return { stream: null, error: 'getDisplayMedia is not available in this context.' };
    const stream = await md.getDisplayMedia({ video: false, audio: { mandatory: { chromeMediaSource: 'tab' } } as any, selfBrowserSurface: 'include' } as any);
    return { stream };
  } catch (e) {
    return { stream: null, error: (e as Error).message };
  }
}
