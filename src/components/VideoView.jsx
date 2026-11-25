import { useMemo, useRef } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { videoChannels, watchUrl } from '../lib/videos.js';
import { resolveSpeakerColors } from '../lib/speakers.js';
import SubtitlePlayer from './SubtitlePlayer.jsx';
import TagList from './TagList.jsx';
import ChannelBadge from './ChannelBadge.jsx';
import NotesList from './NotesList.jsx';
import TicketTear from './TicketTear.jsx';
import LinkedText from './LinkedText.jsx';
import { getList, listLink, videoListKey } from '../lib/lists.js';
import { jumpTime, numberNotes } from '../lib/notes.js';
import { textLang } from '../lib/lang.js';

/**
 * 影片頁的內容。正式影片頁與發布前的預覽頁共用，確保預覽和上線後一樣。
 * @param {{
 *   video: object,                       // videos.json 的一筆
 *   subs: { status: string, cues: object[], speakers: string[], error: string | null },
 *   chat?: object,                       // useChat 的結果；沒有聊天室紀錄時不傳
 *   banner?: import('react').ReactNode,  // 頁面最上方的提示（預覽用）
 * }} props
 */
export default function VideoView({ video, subs, chat, banner }) {
  const colors = useMemo(() => resolveSpeakerColors(subs.speakers, video.speakers), [subs.speakers, video.speakers]);
  // jumpTo：點編號時跳到的時間（那句字幕的開頭）
  const notes = useMemo(
    () => numberNotes(video.notes).map((note) => ({ ...note, jumpTo: jumpTime(subs.cues, note.time) })),
    [video.notes, subs.cues],
  );
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
        cues={subs.cues}
        colors={colors}
        notes={notes}
        chat={video.chat ? chat : undefined}
      />

      <div className="video-info">
        <section className="panel" aria-labelledby="about-title">
          <p id="about-title" className="eyebrow">
            About
          </p>
          {video.description ? (
            <p className="panel__text video-desc" lang={textLang(video.description)}>
              <LinkedText text={video.description} />
            </p>
          ) : (
            <p className="muted">沒有說明。</p>
          )}
          <a className="btn btn--ghost" href={watchUrl(video)} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            在 YouTube 開啟
          </a>
        </section>

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
          {subs.status === 'error' && (
            <p className="notice notice--error" role="alert">
              字幕載入失敗（{subs.error}），請確認 {video.subtitle} 是否存在。
            </p>
          )}
        </section>
      </div>

      {notes.length > 0 && (
        <section className="panel video-notes" aria-labelledby="notes-title">
          <p className="eyebrow">Notes</p>
          <NotesList notes={notes} onJump={(note) => playerRef.current?.seekTo(note.jumpTo)} />
        </section>
      )}
    </div>
  );
}
