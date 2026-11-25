import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { siteLocation, sitePages } from './scripts/sitePages.js';

/*
 * 網址不用 #（/RCFN/video/xxx），所以 base 要是網站所在的絕對路徑：
 * 本機開發為 /；GitHub Actions 建置時依 repo 名稱自動判斷（見 scripts/sitePages.js）。
 * sitePages 會產生 404.html、各列表與各影片的頁面，並寫入分享預覽用的 meta。
 */
export default defineConfig(({ command }) => {
  const { base, siteUrl } = siteLocation(process.env, command);
  return {
    plugins: [react(), sitePages({ base, siteUrl })],
    base,
  };
});
