import { Link } from 'react-router';
import { Play } from 'lucide-react';
import { thumbnailUrl } from '../lib/videos.js';
import { hasTag } from '../lib/tags.js';
import { tagColorProps } from '../lib/tagColors.js';
import TicketTear from './TicketTear.jsx';
import { textLang } from '../lib/lang.js';
import { stripLinks } from '../lib/richText.js';

/**
 * 整張卡片可點進影片頁：標題連結用 ::after 撐滿卡片（不能把標籤按鈕包在連結裡）。
 * 標籤疊在連結上方，點了加入列表的標籤篩選。
 */
/** layout：grid = 卡片（不顯示說明）；list = 縮圖在左、文字在右，撕線改成直的 */
export default function VideoCard({ video, index, layout = 'grid', selectedTags = [], onTagClick }) {
  const tags = video.tags ?? [];

  return (
    <li className="video-card-item" style={{ '--i': index }}>
      <article className={`video-card${layout === 'list' ? ' video-card--row' : ''}`}>
        <div className="video-card__thumb">
          <img src={thumbnailUrl(video)} alt="" loading="lazy" decoding="async" />
          <span className="video-card__play" aria-hidden="true">
            <Play size={20} fill="currentColor" />
          </span>
        </div>
        <TicketTear />
        <div className="video-card__body">
          <h2 className="video-card__title" lang={textLang(video.title)}>
            <Link to={`/video/${encodeURIComponent(video.id)}`} className="video-card__link">
              {video.title}
            </Link>
          </h2>
          {layout === 'list' && video.description && <p className="video-card__desc" lang={textLang(video.description)}>{stripLinks(video.description)}</p>}
          {tags.length > 0 && (
            <ul className="tags video-card__tags" aria-label="標籤">
              {tags.map((tag) => {
                const active = hasTag(selectedTags, tag);
                return (
                  <li key={tag}>
                    <button
                      type="button"
                      className={`tag-chip tag-chip--link${active ? ' is-active' : ''}`}
                      aria-pressed={active}
                      title={active ? '已在篩選中' : `篩選標籤 ${tag}`}
                      onClick={() => onTagClick?.(tag)}
                      {...tagColorProps(tag)}
                    >
                      #{tag}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </article>
    </li>
  );
}
