import { Link } from 'react-router';
import { tagColorProps } from '../lib/tagColors.js';
import { listLink } from '../lib/lists.js';

/** 影片的標籤；點下去回到影片所屬的列表並篩選這個標籤 */
export default function TagList({ tags, listKey }) {
  if (!tags?.length) return null;
  return (
    <ul className="tags" aria-label="標籤">
      {tags.map((tag) => (
        <li key={tag}>
          <Link to={listLink(listKey, tag)} className="tag-chip tag-chip--link" {...tagColorProps(tag)}>
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
