import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

/** 頻道頭貼；圖片載入失敗（例如頻道換了頭貼）就顯示名稱的第一個字 */
export function ChannelAvatar({ channel, size = 44 }) {
  const [failed, setFailed] = useState(false);
  const initial = [...(channel.name ?? '?').trim()][0] ?? '?';
  return channel.avatar && !failed ? (
    <img
      className="channel-avatar"
      src={channel.avatar}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="channel-avatar channel-avatar--initial" style={{ width: size, height: size }} aria-hidden="true">
      {initial}
    </span>
  );
}

/** 頻道卡片：頭貼＋名稱＋@帳號；link 為 true 時整張是連到頻道的連結 */
export default function ChannelBadge({ channel, link = true }) {
  const body = (
    <>
      <ChannelAvatar key={channel.avatar} channel={channel} />
      <span className="channel-badge__text">
        <span className="channel-badge__name">{channel.name}</span>
        {channel.handle && <span className="channel-badge__handle">{channel.handle}</span>}
      </span>
    </>
  );
  if (!link) return <div className="channel-badge">{body}</div>;
  return (
    <a
      className="channel-badge channel-badge--link"
      href={channel.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`${channel.name}（在 YouTube 開啟頻道）`}
    >
      {body}
      <ExternalLink size={16} className="channel-badge__icon" aria-hidden="true" />
    </a>
  );
}
