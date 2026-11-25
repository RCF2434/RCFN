import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base 用相對路徑：搭配 HashRouter，不論 repo 名稱為何都能直接部署到 GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: './',
});
