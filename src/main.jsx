import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/global.css';

/*
 * 網址不用 #（例如 /RCFN/video/xxx）。GitHub Pages 沒有伺服器端路由，靠建置時產生的
 * 404.html 與各影片頁面處理（見 scripts/sitePages.js）。
 * BASE_URL 是網站所在的路徑：本機為 /，GitHub Pages 為 /<repo>/。
 */
const base = import.meta.env.BASE_URL;

// 舊網址 /#/video/xxx → /video/xxx：已經分享出去的連結仍然有效（#note-1 這類頁內錨點不受影響）
if (window.location.hash.startsWith('#/')) {
  window.history.replaceState(null, '', `${base}${window.location.hash.slice(2)}`);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={base.replace(/\/$/, '') || '/'}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
