import { useCallback, useEffect, useRef, useState } from 'react';
import { createGitHub } from '../lib/github.js';
import { clearToken, loadSettings, saveSettings } from '../lib/githubSettings.js';

const IDLE = { status: 'idle', gh: null, videos: null, tagColors: null, headSha: null, error: null };

/**
 * 發布頁與標籤顏色頁共用的 GitHub 連線：
 * 連線時讀分支最新的 videos.json 與 tags.json；有記住的 token 就自動連線。
 */
export function useGitHubConnection() {
  const [settings, setSettings] = useState(loadSettings);
  const [conn, setConn] = useState(IDLE);
  const seqRef = useRef(0);

  const connect = useCallback(async (next) => {
    const seq = ++seqRef.current;
    saveSettings(next);
    setSettings(next);
    const gh = createGitHub(next);
    setConn((c) => ({ ...c, status: 'connecting', error: null }));
    try {
      const head = await gh.getHead(next.branch);
      const [videos, tagColors] = await Promise.all([gh.readVideos(head.commitSha), gh.readTagColors(head.commitSha)]);
      if (seq === seqRef.current) {
        setConn({ status: 'ready', gh, videos, tagColors, headSha: head.commitSha, error: null });
      }
    } catch (err) {
      if (seq === seqRef.current) setConn({ ...IDLE, status: 'error', error: err.message });
    }
  }, []);

  const initial = useRef(settings);
  useEffect(() => {
    const s = initial.current;
    if (s.token && s.owner && s.repo) connect(s);
  }, [connect]);

  const disconnect = useCallback(() => {
    seqRef.current += 1;
    clearToken();
    setSettings((s) => ({ ...s, token: '' }));
    setConn(IDLE);
  }, []);

  return { settings, conn, setConn, connect, disconnect };
}
