import { useEffect, useState } from 'react';
import { PLAYING } from '../lib/youtube.js';

const EMPTY = [];
const MAX_EXTRAPOLATE_MS = 1000;

/**
 * 每個畫格讀取播放時間，找出目前該顯示的字幕。
 * IFrame API 的 getCurrentTime() 是跨 iframe 傳來的快取值，更新頻率不固定；
 * 播放中若數值沒變，就用經過時間推算，讓字幕切換更貼近畫面。
 * 只有在顯示中的字幕改變時才 setState，避免每格重新渲染。
 */
export function useActiveCues(playerRef, ready, cues) {
  const [active, setActive] = useState(EMPTY);

  useEffect(() => {
    setActive(EMPTY);
    if (!ready || cues.length === 0) return undefined;

    let frame = 0;
    let lastKey = '';
    let baseTime = -1;
    let baseAt = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;

      const now = performance.now();
      const reported = player.getCurrentTime() || 0;
      let t = reported;
      if (reported !== baseTime) {
        baseTime = reported;
        baseAt = now;
      } else if (player.getPlayerState?.() === PLAYING) {
        const rate = player.getPlaybackRate?.() || 1;
        t = reported + (Math.min(now - baseAt, MAX_EXTRAPOLATE_MS) / 1000) * rate;
      }

      // cues 已依開始時間排序，超過目前時間即可停止
      const hits = [];
      for (const cue of cues) {
        if (cue.start > t) break;
        if (t < cue.end) hits.push(cue);
      }
      const key = hits.map((cue) => cue.id).join(',');
      if (key !== lastKey) {
        lastKey = key;
        setActive(hits.length ? hits : EMPTY);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playerRef, ready, cues]);

  return active;
}
