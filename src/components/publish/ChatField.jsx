import { useState } from 'react';
import { MessageSquareText, RotateCcw, Trash2, Upload } from 'lucide-react';
import { convertYtDlpChat } from '../../lib/chat.js';
import { formatTimestamp } from '../../lib/notes.js';

const MAX_INPUT_BYTES = 500 * 1024 * 1024;
const WARN_OUTPUT_BYTES = 10 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 50 * 1024 * 1024; // GitHub 單檔超過 50 MB 會警告、100 MB 會拒絕

export const NO_CHAT = { mode: 'none', path: null };

/** videos.json 的 chat 欄位 → 欄位狀態 */
export function chatState(path) {
  return path ? { mode: 'keep', path } : NO_CHAT;
}

export function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * 聊天室重播檔案：上傳 yt-dlp 的 live_chat.json，在瀏覽器轉成純文字精簡格式。
 * value.mode：none（沒有）、keep（沿用 repo 裡的）、new（這次上傳的）、remove（發布時刪除）
 */
export default function ChatField({ value, onChange, youtubeId, disabled }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);

  const accept = async (file) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_INPUT_BYTES) {
      setError('檔案超過 500 MB 上限。');
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      // 讓「轉換中」先顯示出來，大檔案轉換要幾秒
      await new Promise((resolve) => window.setTimeout(resolve, 30));
      const { data, stats } = convertYtDlpChat(text);
      const json = JSON.stringify(data);
      const size = new Blob([json]).size;
      if (size > MAX_OUTPUT_BYTES) {
        setError(`整理後仍有 ${formatBytes(size)}，超過 GitHub 的檔案大小限制，無法發布。`);
        return;
      }
      onChange({ mode: 'new', path: value.path, previous: value.mode === 'new' ? value.previous : value.mode, json, data, stats, size, fileName: file.name });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // --js-runtimes node：yt-dlp 預設只找 Deno 來解析 YouTube 的 JavaScript，沒有就會警告；改用本機已有的 Node.js
  const command = `yt-dlp --js-runtimes node --skip-download --write-subs --sub-langs live_chat "https://www.youtube.com/watch?v=${youtubeId || '影片ID'}"`;
  const fileInput = (
    <label
      className={`dropzone${dragging ? ' is-dragging' : ''}`}
      onDragEnter={() => setDragging(true)}
      onDragLeave={() => setDragging(false)}
      onDrop={() => setDragging(false)}
    >
      <input
        type="file"
        accept=".json,.jsonl,application/json"
        disabled={disabled || busy}
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <Upload size={24} aria-hidden="true" />
      <strong>{busy ? '讀取並轉換中…' : value.mode === 'none' ? '選擇 live_chat.json' : '換一個 live_chat.json'}</strong>
      <span>或將檔案拖曳至此</span>
    </label>
  );

  return (
    <div className="chat-field">
      {value.mode === 'keep' && (
        <div className="chat-field__status">
          <p>
            <MessageSquareText size={16} aria-hidden="true" /> 已有聊天室紀錄 <span className="mono">{value.path}</span>
          </p>
          <button type="button" className="btn btn--ghost" onClick={() => onChange({ ...value, mode: 'remove' })} disabled={disabled}>
            <Trash2 size={16} aria-hidden="true" />
            移除
          </button>
        </div>
      )}

      {value.mode === 'remove' && (
        <div className="chat-field__status">
          <p>發布後會刪除聊天室紀錄 <span className="mono">{value.path}</span>。</p>
          <button type="button" className="btn btn--ghost" onClick={() => onChange({ ...value, mode: 'keep' })} disabled={disabled}>
            <RotateCcw size={16} aria-hidden="true" />
            復原
          </button>
        </div>
      )}

      {value.mode === 'new' && (
        <div className="chat-field__status">
          <div>
            <p>
              <MessageSquareText size={16} aria-hidden="true" /> <span className="mono">{value.fileName}</span>
            </p>
            <dl className="meta chat-field__stats">
              <div>
                <dt>訊息</dt>
                <dd className="mono">{value.stats.messages.toLocaleString()}</dd>
              </div>
              <div>
                <dt>超級留言</dt>
                <dd className="mono">{value.stats.paid.toLocaleString()}</dd>
              </div>
              <div>
                <dt>時間</dt>
                <dd className="mono">
                  {formatTimestamp(Math.floor(value.stats.start))}–{formatTimestamp(Math.floor(value.stats.end))}
                </dd>
              </div>
              <div>
                <dt>整理後</dt>
                <dd className="mono">{formatBytes(value.size)}</dd>
              </div>
            </dl>
          </div>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => onChange(value.previous === 'keep' || value.previous === 'remove' ? { mode: value.previous, path: value.path } : { ...NO_CHAT, path: value.path })}
            disabled={disabled}
          >
            <RotateCcw size={16} aria-hidden="true" />
            取消這個檔案
          </button>
        </div>
      )}
      {value.mode === 'new' && value.size > WARN_OUTPUT_BYTES && (
        <p className="field__hint">檔案較大，開啟影片頁時需額外下載 {formatBytes(value.size)}（GitHub Pages 會壓縮傳送，實際傳輸量小很多）。</p>
      )}
      {value.mode === 'new' && value.stats.badLines > 0 && (
        <p className="field__hint">有 {value.stats.badLines} 行無法解析，已略過。</p>
      )}

      {fileInput}
      {error && (
        <p className="field__hint field__hint--error" role="alert">
          {error}
        </p>
      )}

      <details className="help">
        <summary>怎麼取得聊天室紀錄？</summary>
        <ol>
          <li>
            安裝 <a href="https://github.com/yt-dlp/yt-dlp" target="_blank" rel="noreferrer">yt-dlp</a>，在終端機執行：
            <pre className="chat-field__command mono">{command}</pre>
          </li>
          <li>
            <code className="mono">--js-runtimes node</code> 讓 yt-dlp 以 Node.js 解析 YouTube，避免出現「No supported JavaScript
            runtime」警告；執行發布頁的電腦已安裝 Node.js，不需另外安裝。
          </li>
          <li>執行後會產生檔名結尾為 <code className="mono">.live_chat.json</code> 的檔案，選擇該檔案即可。</li>
          <li>只會保留文字：時間、名字、身分（直播主、管理員、會員）、訊息、超級留言金額；不存頭貼和圖片，自訂表情會變成 :代碼:。</li>
          <li>yt-dlp 是抓取 YouTube 的資料，不是官方提供的管道，請自行斟酌使用。</li>
        </ol>
      </details>
    </div>
  );
}
