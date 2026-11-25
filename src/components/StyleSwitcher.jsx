import { useId } from 'react';
import { speakerVars } from '../lib/speakers.js';

export const SUB_STYLES = [
  { key: 'dark', label: '黑底彩字' },
  { key: 'filled', label: '彩框白字' },
  { key: 'light', label: '白框彩字' },
];
export const SUB_STYLE_KEYS = SUB_STYLES.map((s) => s.key);

/** 字幕樣式切換：只顯示圖示，名稱放在 aria-label 與 title；原生 radio，鍵盤方向鍵即可切換 */
export default function StyleSwitcher({ value, onChange, sample }) {
  const name = useId();
  return (
    <fieldset className="seg">
      <legend className="seg__legend">字幕樣式</legend>
      <div className="seg__track">
        {SUB_STYLES.map((style) => (
          <label key={style.key} className="seg__option" title={style.label}>
            <input
              type="radio"
              name={name}
              value={style.key}
              checked={value === style.key}
              onChange={() => onChange(style.key)}
              aria-label={style.label}
            />
            <span className="seg__face">
              <span className="seg__swatch sub-skin" data-sub-style={style.key} style={speakerVars(sample)} aria-hidden="true">
                字
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
