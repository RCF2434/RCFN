import { useEffect, useState } from 'react';
import { parseSRT } from '../lib/srt.js';

const INITIAL = { status: 'loading', cues: [], speakers: [], warnings: [], error: null };

export function useSubtitles(url) {
  const [state, setState] = useState(INITIAL);

  useEffect(() => {
    if (!url) return undefined;
    const controller = new AbortController();
    setState(INITIAL);
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => setState({ status: 'ready', error: null, ...parseSRT(text) }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState({ ...INITIAL, status: 'error', error: err.message });
      });
    return () => controller.abort();
  }, [url]);

  return state;
}
