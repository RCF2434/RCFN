import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

function currentTheme() {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'dark' || explicit === 'light') return explicit;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);
  const next = theme === 'dark' ? 'light' : 'dark';

  const toggle = () => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('ytsubs:theme', next);
    } catch {
      /* 忽略 */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      className="nav-icon-btn"
      onClick={toggle}
      aria-label={next === 'dark' ? '切換為深色模式' : '切換為淺色模式'}
      title={next === 'dark' ? '深色模式' : '淺色模式'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
