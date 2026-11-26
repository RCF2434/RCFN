import { useEffect, useState } from 'react';
import { parseSRT } from '../lib/srt.js';
import { sortLangs, unionSpeakers } from '../lib/subtitleTracks.js';

const IDLE = { status: 'idle', tracks: {}, speakers: [], errors: {}, error: null };

/**
 * 載入多語字幕。files：{ zh?: 網址, en?: 網址, ja?: 網址 }
 * @returns {{
 *   status: 'idle' | 'loading' | 'ready' | 'error',  // ready：至少一種語言載入成功
 *   tracks: Record<string, { cues, speakers, warnings }>,
 *   speakers: string[],                              // 所有語言的說話人（配色用）
 *   errors: Record<string, string>,                  // 載入失敗的語言 → 原因
 *   error: string | null,                            // 全部失敗時的訊息
 * }}
 */
export function useSubtitleTracks(files) {
  const [state, setState] = useState(IDLE);
  const key = JSON.stringify(files ?? {});

  useEffect(() => {
    const entries = sortLangs(Object.keys(files ?? {})).map((lang) => [lang, files[lang]]);
    if (!entries.length) {
      setState(IDLE);
      return undefined;
    }
    const controller = new AbortController();
    setState({ ...IDLE, status: 'loading' });

    Promise.all(
      entries.map(([lang, url]) =>
        fetch(url, { signal: controller.signal })
          .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
          })
          .then((text) => ({ lang, track: parseSRT(text) }))
          .catch((err) => ({ lang, error: err })),
      ),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const tracks = {};
      const errors = {};
      for (const r of results) {
        if (r.track) tracks[r.lang] = r.track;
        else errors[r.lang] = r.error.message;
      }
      const ok = Object.keys(tracks).length > 0;
      setState({
        status: ok ? 'ready' : 'error',
        tracks,
        speakers: unionSpeakers(tracks),
        errors,
        error: ok ? null : Object.values(errors)[0] ?? '字幕載入失敗',
      });
    });
    return () => controller.abort();
    // files 以 key（內容）判斷是否變動
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
