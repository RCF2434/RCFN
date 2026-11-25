import { useCallback, useEffect, useState } from 'react';

const fullscreenElement = () => document.fullscreenElement ?? document.webkitFullscreenElement ?? null;

/**
 * 讓整個播放器容器（影片 + 字幕 + 工具列）進入全螢幕。
 * iPhone Safari 不支援對 div 呼叫 requestFullscreen，改用 CSS 鋪滿視窗（pseudo）。
 */
export function useFullscreen(ref) {
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);

  useEffect(() => {
    const onChange = () => setNative(fullscreenElement() === ref.current && ref.current !== null);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [ref]);

  useEffect(() => {
    if (!pseudo) return undefined;
    const onKey = (event) => event.key === 'Escape' && setPseudo(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [pseudo]);

  const toggle = useCallback(() => {
    if (pseudo) {
      setPseudo(false);
      return;
    }
    if (fullscreenElement()) {
      (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (!request) {
      setPseudo(true);
      return;
    }
    try {
      request.call(el)?.catch?.(() => setPseudo(true));
    } catch {
      setPseudo(true);
    }
  }, [pseudo, ref]);

  return { active: native || pseudo, pseudo, toggle };
}
