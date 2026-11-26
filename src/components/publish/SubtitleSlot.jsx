import { useId, useState } from 'react';
import { ChevronDown, FileText, Trash2, Upload } from 'lucide-react';
import { ENCODINGS, encodingLabel } from '../../lib/subtitleFile.js';
import { formatTime } from '../../lib/srt.js';
import { LANG_BY_KEY } from '../../lib/subtitleTracks.js';

/**
 * 發布頁「字幕檔」的一種語言：選檔（或拖曳）、編碼、句數與格式問題、移除。
 * sub：{ name, source: 'file' | 'repo', buffer?, text?, loading?, error? }，沒選檔時為 undefined
 * decoded / parsed：這個語言解碼、解析後的結果
 */
export default function SubtitleSlot({ lang, sub, encoding, onEncoding, decoded, parsed, onFile, onRemove, disabled }) {
  const uid = useId();
  const [dragging, setDragging] = useState(false);
  const { label, lang: langAttr } = LANG_BY_KEY[lang];
  const warnings = [...(decoded?.warnings ?? []), ...(parsed?.warnings ?? [])];

  return (
    <section className="sub-slot" aria-labelledby={`${uid}-title`}>
      <div className="sub-slot__head">
        <h3 id={`${uid}-title`} className="sub-slot__title" lang={langAttr}>
          {label}
        </h3>
        {sub ? (
          <button type="button" className="btn btn--ghost btn--small" onClick={onRemove} disabled={disabled}>
            <Trash2 size={15} aria-hidden="true" />
            移除
          </button>
        ) : (
          <span className="muted sub-slot__empty">未上傳</span>
        )}
      </div>

      <label
        className={`dropzone dropzone--compact${dragging ? ' is-dragging' : ''}`}
        onDragEnter={() => setDragging(true)}
        onDragLeave={() => setDragging(false)}
        onDrop={() => setDragging(false)}
      >
        <input
          type="file"
          accept=".srt,.ass,.ssa,.txt"
          disabled={disabled}
          aria-label={`選擇${label}字幕檔`}
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <Upload size={18} aria-hidden="true" />
        <span>
          <strong>{sub ? `換一個${label}字幕檔` : `選擇${label}字幕檔`}</strong>（.srt 或 .ass，可拖曳）
        </span>
      </label>

      {sub && (
        <div className="sub-file">
          <p className="sub-file__name">
            <FileText size={16} aria-hidden="true" />
            <span className="mono">{sub.name}</span>
            {sub.source === 'repo' && <span className="muted">（目前 repo 裡的檔案）</span>}
            {decoded?.convertedFrom && (
              <span className="muted">（已從 {decoded.convertedFrom} 轉成 SRT，發布時存成 .srt）</span>
            )}
          </p>

          {sub.loading && <p className="muted">讀取中…</p>}
          {sub.error && (
            <p className="notice notice--error" role="alert">
              {sub.error}
            </p>
          )}

          {sub.buffer && (
            <div className="field">
              <label className="field__label" htmlFor={`${uid}-enc`}>
                檔案編碼
              </label>
              <div className="select">
                <select
                  id={`${uid}-enc`}
                  className="input"
                  value={encoding}
                  onChange={(event) => onEncoding(event.target.value)}
                >
                  {ENCODINGS.map((e) => (
                    <option key={e.key} value={e.key}>
                      {e.key === 'auto' ? `自動判斷（${encodingLabel(decoded?.encoding)}）` : e.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} aria-hidden="true" />
              </div>
              <p className={`field__hint${decoded?.garbled ? ' field__hint--error' : ''}`}>
                {decoded?.garbled
                  ? '疑似有亂碼，請改用其他編碼。'
                  : '發布時會轉存為 UTF-8。預覽出現亂碼時，請改用其他編碼。'}
              </p>
            </div>
          )}

          {parsed && (
            <dl className="meta">
              <div>
                <dt>句數</dt>
                <dd className="mono">{parsed.cues.length}</dd>
              </div>
              <div>
                <dt>字幕長度</dt>
                <dd className="mono">{formatTime(parsed.cues.at(-1)?.end)}</dd>
              </div>
              <div>
                <dt>說話人</dt>
                <dd className="mono">{parsed.speakers.length}</dd>
              </div>
            </dl>
          )}

          {warnings.length > 0 && (
            <details className="notice notice--warning">
              <summary>有 {warnings.length} 個格式問題（不影響發布，有問題的段落會略過）</summary>
              <ul>
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
