import { lazy, Suspense } from 'react';
import { Route, Routes, useParams } from 'react-router';
import Layout from './components/Layout.jsx';
import ListPage from './pages/ListPage.jsx';
import { LISTS } from './lib/lists.js';
import VideoPage from './pages/VideoPage.jsx';
import NotFound from './pages/NotFound.jsx';
import PrivacyPage from './pages/PrivacyPage.jsx';

// 發布頁只在本機開發（npm run dev）時出現；上線版本（npm run build）不會有路由，也不會打包發布頁的程式碼。
// 想讓上線版本也有發布頁，建置時設環境變數 VITE_PUBLISH_PAGE=true。
// 條件要直接寫 import.meta.env（不能用 import 進來的常數），建置時才會被換成常數、整段移除。
const PublishPage =
  import.meta.env.DEV || import.meta.env.VITE_PUBLISH_PAGE === 'true'
    ? lazy(() => import('./pages/PublishPage.jsx'))
    : null;
const TagColorsPage =
  import.meta.env.DEV || import.meta.env.VITE_PUBLISH_PAGE === 'true'
    ? lazy(() => import('./pages/TagColorsPage.jsx'))
    : null;
const PreviewPage =
  import.meta.env.DEV || import.meta.env.VITE_PUBLISH_PAGE === 'true'
    ? lazy(() => import('./pages/PreviewPage.jsx'))
    : null;
const ManagePage =
  import.meta.env.DEV || import.meta.env.VITE_PUBLISH_PAGE === 'true'
    ? lazy(() => import('./pages/ManagePage.jsx'))
    : null;

/** 編輯影片：沿用發布頁的表單；key 讓換一支影片時整頁重新載入 */
function EditVideoRoute() {
  const { id } = useParams();
  return <PublishPage key={id} editId={id} />;
}

const loading = <div className="container page-loading">載入中…</div>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* 每個列表一個網址；key 讓切換列表時清空搜尋字 */}
        {LISTS.map((l) =>
          l.path === '/' ? (
            <Route key={l.key} index element={<ListPage key={l.key} listKey={l.key} />} />
          ) : (
            <Route key={l.key} path={l.path.slice(1)} element={<ListPage key={l.key} listKey={l.key} />} />
          ),
        )}
        <Route path="video/:id" element={<VideoPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        {PublishPage && (
          <Route
            path="publish"
            element={
              <Suspense fallback={<div className="container page-loading">載入中…</div>}>
                <PublishPage />
              </Suspense>
            }
          />
        )}
        {TagColorsPage && (
          <Route
            path="tag-colors"
            element={
              <Suspense fallback={<div className="container page-loading">載入中…</div>}>
                <TagColorsPage />
              </Suspense>
            }
          />
        )}
        {PreviewPage && (
          <Route
            path="preview"
            element={
              <Suspense fallback={<div className="container page-loading">載入中…</div>}>
                <PreviewPage />
              </Suspense>
            }
          />
        )}
        {ManagePage && (
          <Route
            path="manage"
            element={
              <Suspense fallback={loading}>
                <ManagePage />
              </Suspense>
            }
          />
        )}
        {PublishPage && (
          <Route
            path="manage/:id"
            element={
              <Suspense fallback={loading}>
                <EditVideoRoute />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
