import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { onDraftChange, readDraft } from '../lib/previewDraft.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import VideoView from '../components/VideoView.jsx';

/** 發布前預覽：顯示發布頁目前的草稿，版面和正式影片頁相同。只在本機開發時存在。 */
export default function PreviewPage() {
  const [state, setState] = useState(readDraft);
  // 發布頁關掉後保留最後一份草稿繼續顯示
  const [last, setLast] = useState(() => (state.status === 'ready' ? state.draft : null));

  useEffect(() => {
    const refresh = () => {
      const next = readDraft();
      setState(next);
      if (next.status === 'ready') setLast(next.draft);
    };
    const stop = onDraftChange(refresh);
    window.addEventListener('focus', refresh);
    return () => {
      stop();
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const draft = last;
  useDocumentTitle(draft ? `預覽：${draft.video.title || '未命名'}` : '預覽');

  if (!draft) {
    return (
      <div className="container video-page">
        <p className="notice notice--warning" role="status">
          沒有可預覽的草稿。請由發布頁的「在新分頁預覽影片頁」開啟此頁。
        </p>
      </div>
    );
  }

  const banner = (
    <p className={`notice ${state.status === 'ready' ? 'notice--preview' : 'notice--warning'}`} role="status">
      <Eye size={16} aria-hidden="true" />
      {state.status === 'ready'
        ? '發布前預覽：僅限本機檢視，發布頁的修改會自動同步。'
        : '發布頁已關閉，此處顯示最後一份草稿，不會再更新。'}
    </p>
  );

  return <VideoView video={draft.video} subs={draft.subs} chat={draft.chat} banner={banner} />;
}
