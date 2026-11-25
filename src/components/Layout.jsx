import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Ticket } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';
import { LISTS, videoListKey } from '../lib/lists.js';
import { findVideo } from '../lib/videos.js';

/** 目前在哪個列表：列表頁看網址，影片頁看影片所屬的列表 */
function currentListKey(pathname) {
  const list = LISTS.find((l) => l.path === pathname);
  if (list) return list.key;
  const match = pathname.match(/^\/video\/([^/]+)/);
  const video = match && findVideo(decodeURIComponent(match[1]));
  return video ? videoListKey(video) : null;
}

export default function Layout() {
  const location = useLocation();
  // GitHub Pages 開啟 en/index.html 這類頁面時網址結尾會多一個 /（/en/），比對前先去掉
  const pathname = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : location.pathname;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const activeList = currentListKey(pathname);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        跳到主要內容
      </a>
      <header className="site-nav">
        <div className="container site-nav__inner">
          <Link to="/" className="brand">
            <Ticket size={22} aria-hidden="true" />
            <span>
              RCFN<span className="brand__sub"> · 非官方字幕</span>
            </span>
          </Link>
          <nav className="site-nav__links" aria-label="主要導覽">
            {/* 兩個影片列表；在影片頁時標示影片所屬的列表 */}
            {LISTS.map((l) => (
              <Link
                key={l.key}
                to={l.path}
                className={`nav-link${activeList === l.key ? ' active' : ''}`}
                aria-current={pathname === l.path ? 'page' : undefined}
                lang={l.key === 'nijisanji' ? 'ja' : 'en'}
              >
                {l.label}
              </Link>
            ))}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container site-footer__inner">
          <span>RCFN · にじさんじ非官方字幕</span>
          {(import.meta.env.DEV || import.meta.env.VITE_PUBLISH_PAGE === 'true') && (
            <>
              <Link to="/publish" className="site-footer__link">
                發布影片
              </Link>
              <Link to="/manage" className="site-footer__link">
                管理影片
              </Link>
              <Link to="/tag-colors" className="site-footer__link">
                標籤顏色
              </Link>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
