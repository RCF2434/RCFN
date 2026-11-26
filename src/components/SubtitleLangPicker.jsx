import { Check } from 'lucide-react';
import { LANG_BY_KEY } from '../lib/subtitleTracks.js';

/**
 * 工具列的字幕語言：勾選要顯示哪些語言（可複選做雙語、三語；全部取消就是關閉字幕）。
 * 只列出這支影片有的語言。
 */
export default function SubtitleLangPicker({ languages, selected, onToggle }) {
  return (
    <fieldset className="seg lang-picker">
      <legend className="seg__legend">字幕語言</legend>
      <div className="seg__track">
        {languages.map((key) => {
          const lang = LANG_BY_KEY[key];
          return (
            <label key={key} className="seg__option">
              <input type="checkbox" checked={selected.includes(key)} onChange={() => onToggle(key)} />
              <span className="seg__face">
                <span className="lang-picker__box" aria-hidden="true">
                  <Check size={14} strokeWidth={3} />
                </span>
                <span lang={lang.lang}>{lang.label}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
