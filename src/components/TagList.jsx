import { Link } from 'react-router';
import { tagColorProps } from '../lib/tagColors.js';

export function tagLink(tag) {
  return { pathname: '/', search: `?tag=${encodeURIComponent(tag)}` };
}

/** 影片的標籤；點下去回到列表並篩選這個標籤 */
export default function TagList({ tags }) {
  if (!tags?.length) return null;
  return (
    <ul className="tags" aria-label="標籤">
      {tags.map((tag) => (
        <li key={tag}>
          <Link to={tagLink(tag)} className="tag-chip tag-chip--link" {...tagColorProps(tag)}>
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
