import { useEffect, useRef, useState } from 'react';
import { loadYouTubeAPI, playerErrorMessage } from '../lib/youtube.js';

/**
 * 在 hostRef 指向的元素內建立 YouTube 播放器。
 * fs: 0 關掉 YouTube 原生全螢幕——原生全螢幕只放大 iframe，外掛字幕會被蓋住，
 * 改由 useFullscreen 把「播放器 + 字幕」整個容器放大。
 */
export function useYouTubePlayer(videoId) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  // YT.PlayerState：-1 未開始、0 結束、1 播放、2 暫停、3 緩衝、5 已載入
  const [playerState, setPlayerState] = useState(-1);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !videoId) return undefined;
    let cancelled = false;
    setReady(false);
    setError(null);
    setErrorCode(null);
    setPlayerState(-1);

    // YT.Player 會把目標元素換成 iframe，所以給它一個自己建立的節點，不碰 React 管理的 DOM
    const mount = document.createElement('div');
    host.appendChild(mount);

    loadYouTubeAPI()
      .then((YT) => {
        if (cancelled) return;
        playerRef.current = new YT.Player(mount, {
          // 隱私強化模式：觀眾按下播放前，YouTube 不會儲存造訪者的資訊（見隱私說明頁）
          host: 'https://www.youtube-nocookie.com',
          videoId,
          width: '100%',
          height: '100%',
          playerVars: {
            fs: 0,
            playsinline: 1,
            rel: 0,
            cc_load_policy: 0,
            iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: () => !cancelled && setReady(true),
            onError: (event) => {
              if (cancelled) return;
              setError(playerErrorMessage(event.data));
              setErrorCode(event.data);
            },
            onStateChange: (event) => !cancelled && setPlayerState(event.data),
          },
        });
      })
      .catch((err) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy();
      } catch {
        /* 播放器尚未初始化完成 */
      }
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [videoId]);

  return { hostRef, playerRef, ready, error, errorCode, playerState };
}
