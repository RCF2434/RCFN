import { useMemo, useRef } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { assetUrl, findVideo, subtitleUrl, videoChannels, watchUrl } from '../lib/videos.js';
import { useChat } from '../hooks/useChat.js';
import { resolveSpeakerColors } from '../lib/speakers.js';
import { useSubtitles } from '../hooks/useSubtitles.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import SubtitlePlayer from '../components/SubtitlePlayer.jsx';
import TagList from '../components/TagList.jsx';
import ChannelBadge from '../components/ChannelBadge.jsx';
import NotesList from '../components/NotesList.jsx';
import { jumpTime, numberNotes } from '../lib/notes.js';
import NotFound from './NotFound.jsx';
import { textLang } from '../lib/lang.js';

export default function VideoPage() {
  const { id } = useParams();
  const video = findVideo(id);
  const subs = useSubtitles(video ? subtitleUrl(video) : null);
  const chat = useChat(video?.chat ? assetUrl(video.chat) : null);
  const colors = useMemo(() => resolveSpeakerColors(subs.speakers, video?.speakers), [subs.speakers, video]);
  // jumpTo：點編號時跳到的時間（那句字幕的開頭）
  const notes = useMemo(
    () => numberNotes(video?.notes).map((note) => ({ ...note, jumpTo: jumpTime(subs.cues, note.time) })),
    [video, subs.cues],
  );
  const playerRef = useRef(null);
  useDocumentTitle(video ? video.title : '找不到影片');

  if (!video) return <NotFound message="找不到這支影片，可能是網址有誤或影片已下架。" />;

  const channels = videoChannels(video);

  return (
    <div className="container video-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={18} aria-hidden="true" />
        返回列表
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
          <h2 id="about-title" className="panel__title">
            關於這支影片
          </h2>
          {video.description ? <p className="panel__text" lang={textLang(video.description)}>
              {video.description}
            </p> : <p className="muted">沒有說明。</p>}
          <a className="btn btn--ghost" href={watchUrl(video)} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden="true" />
            在 YouTube 開啟
          </a>
        </section>

        <section className="panel panel--ticket" aria-labelledby="tags-title">
          <p className="eyebrow">Tags</p>
          <h2 id="tags-title" className="panel__title">
            標籤
          </h2>
          {video.tags?.length ? <TagList tags={video.tags} /> : <p className="muted">沒有標籤。</p>}
          {channels.length > 0 && (
            <div className="video-channel">
              <p className="field__label">頻道</p>
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
          <h2 id="notes-title" className="panel__title">
            註釋
          </h2>
          <NotesList notes={notes} onJump={(note) => playerRef.current?.seekTo(note.jumpTo)} />
        </section>
      )}
    </div>
  );
}
