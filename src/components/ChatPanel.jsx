import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, X } from 'lucide-react';
import { lastIndexAt } from '../lib/chat.js';
import { formatTimestamp } from '../lib/notes.js';
import { textLang } from '../lib/lang.js';

/** 同時保留在畫面上的訊息數；太多會讓捲動與渲染變慢 */
const MAX_VISIBLE = 150;
const STICK_THRESHOLD = 48;

const ROLE_LABEL = { o: '直播主', m: '管理員', s: '會員', v: '已驗證' };

function ChatMessage({ message }) {
  const { author, content, paid, member } = message;
  const role = author.role;
  const name = (
    <span className={`chat-msg__author${role ? ` chat-msg__author--${role}` : ''}`} title={ROLE_LABEL[role]}>
      {author.name}
    </span>
  );

  if (paid) {
    return (
      <li className="chat-msg chat-msg--paid" style={{ background: paid.bg ?? undefined, color: paid.fg ?? undefined }}>
        <div className="chat-msg__paid-head">
          <span className="chat-msg__paid-name">{author.name}</span>
          <strong className="chat-msg__amount">{paid.amount}</strong>
        </div>
        {content && (
          <p className="chat-msg__text" lang={textLang(content)}>
            {content}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className={`chat-msg${member ? ' chat-msg--member' : ''}`}>
      <span className="chat-msg__time">{formatTimestamp(Math.floor(message.t))}</span>
      {name}
      <span className="chat-msg__text" lang={textLang(content)}>
        {content}
      </span>
    </li>
  );
}

/**
 * 聊天室重播：依播放時間顯示到目前為止的訊息，自動捲到最新；
 * 使用者往上捲時暫停自動捲動，出現「回到最新」按鈕。
 */
export default function ChatPanel({ chat, time, onClose }) {
  const listRef = useRef(null);
  const [stuck, setStuck] = useState(true);
  const stuckRef = useRef(true);

  const messages = chat.messages;
  const last = chat.status === 'ready' ? lastIndexAt(messages, time) : -1;
  const visible = last < 0 ? [] : messages.slice(Math.max(0, last - MAX_VISIBLE + 1), last + 1);
  const lastId = visible.at(-1)?.id ?? -1;

  // 新訊息進來（或拖動進度條）時，若停在最底下就捲到最新
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stuckRef.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD;
    if (atBottom !== stuckRef.current) {
      stuckRef.current = atBottom;
      setStuck(atBottom);
    }
  };

  const jumpToLatest = () => {
    const el = listRef.current;
    if (!el) return;
    stuckRef.current = true;
    setStuck(true);
    el.scrollTop = el.scrollHeight;
  };

  return (
    <section className="chat-panel" aria-label="聊天室重播">
      <header className="chat-panel__head">
        <h2 className="chat-panel__title">聊天室重播</h2>
        {onClose && (
          <button type="button" className="chat-panel__close" onClick={onClose} aria-label="關閉聊天室" title="關閉聊天室">
            <X size={18} />
          </button>
        )}
      </header>

      {chat.status === 'loading' && <p className="chat-panel__status">聊天室載入中…</p>}
      {chat.status === 'error' && (
        <p className="chat-panel__status chat-panel__status--error" role="alert">
          聊天室載入失敗（{chat.error}）
        </p>
      )}
      {chat.status === 'ready' && visible.length === 0 && <p className="chat-panel__status">還沒有人留言。</p>}

      <ol ref={listRef} className="chat-panel__list" onScroll={onScroll}>
        {visible.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </ol>

      {!stuck && visible.length > 0 && (
        <button type="button" className="chat-panel__latest" onClick={jumpToLatest}>
          <ArrowDown size={16} aria-hidden="true" />
          回到最新
        </button>
      )}
    </section>
  );
}
