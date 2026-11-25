import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Ticket } from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        跳到主要內容
      </a>
      <header className="site-nav">
        <div className="container site-nav__inner">
          <Link to="/" className="brand">
            <Ticket size={22} aria-hidden="true" />
            非官方字幕
          </Link>
          <nav className="site-nav__links" aria-label="主要導覽">
            <NavLink to="/" end className="nav-link">
              影片列表
            </NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container site-footer__inner">
          <span>非官方字幕 · 外掛字幕依說話人上色</span>
          {/* 只在本機開發時顯示，上線版本不會有（見 App.jsx） */}
          {(import.meta.env.DEV || import.meta.env.VITE_PUBLISH_PAGE === 'true') && (
            <>
              <Link to="/publish" className="site-footer__link">
                發布影片
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
