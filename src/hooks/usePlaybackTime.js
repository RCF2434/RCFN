import { useEffect, useState } from 'react';

/**
 * 定期讀播放器目前時間（聊天室用，不需要每格更新）。
 * 時間變動超過 0.1 秒才 setState，暫停時不會一直重新渲染。
 */
export function usePlaybackTime(playerRef, enabled, intervalMs = 250) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const read = () => {
      const t = playerRef.current?.getCurrentTime?.();
      if (Number.isFinite(t)) setTime((prev) => (Math.abs(prev - t) >= 0.1 ? t : prev));
    };
    read();
    const timer = window.setInterval(read, intervalMs);
    return () => window.clearInterval(timer);
  }, [playerRef, enabled, intervalMs]);

  return time;
}
