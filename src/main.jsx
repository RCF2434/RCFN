import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import App from './App.jsx';
import './styles/tokens.css';
import './styles/global.css';

// GitHub Pages 沒有伺服器端路由，用 HashRouter（/#/video/xxx）避免重新整理時 404
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
