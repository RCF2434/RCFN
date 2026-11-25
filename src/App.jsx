import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import Layout from './components/Layout.jsx';
import ListPage from './pages/ListPage.jsx';
import VideoPage from './pages/VideoPage.jsx';
import NotFound from './pages/NotFound.jsx';

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

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ListPage />} />
        <Route path="video/:id" element={<VideoPage />} />
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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
