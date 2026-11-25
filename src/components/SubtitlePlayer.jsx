import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer.js';
import { useActiveCues } from '../hooks/useActiveCues.js';
import { useFullscreen } from '../hooks/useFullscreen.js';
import { useStoredState } from '../hooks/useStoredState.js';
import { PALETTE } from '../lib/speakers.js';
import { BUFFERING, PLAYING } from '../lib/youtube.js';
import { noteMarkers } from '../lib/notes.js';
import SubtitleOverlay from './SubtitleOverlay.jsx';
import StyleSwitcher, { SUB_STYLE_KEYS } from './StyleSwitcher.jsx';
import SizeSlider, { DEFAULT_SUB_SIZE, SUB_SIZES, isSubSize } from './SizeSlider.jsx';

const NO_NOTES = [];

/**
 * onStatus：播放器載入或出錯時回報 { ready, errorCode }，發布頁用來檢查影片能不能嵌入
 * notes：numberNotes() 整理過的註釋，字幕上會標示（*編號）
 * ref：{ seekTo(秒數), getCurrentTime() }，給註釋連結跳時間、發布頁取目前時間
 */
export default function SubtitlePlayer({ youtubeId, cues, colors, onStatus, notes = NO_NOTES, ref }) {
  const shellRef = useRef(null);
  const { hostRef, playerRef, ready, error, errorCode, playerState } = useYouTubePlayer(youtubeId);
  const markers = useMemo(() => noteMarkers(cues, notes), [cues, notes]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo(seconds, { play = true } = {}) {
        const player = playerRef.current;
        if (!ready || !player?.seekTo) return false;
        player.seekTo(seconds, true);
        if (play) player.playVideo?.();
        // 播放器不在畫面上時捲過去
        const box = shellRef.current?.getBoundingClientRect();
        if (box && (box.top < 0 || box.bottom > window.innerHeight)) {
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          shellRef.current.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
        }
        return true;
      },
      getCurrentTime() {
        return ready ? (playerRef.current?.getCurrentTime?.() ?? null) : null;
      },
    }),
    [ready, playerRef],
  );
  useEffect(() => {
    onStatus?.({ ready, errorCode });
  }, [onStatus, ready, errorCode]);
  const active = useActiveCues(playerRef, ready, cues);
  const fullscreen = useFullscreen(shellRef);
  const [subStyle, setSubStyle] = useStoredState('sub-style', 'dark', (v) => SUB_STYLE_KEYS.includes(v));
  const [subSize, setSubSize] = useStoredState('sub-size', DEFAULT_SUB_SIZE, isSubSize);
  // 緩衝也算播放中，避免卡頓時工具列和字幕位置跳來跳去
  const playing = playerState === PLAYING || playerState === BUFFERING;
  const sample = colors.values().next().value ?? PALETTE[0];

  const shellClass = [
    'player-shell',
    fullscreen.active && 'is-fs scheme-dark',
    fullscreen.pseudo && 'is-pseudo-fs',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={shellRef} className={shellClass} data-playing={playing || undefined}>
      <div className="stage">
        <div className="stage__video" ref={hostRef} />
        {!ready && !error && <div className="stage__status">播放器載入中…</div>}
        {error && (
          <div className="stage__status stage__status--error" role="alert">
            {error}
          </div>
        )}
        <SubtitleOverlay
          cues={active}
          colors={colors}
          styleKey={subStyle}
          scale={SUB_SIZES[subSize].scale}
          markers={markers}
        />
      </div>

      <div className="player-toolbar">
        <StyleSwitcher value={subStyle} onChange={setSubStyle} sample={sample} />
        <SizeSlider value={subSize} onChange={setSubSize} />
        <button
          type="button"
          className="btn btn--icon player-toolbar__end"
          onClick={fullscreen.toggle}
          aria-label={fullscreen.active ? '離開全螢幕' : '全螢幕（含字幕）'}
          title={fullscreen.active ? '離開全螢幕' : '全螢幕（含字幕）'}
        >
          {fullscreen.active ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>
    </div>
  );
}
