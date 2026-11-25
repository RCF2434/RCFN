import { useEffect, useState } from 'react';
import { readChatData } from '../lib/chat.js';

const IDLE = { status: 'idle', messages: [], error: null };

/** 載入聊天室重播（public/chats/<id>.json）；url 為 null 時不載入 */
export function useChat(url) {
  const [state, setState] = useState(IDLE);

  useEffect(() => {
    if (!url) {
      setState(IDLE);
      return undefined;
    }
    const controller = new AbortController();
    setState({ status: 'loading', messages: [], error: null });
    fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((json) => setState({ status: 'ready', error: null, ...readChatData(json) }))
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setState({ status: 'error', messages: [], error: err.message });
      });
    return () => controller.abort();
  }, [url]);

  return state;
}
