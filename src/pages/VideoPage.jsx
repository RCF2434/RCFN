import { useParams } from 'react-router';
import { assetUrl, findVideo, subtitleUrl } from '../lib/videos.js';
import { useChat } from '../hooks/useChat.js';
import { useSubtitles } from '../hooks/useSubtitles.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import VideoView from '../components/VideoView.jsx';
import NotFound from './NotFound.jsx';

export default function VideoPage() {
  const { id } = useParams();
  const video = findVideo(id);
  const subs = useSubtitles(video ? subtitleUrl(video) : null);
  const chat = useChat(video?.chat ? assetUrl(video.chat) : null);
  useDocumentTitle(video ? video.title : '找不到影片');

  if (!video) return <NotFound message="找不到這支影片，可能是網址有誤或影片已下架。" />;
  return <VideoView video={video} subs={subs} chat={chat} />;
}
