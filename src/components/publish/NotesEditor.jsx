import { useMemo, useState } from 'react';
import { useNotesDraft } from '../../hooks/useNotesDraft.js';
import { formatSavedAt } from '../../lib/notesDraft.js';
import ConfirmDialog from '../ConfirmDialog.jsx';
import { Clock, Download, Link2, Play, Plus, Upload, X } from 'lucide-react';
import {
  MAX_NOTES_FILE_BYTES,
  cueAt,
  formatTimestamp,
  normalizeNoteUrl,
  parseNotesFile,
  parseTimeInput,
  serializeNotesDraft,
} from '../../lib/notes.js';

let nextKey = 0;
// 每列：時間（輸入的文字）、內容、連結（選填，輸入的文字）
const emptyRow = (time = '') => ({ key: ++nextKey, time, text: '', url: '' });
const urlOf = (n) => (typeof n?.url === 'string' ? n.url : '');

/** videos.json 的 notes → 編輯列 */
export function noteRows(notes) {
  return (Array.isArray(notes) ? notes : [])
    .filter((n) => n && Number.isFinite(n.time))
    .sort((a, b) => a.time - b.time)
    .map((n) => ({ key: ++nextKey, time: formatTimestamp(n.time), text: n.text ?? '', url: urlOf(n) }));
}

/** 草稿裡存的 [{ time: 輸入的文字, text, url? }] → 編輯列 */
export function textRows(list) {
  return (Array.isArray(list) ? list : [])
    .filter((n) => n && typeof n.time === 'string' && typeof n.text === 'string')
    .map((n) => ({ key: ++nextKey, time: n.time, text: n.text, url: urlOf(n) }));
}

const isBlank = (row) => !row.time.trim() && !row.text.trim() && !row.url?.trim();
const badUrl = (row) => normalizeNoteUrl(row.url) === null;

/** 草稿的 [{ time, text, url? }] → 編輯列 */
const draftToRows = (notes) => notes.map((n) => ({ key: ++nextKey, time: n.time, text: n.text, url: urlOf(n) }));

/** 編輯列 → 存檔用的 notes（排序好；整列空白的略過；沒有連結就不寫 url） */
export function rowsToNotes(rows) {
  return rows
    .filter((row) => !isBlank(row))
    .map((row) => {
      const note = { time: parseTimeInput(row.time), text: row.text.trim() };
      const url = normalizeNoteUrl(row.url);
      if (url) note.url = url;
      return note;
    })
    .filter((n) => n.time !== null && n.text)
    .sort((a, b) => a.time - b.time);
}

export function notesProblems(rows) {
  const problems = [];
  const filled = rows.filter((row) => !isBlank(row));
  if (filled.some((row) => parseTimeInput(row.time) === null)) problems.push('修正註釋的時間格式（例如 1:23）');
  if (filled.some((row) => !row.text.trim())) problems.push('填入註釋內容，或刪除空白的註釋');
  if (filled.some(badUrl)) problems.push('修正註釋的連結（需為 http:// 或 https:// 網址）');
  return problems;
}

/** 下載文字檔（發布頁只在本機執行，可以直接觸發下載） */
function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function stamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

/**
 * 註釋編輯：每列一個時間＋內容，編輯內容會自動存成瀏覽器草稿。
 * getCurrentTime：取預覽播放器目前時間；onPreview(秒)：預覽跳到該時間。
 */
export default function NotesEditor({ value: rows, onChange: setRows, cues, getCurrentTime, onPreview, disabled, video }) {
  const draft = useNotesDraft(video?.youtubeId, rows, setRows, draftToRows);
  // 使用者自己的編輯才觸發自動儲存（載入 repo 資料不算）
  const onChange = (next) => {
    draft.markEdited();
    setRows(next);
  };
  // 匯入狀態：pending = 等使用者選「取代」或「加在後面」
  const [io, setIo] = useState({ pending: null, message: null, error: null });
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const filled = rows.filter((row) => !isBlank(row));

  const exportDraft = () => {
    const name = (video?.id || video?.youtubeId || 'draft').replace(/[^\w-]/g, '_');
    downloadText(`notes-${name}-${stamp()}.json`, serializeNotesDraft(rows, video));
    setIo({ pending: null, error: null, message: `已匯出 ${filled.length} 則註釋。` });
  };

  const readFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_NOTES_FILE_BYTES) {
      setIo({ pending: null, message: null, error: '檔案過大，不是有效的註釋檔。' });
      return;
    }
    try {
      const parsed = parseNotesFile(await file.text());
      const mismatch =
        parsed.video?.youtubeId && video?.youtubeId && parsed.video.youtubeId !== video.youtubeId
          ? `此註釋檔原屬於「${parsed.video.title || parsed.video.youtubeId}」，與目前的影片不同。`
          : null;
      if (!filled.length) {
        applyImport(parsed.items, 'replace', mismatch);
      } else {
        setIo({ pending: { items: parsed.items, mismatch, name: file.name }, message: null, error: null });
      }
    } catch (err) {
      setIo({ pending: null, message: null, error: err.message });
    }
  };

  function applyImport(items, mode, mismatch) {
    const imported = items.map((item) => ({ key: ++nextKey, time: item.time, text: item.text, url: item.url ?? '' }));
    onChange((list) => (mode === 'replace' ? imported : [...list.filter((row) => !isBlank(row)), ...imported]));
    setIo({
      pending: null,
      error: null,
      message: `已匯入 ${imported.length} 則註釋${mode === 'append' ? '，加在原本的後面' : ''}。${mismatch ?? ''}`,
    });
  }
  // 依時間排序後的編號，和影片頁、字幕上的（*編號）一致
  const numbers = useMemo(() => {
    const valid = rows
      .map((row, order) => ({ key: row.key, time: parseTimeInput(row.time), text: row.text.trim(), order }))
      .filter((r) => r.time !== null && r.text)
      .sort((a, b) => a.time - b.time || a.order - b.order);
    return new Map(valid.map((r, i) => [r.key, i + 1]));
  }, [rows]);

  const update = (key, patch) => onChange((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key) => onChange((list) => list.filter((r) => r.key !== key));
  const now = () => {
    const t = getCurrentTime?.();
    return Number.isFinite(t) ? formatTimestamp(Math.round(t * 10) / 10) : '';
  };

  return (
    <div className="notes-editor">
      {draft.offer && (
        <div className="notice notes-io__confirm" role="alert">
          <p>
            找到 {formatSavedAt(draft.offer.savedAt)} 自動儲存的註釋草稿（{draft.offer.notes.length} 則），和目前的內容不同。
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={draft.restore} disabled={disabled}>
              還原草稿
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmDiscard(true)} disabled={disabled}>
              捨棄草稿
            </button>
          </div>
        </div>
      )}
      {draft.restoredAt && (
        <p className="field__hint" role="status">
          已還原 {formatSavedAt(draft.restoredAt)} 自動儲存的草稿 ·{' '}
          <button type="button" className="link-button" onClick={() => setConfirmDiscard(true)} disabled={disabled}>
            捨棄草稿
          </button>
        </p>
      )}
      <ConfirmDialog
        open={confirmDiscard}
        title="捨棄註釋草稿？"
        confirmLabel="捨棄草稿"
        cancelLabel="保留"
        danger
        onConfirm={() => {
          setConfirmDiscard(false);
          draft.discard();
        }}
        onCancel={() => setConfirmDiscard(false)}
      >
        <p>
          {draft.restoredAt
            ? '還原進來的註釋會清空，自動儲存的註釋草稿也會刪除，無法復原。'
            : '自動儲存的註釋草稿會刪除，無法復原。目前畫面上的註釋不受影響。'}
        </p>
      </ConfirmDialog>

      {rows.length > 0 && (
        <ul className="note-rows">
          {rows.map((row) => {
            const seconds = parseTimeInput(row.time);
            const badTime = row.time.trim() !== '' && seconds === null;
            const number = numbers.get(row.key);
            const cue = seconds !== null ? cueAt(cues, seconds) : null;
            const uncovered = seconds !== null && cues.length > 0 && !cue;
            return (
              <li key={row.key} className="note-row">
                <div className="note-row__head">
                  <span className="note-row__num" aria-label={number ? `註釋 ${number}` : '註釋'}>
                    {number ? `*${number}` : '*'}
                  </span>
                  <input
                    className="input mono note-row__time"
                    inputMode="decimal"
                    placeholder="1:23"
                    value={row.time}
                    disabled={disabled}
                    onChange={(event) => update(row.key, { time: event.target.value })}
                    onBlur={() => seconds !== null && update(row.key, { time: formatTimestamp(seconds) })}
                    aria-label="時間"
                    aria-invalid={badTime || undefined}
                  />
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    onClick={() => {
                      const t = now();
                      if (t) update(row.key, { time: t });
                    }}
                    disabled={disabled || !getCurrentTime}
                    aria-label="填入預覽目前播放的時間"
                    title="填入預覽目前播放的時間"
                  >
                    <Clock size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon"
                    onClick={() => seconds !== null && onPreview?.(cue ? cue.start : seconds)}
                    disabled={disabled || seconds === null}
                    aria-label="在預覽跳到這則註釋（從那句字幕開頭）"
                    title="在預覽跳到這則註釋（從那句字幕開頭）"
                  >
                    <Play size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--icon note-row__remove"
                    onClick={() => remove(row.key)}
                    disabled={disabled}
                    aria-label="刪除這則註釋"
                    title="刪除"
                  >
                    <X size={16} />
                  </button>
                </div>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="註釋內容"
                  value={row.text}
                  disabled={disabled}
                  onChange={(event) => update(row.key, { text: event.target.value })}
                  aria-label={number ? `註釋 ${number} 的內容` : '註釋內容'}
                />
                <div className="note-row__url">
                  <Link2 size={16} aria-hidden="true" />
                  <input
                    className="input"
                    type="url"
                    inputMode="url"
                    placeholder="連結（選填），例如 https://x.com/…"
                    value={row.url ?? ''}
                    disabled={disabled}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) => update(row.key, { url: event.target.value })}
                    // 離開欄位時整理網址（例如補上 https://）
                    onBlur={() => {
                      const url = normalizeNoteUrl(row.url);
                      if (url && url !== row.url) update(row.key, { url });
                    }}
                    aria-label={number ? `註釋 ${number} 的連結（選填）` : '註釋的連結（選填）'}
                    aria-invalid={badUrl(row) || undefined}
                  />
                </div>
                {badTime && <p className="field__hint field__hint--error">時間格式無法辨識，格式為 1:23 或 1:02:03。</p>}
                {badUrl(row) && (
                  <p className="field__hint field__hint--error">連結無法辨識，需為 http:// 或 https:// 網址。</p>
                )}
                {cue && number && (
                  <p className="field__hint">
                    會標在 {formatTimestamp(cue.start)}–{formatTimestamp(cue.end)} 這句字幕上，字幕出現時會一併標示（*{number}）。
                  </p>
                )}
                {uncovered && (
                  <p className="field__hint">此時間沒有字幕，字幕上不會標示（*{number ?? '?'}），僅列於影片頁下方。</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <button
        type="button"
        className="btn btn--ghost notes-editor__add"
        onClick={() => onChange((list) => [...list, emptyRow(now())])}
        disabled={disabled}
      >
        <Plus size={16} aria-hidden="true" />
        新增註釋
      </button>
      <div className="notes-io">
        <button type="button" className="btn btn--ghost" onClick={exportDraft} disabled={disabled || !filled.length}>
          <Download size={16} aria-hidden="true" />
          匯出
        </button>
        <label className={`btn btn--ghost notes-io__import${disabled ? ' is-disabled' : ''}`}>
          <input
            type="file"
            accept=".json,application/json"
            disabled={disabled}
            onChange={(event) => {
              readFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Upload size={16} aria-hidden="true" />
          匯入
        </label>
      </div>

      {io.pending && (
        <div className="notice notes-io__confirm" role="alert">
          <p>
            「{io.pending.name}」有 {io.pending.items.length} 則註釋，目前已經有 {filled.length} 則。
            {io.pending.mismatch}
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => applyImport(io.pending.items, 'replace', io.pending.mismatch)}>
              取代目前的註釋
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => applyImport(io.pending.items, 'append', io.pending.mismatch)}
            >
              加在後面
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setIo({ pending: null, message: null, error: null })}>
              取消
            </button>
          </div>
        </div>
      )}
      {io.message && (
        <p className="field__hint" role="status">
          {io.message}
        </p>
      )}
      {io.error && (
        <p className="field__hint field__hint--error" role="alert">
          {io.error}
        </p>
      )}
      {draft.error && (
        <p className="field__hint field__hint--error" role="alert">
          {draft.error}
        </p>
      )}
      {draft.savedAt && !draft.error && (
        <p className="field__hint notes-autosave" role="status">
          已自動儲存草稿（{formatSavedAt(draft.savedAt)}）
        </p>
      )}

      <p className="field__hint">
        註釋會自動儲存為此瀏覽器中的草稿，再次開啟同一支影片時會還原；發布後草稿即清除。如需更換電腦或備份，可「匯出」為檔案，之後再「匯入」。
        新增時會自動填入預覽目前的播放時間。字幕播放至該時間時，該句字幕後方會標示（*編號）；影片頁下方會列出所有註釋，點選編號即可跳至該時間。編號依時間先後自動排列。填入連結的註釋，影片頁會在文字最後加上外連連結（開新分頁）。
      </p>
    </div>
  );
}
