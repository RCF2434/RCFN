import { useEffect, useId, useState } from 'react';
import { HEX_RE, MIN_CONTRAST, contrastRatio } from '../../lib/contrast.js';

/**
 * 一個色碼欄位：色盤＋可直接輸入的色碼，旁邊放預覽（children），並顯示與 background 的對比。
 * 標籤顏色頁與說話人顏色共用。
 */
export default function HexField({ label, value, onChange, background, children }) {
  const id = useId();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const ratio = contrastRatio(value, background);
  const low = ratio !== null && ratio < MIN_CONTRAST;

  return (
    <div className="hex-field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <div className="hex-field__row">
        <input
          type="color"
          className="hex-field__picker"
          value={value.toLowerCase()}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={`${label}：用色盤選`}
        />
        <input
          id={id}
          className="input mono"
          value={text}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            setText(event.target.value);
            const hex = event.target.value.trim().replace(/^#?/, '#');
            if (HEX_RE.test(hex)) onChange(hex.toUpperCase());
          }}
          onBlur={() => setText(value)}
        />
        {children}
        {/* 放在預覽右邊：瀏覽器的選色器會蓋住欄位下方 */}
        <p className={`field__hint hex-field__contrast${low ? ' field__hint--error' : ''}`} aria-live="polite">
          對比 {ratio ? ratio.toFixed(1) : '—'}:1{low ? `，低於 ${MIN_CONTRAST}:1，可能看不清楚` : ''}
        </p>
      </div>
    </div>
  );
}
