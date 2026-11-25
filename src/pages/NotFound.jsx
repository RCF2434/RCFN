import { Link } from 'react-router';
import { Clapperboard } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function NotFound({ message = '這個頁面不存在。' }) {
  useDocumentTitle('找不到頁面');
  return (
    <div className="container">
      <div className="empty-state empty-state--page">
        <Clapperboard size={40} aria-hidden="true" />
        <h1>找不到頁面</h1>
        <p>{message}</p>
        <Link to="/" className="btn">
          回到影片列表
        </Link>
      </div>
    </div>
  );
}
