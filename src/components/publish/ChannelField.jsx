import { useEffect, useId, useRef, useState } from 'react';
import { ExternalLink, KeyRound, Plus, RefreshCw, X } from 'lucide-react';
import { fetchChannel, loadApiKey, parseChannelInput, saveApiKey } from '../../lib/youtubeApi.js';
import ChannelBadge from '../ChannelBadge.jsx';

const DEBOUNCE_MS = 600;
export const MAX_CHANNELS = 5;
const CONSOLE_URL = 'https://console.cloud.google.com/apis/library/youtube.googleapis.com';
const CREDENTIALS_URL = 'https://console.cloud.google.com/apis/credentials';

let nextKey = 0;
const emptyRow = () => ({ key: ++nextKey, link: '', status: 'empty', channel: null, error: null });

/** videos.json 的頻道陣列 → 欄位狀態 */
export function channelRows(channels) {
  return (channels ?? []).map((channel) => ({ key: ++nextKey, link: channel.url, status: 'ready', channel, error: null }));
}

/** 欄位狀態的整體檢查：回傳發布前要處理的問題 */
export function channelProblems(rows) {
  const problems = [];
  if (rows.some((r) => r.status === 'loading')) problems.push('頻道資料讀取中');
  if (rows.some((r) => r.status === 'error')) problems.push('修正頻道連結，或刪掉那一列');
  const ids = rows.filter((r) => r.status === 'ready').map((r) => r.channel.id);
  if (new Set(ids).size !== ids.length) problems.push('同一個頻道加了兩次');
  return problems;
}

/** 一列頻道連結：貼上後自動查名稱與頭貼 */
function ChannelRow({ row, apiKey, onChange, onRemove, disabled, index }) {
  const uid = useId();
  const timer = useRef(0);
  const controller = useRef(null);
  const latest = useRef(row);
  latest.current = row;

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      controller.current?.abort();
    },
    [],
  );

  const set = (patch) => onChange({ ...latest.current, ...patch });

  const lookup = (link, key = apiKey) => {
    window.clearTimeout(timer.current);
    controller.current?.abort();
    const query = parseChannelInput(link);
    if (!query) return set({ link, status: 'empty', channel: null, error: null });
    if (query.error) return set({ link, status: 'error', channel: null, error: query.error });
    if (!key) return set({ link, status: 'error', channel: null, error: '需要先設定下方的 YouTube API 金鑰。' });

    set({ link, status: 'loading', channel: null, error: null });
    timer.current = window.setTimeout(async () => {
      const ac = new AbortController();
      controller.current = ac;
      try {
        const channel = await fetchChannel(key, query, ac.signal);
        if (latest.current.link === link) set({ status: 'ready', channel, error: null });
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (latest.current.link === link) set({ status: 'error', channel: null, error: err.message });
      }
    }, DEBOUNCE_MS);
  };

  // 設定金鑰後，自動重查之前因為沒有金鑰而失敗的那幾列
  useEffect(() => {
    const r = latest.current;
    if (apiKey && r.status === 'error' && r.link) lookup(r.link, apiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <li className="channel-row">
      {row.status === 'ready' ? (
        <div className="channel-field__preview">
          <ChannelBadge channel={row.channel} link={false} />
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={() => lookup(row.link)}
            disabled={disabled || !apiKey}
            aria-label={`重新讀取 ${row.channel.name}`}
            title="重新讀取（頻道換了名稱或頭貼時）"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`移除 ${row.channel.name}`}
            title="移除"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="copy-row">
          <input
            id={uid}
            className="input"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://www.youtube.com/@帳號"
            value={row.link}
            disabled={disabled}
            onChange={(event) => lookup(event.target.value)}
            aria-label={`第 ${index + 1} 個頻道連結`}
          />
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`移除第 ${index + 1} 個頻道`}
            title="移除"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {row.status === 'loading' && <p className="field__hint">讀取頻道中…</p>}
      {row.status === 'error' && (
        <p className="field__hint field__hint--error" role="alert">
          {row.error}
        </p>
      )}
    </li>
  );
}

/** YouTube API 金鑰設定（整個表單共用一組） */
function ApiKeySetting({ apiKey, onSave }) {
  const uid = useId();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const save = () => {
    onSave(draft.trim());
    setDraft('');
    setEditing(false);
  };

  if (apiKey && !editing) {
    return (
      <p className="field__hint">
        已設定 YouTube API 金鑰 ·{' '}
        <button type="button" className="link-button" onClick={() => setEditing(true)}>
          變更
        </button>{' '}
        ·{' '}
        <button type="button" className="link-button" onClick={() => onSave('')}>
          清除
        </button>
      </p>
    );
  }

  return (
    <div className="channel-key">
      <label className="field__label" htmlFor={uid}>
        YouTube API 金鑰
      </label>
      <div className="copy-row">
        <input
          id={uid}
          className="input mono"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="AIza…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (draft.trim()) save();
            }
          }}
        />
        <button type="button" className="btn" onClick={save} disabled={!draft.trim()}>
          儲存
        </button>
        {editing && (
          <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
            取消
          </button>
        )}
      </div>
      <p className="field__hint">只存在這個瀏覽器，只會送到 googleapis.com。</p>
      <details className="help">
        <summary>
          <KeyRound size={16} aria-hidden="true" />
          怎麼取得 API 金鑰？
        </summary>
        <ol>
          <li>
            到 Google Cloud 建立（或選一個）專案，打開{' '}
            <a href={CONSOLE_URL} target="_blank" rel="noreferrer">
              YouTube Data API v3
              <ExternalLink size={13} aria-hidden="true" />
            </a>{' '}
            按「啟用」。
          </li>
          <li>
            到{' '}
            <a href={CREDENTIALS_URL} target="_blank" rel="noreferrer">
              憑證
              <ExternalLink size={13} aria-hidden="true" />
            </a>{' '}
            → 建立憑證 → API 金鑰。
          </li>
          <li>
            建議加上限制：「應用程式限制」選<strong>網站</strong>，加入{' '}
            <code className="mono">http://localhost:5173/*</code>。不要選「IP 位址」：那是給伺服器用的，不能填
            localhost；這裡的金鑰是從瀏覽器送出，要用「網站」限制。
          </li>
          <li>
            埠號以 <code className="mono">npm run dev</code> 印出的網址為準（5173 被占用時會換成 5174
            等）；用 <code className="mono">127.0.0.1</code> 開啟的話也要另外加入。
          </li>
          <li>「API 限制」選限制金鑰，只勾 YouTube Data API v3。</li>
          <li>免費額度每天一萬次，查一個頻道用 1 次。</li>
        </ol>
      </details>
    </div>
  );
}

/**
 * 頻道清單：可以放多個頻道，每列貼上連結後自動向 YouTube Data API 查名稱與頭貼。
 * value：[{ key, link, status: 'empty' | 'loading' | 'ready' | 'error', channel, error }]
 */
export default function ChannelField({ value, onChange, disabled }) {
  const [apiKey, setApiKey] = useState(loadApiKey);
  const rows = value;

  const update = (key, row) => onChange((list) => list.map((r) => (r.key === key ? row : r)));
  const remove = (key) => onChange((list) => list.filter((r) => r.key !== key));
  const add = () => onChange((list) => [...list, emptyRow()]);

  return (
    <div className="channel-field">
      {rows.length > 0 && (
        <ul className="channel-rows">
          {rows.map((row, index) => (
            <ChannelRow
              key={row.key}
              index={index}
              row={row}
              apiKey={apiKey}
              disabled={disabled}
              onChange={(next) => update(row.key, next)}
              onRemove={() => remove(row.key)}
            />
          ))}
        </ul>
      )}
      {rows.length < MAX_CHANNELS ? (
        <button type="button" className="btn btn--ghost channel-field__add" onClick={add} disabled={disabled}>
          <Plus size={16} aria-hidden="true" />
          {rows.length ? '再加一個頻道' : '加入頻道'}
        </button>
      ) : (
        <p className="field__hint">最多 {MAX_CHANNELS} 個頻道。</p>
      )}
      <p className="field__hint">
        貼上頻道首頁的連結，或直接輸入 @帳號，會自動帶出頭貼和名稱。顯示順序就是這裡的順序。
      </p>
      <ApiKeySetting
        apiKey={apiKey}
        onSave={(key) => {
          saveApiKey(key);
          setApiKey(key);
        }}
      />
    </div>
  );
}
