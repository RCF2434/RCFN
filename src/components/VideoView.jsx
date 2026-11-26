import { useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { videoChannels, watchUrl } from '../lib/videos.js';
import { resolveSpeakerColors } from '../lib/speakers.js';
import { LANG_BY_KEY, referenceCues, sortLangs } from '../lib/subtitleTracks.js';
import SubtitlePlayer from './SubtitlePlayer.jsx';
import TagList from './TagList.jsx';
import ChannelBadge from './ChannelBadge.jsx';
import NotesList from './NotesList.jsx';
import TicketTear from './TicketTear.jsx';
import LinkedText from './LinkedText.jsx';
import Collapsible from './Collapsible.jsx';

// 說明、註釋過長時先收合的高度（px）：說明約 8 行
const ABOUT_COLLAPSED = 200;
const NOTES_COLLAPSED = 300;

/** 區塊之間的撕線：只在手機版顯示（桌機的區塊各有外框，見 .video-divider） */
function SectionDivider() {
  return (
    <div className="video-divider">
      <TicketTear />
    </div>
  );
}
import { getList, listLink, videoListKey } from '../lib/lists.js';
import { jumpTime, numberNotes } from '../lib/notes.js';
import { textLang } from '../lib/lang.js';

/**
 * 影片頁的內容。正式影片頁與發布前的預覽頁共用，確保預覽和上線後一樣。
 * @param {{
 *   video: object,                       // videos.json 的一筆
 *   subs: { status, tracks: { zh?, en?, ja? }, speakers, errors }, // useSubtitleTracks 的結果（多語字幕）
 *   chat?: object,                       // useChat 的結果；沒有聊天室紀錄時不傳
 *   banner?: import('react').ReactNode,  // 頁面最上方的提示（預覽用）
 * }} props
 */
export default function VideoView({ video, subs, chat, banner }) {
  const colors = useMemo(() => resolveSpeakerColors(subs.speakers, video.speakers), [subs.speakers, video.speakers]);
  // jumpTo：點編號時跳到的時間（那句字幕的開頭；以第一種有字幕的語言為準）
  const notes = useMemo(() => {
    const cues = referenceCues(subs.tracks);
    return numberNotes(video.notes).map((note) => ({ ...note, jumpTo: jumpTime(cues, note.time) }));
  }, [video.notes, subs.tracks]);
  // 載入成功的語言（固定順序）
  const languages = sortLangs(Object.keys(subs.tracks ?? {}));
  const failed = sortLangs(Object.keys(subs.errors ?? {}));
  const playerRef = useRef(null);
  const channels = videoChannels(video);
  const listKey = videoListKey(video);

  return (
    <div className="container video-page">
      {banner}
      <Link to={listLink(listKey)} className="back-link">
        <ArrowLeft size={18} aria-hidden="true" />
        返回 {getList(listKey).label} 列表
      </Link>

      <header className="video-head">
        {video.uploader?.name ? (
          <p className="eyebrow video-head__channel">
            {video.uploader.url ? (
              <a href={video.uploader.url} target="_blank" rel="noreferrer" lang={textLang(video.uploader.name)}>
                {video.uploader.name}
              </a>
            ) : (
              <span lang={textLang(video.uploader.name)}>{video.uploader.name}</span>
            )}
          </p>
        ) : (
          <p className="eyebrow">Now Showing</p>
        )}
        <h1 lang={textLang(video.title)}>{video.title}</h1>
      </header>

      <SubtitlePlayer
        ref={playerRef}
        youtubeId={video.youtubeId}
        tracks={subs.tracks}
        languages={languages}
        colors={colors}
        notes={notes}
        chat={video.chat ? chat : undefined}
      />

      <SectionDivider />
      <div className="video-info">
        <section className="panel" aria-labelledby="about-title">
          <p id="about-title" className="eyebrow">
            About
          </p>
          {video.description ? (
            <Collapsible collapsedHeight={ABOUT_COLLAPSED}>
              <p className="panel__text video-desc" lang={textLang(video.description)}>
                <LinkedText text={video.description} />
              </p>
            </Collapsible>
          ) : (
            <p className="muted">沒有說明。</p>
          )}
          <a className="btn btn--ghost" href={watchUrl(video)} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            在 YouTube 開啟
          </a>
        </section>

        <SectionDivider />
        <section className="panel panel--ticket" aria-labelledby="tags-title">
          <p id="tags-title" className="eyebrow">
            Tags
          </p>
          {video.tags?.length ? <TagList tags={video.tags} listKey={listKey} /> : <p className="muted">沒有標籤。</p>}
          {channels.length > 0 && <TicketTear />}
          {channels.length > 0 && (
            <div className="video-channel">
              <p className="eyebrow">Channels</p>
              <ul className="channel-list">
                {channels.map((channel) => (
                  <li key={channel.id ?? channel.url}>
                    <ChannelBadge channel={channel} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {failed.length > 0 && (
            <p className="notice notice--error" role="alert">
              {failed.map((key) => `${LANG_BY_KEY[key].label}字幕載入失敗（${subs.errors[key]}）`).join('、')}
            </p>
          )}
        </section>
      </div>

      {notes.length > 0 && <SectionDivider />}
      {notes.length > 0 && (
        <section className="panel video-notes" aria-labelledby="notes-title">
          <p className="eyebrow">Notes</p>
          <Collapsible collapsedHeight={NOTES_COLLAPSED}>
            <NotesList notes={notes} onJump={(note) => playerRef.current?.seekTo(note.jumpTo)} />
          </Collapsible>
        </section>
      )}
    </div>
  );
}
