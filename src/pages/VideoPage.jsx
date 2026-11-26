import { useParams } from 'react-router';
import { useMemo } from 'react';
import { assetUrl, findVideo } from '../lib/videos.js';
import { videoSubtitles } from '../lib/subtitleTracks.js';
import { useChat } from '../hooks/useChat.js';
import { useSubtitleTracks } from '../hooks/useSubtitleTracks.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import VideoView from '../components/VideoView.jsx';
import NotFound from './NotFound.jsx';

export default function VideoPage() {
  const { id } = useParams();
  const video = findVideo(id);
  // 各語言字幕檔的網址：{ zh?, en?, ja? }
  const files = useMemo(
    () => Object.fromEntries(Object.entries(videoSubtitles(video)).map(([lang, path]) => [lang, assetUrl(path)])),
    [video],
  );
  const subs = useSubtitleTracks(files);
  const chat = useChat(video?.chat ? assetUrl(video.chat) : null);
  useDocumentTitle(video ? video.title : '找不到影片');

  if (!video) return <NotFound message="找不到這支影片，可能是網址有誤或影片已下架。" />;
  return <VideoView video={video} subs={subs} chat={chat} />;
}
