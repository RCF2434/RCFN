import { useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Maximize, Minimize, Settings } from 'lucide-react';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer.js';
import { useActiveCues } from '../hooks/useActiveCues.js';
import { usePlaybackTime } from '../hooks/usePlaybackTime.js';
import { useFullscreen } from '../hooks/useFullscreen.js';
import { useStoredState } from '../hooks/useStoredState.js';
import { PALETTE } from '../lib/speakers.js';
import { BUFFERING, PLAYING } from '../lib/youtube.js';
import { noteMarkers } from '../lib/notes.js';
import { initialLangs, isSubLang, mergeTracks, sortLangs } from '../lib/subtitleTracks.js';
import SubtitleLangPicker from './SubtitleLangPicker.jsx';
import SubtitleOverlay from './SubtitleOverlay.jsx';
import StyleSwitcher, { SUB_STYLE_KEYS } from './StyleSwitcher.jsx';
import SizeSlider, { DEFAULT_SUB_SIZE, SUB_SIZES, isSubSize } from './SizeSlider.jsx';
import ChatPanel from './ChatPanel.jsx';
import Toggle from './Toggle.jsx';

const NO_NOTES = [];
const NO_LANGS = [];
const isStoredLangs = (v) => v === null || (Array.isArray(v) && v.every(isSubLang));

/**
 * tracks：{ zh?: { cues }, en?: …, ja?: … }；languages：這支影片有的語言（固定順序）
 *   工具列可以勾選要顯示哪些語言（雙語、三語），選擇會記在瀏覽器
 * onStatus：播放器載入或出錯時回報 { ready, errorCode }，發布頁用來檢查影片能不能嵌入
 * notes：numberNotes() 整理過的註釋，字幕上會標示（*編號）
 * ref：{ seekTo(秒數), getCurrentTime() }，給註釋連結跳時間、發布頁取目前時間
 * chat：useChat() 的結果；有給才會出現聊天室與工具列的開關
 */
export default function SubtitlePlayer({
  youtubeId,
  tracks,
  languages = NO_LANGS,
  colors,
  onStatus,
  notes = NO_NOTES,
  chat,
  ref,
}) {
  const shellRef = useRef(null);
  const { hostRef, playerRef, ready, error, errorCode, playerState } = useYouTubePlayer(youtubeId);

  /* ---------- 字幕語言：勾選的語言合併成一條時間軸 ---------- */
  const [storedLangs, setStoredLangs] = useStoredState('sub-langs', null, isStoredLangs);
  const langKey = languages.join(',');
  const [selected, setSelected] = useState(() => initialLangs(storedLangs, languages));
  // 換影片（可用語言改變）時，依上次的偏好重新決定
  useEffect(() => {
    setSelected(initialLangs(storedLangs, languages));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langKey]);
  // 用 langKey（內容）當依賴：呼叫端每次傳新陣列也不會讓時間軸重建、字幕閃爍
  const visibleLangs = useMemo(
    () => sortLangs(selected.filter((key) => langKey.split(',').includes(key))),
    [selected, langKey],
  );
  const toggleLang = (key) => {
    const next = sortLangs(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
    setSelected(next);
    setStoredLangs(next);
  };
  const cues = useMemo(() => mergeTracks(tracks, visibleLangs), [tracks, visibleLangs]);
  // 註釋標示只標在主語言（第一個勾選的），不會每種語言各標一次
  const primaryCues = useMemo(() => cues.filter((cue) => cue.lang === visibleLangs[0]), [cues, visibleLangs]);
  const markers = useMemo(() => noteMarkers(primaryCues, notes), [primaryCues, notes]);

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

  // 聊天室重播：放在影片右邊（窄螢幕在下方），工具列可開關，偏好記在瀏覽器
  const hasChat = Boolean(chat) && chat.status !== 'idle';
  const [chatOpen, setChatOpen] = useStoredState('chat-open', true, (v) => typeof v === 'boolean');
  const showChat = hasChat && chatOpen;
  const chatTime = usePlaybackTime(playerRef, ready && showChat);

  /* ---------- 手機版的設定面板（齒輪） ---------- */
  const settingsId = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);
  const gearRef = useRef(null);
  // 點面板外面或按 Esc 關閉（Esc 時焦點回到齒輪）
  useEffect(() => {
    if (!settingsOpen) return undefined;
    const onPointerDown = (event) => {
      if (!settingsRef.current?.contains(event.target) && !gearRef.current?.contains(event.target)) {
        setSettingsOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setSettingsOpen(false);
      gearRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [settingsOpen]);
  // 開始播放就收起來（點影片本身時事件進不到這個頁面，所以用播放狀態判斷）
  useEffect(() => {
    if (playing) setSettingsOpen(false);
  }, [playing]);

  const shellClass = [
    'player-shell',
    fullscreen.active && 'is-fs scheme-dark',
    fullscreen.pseudo && 'is-pseudo-fs',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={shellRef} className={shellClass} data-playing={playing || undefined}>
      <div className={`player-body${showChat ? ' has-chat' : ''}`}>
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
          langs={visibleLangs}
          colors={colors}
          styleKey={subStyle}
          scale={SUB_SIZES[subSize].scale}
          markers={markers}
        />
      </div>
      {showChat && (
        <div className="player-chat">
          <ChatPanel chat={chat} time={chatTime} onClose={() => setChatOpen(false)} />
        </div>
      )}
      </div>

      <div className="player-toolbar">
        {/* 手機版：設定收進齒輪，點開在工具列上方顯示面板（桌機版齒輪隱藏，設定直接排在工具列上） */}
        <button
          ref={gearRef}
          type="button"
          className="btn btn--icon player-settings-toggle"
          aria-expanded={settingsOpen}
          aria-controls={settingsId}
          aria-label="字幕設定"
          title="字幕設定"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <Settings size={20} />
        </button>
        <div ref={settingsRef} id={settingsId} className={`player-settings${settingsOpen ? ' is-open' : ''}`}>
          {languages.length > 0 && (
            <SubtitleLangPicker languages={languages} selected={visibleLangs} onToggle={toggleLang} />
          )}
          <StyleSwitcher value={subStyle} onChange={setSubStyle} sample={sample} />
          <SizeSlider value={subSize} onChange={setSubSize} />
          {hasChat && (
            <Toggle checked={chatOpen} onChange={setChatOpen}>
              聊天室
            </Toggle>
          )}
        </div>
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
