import { useId } from 'react';
import { PALETTE, speakerVars, toSpeakerColor } from '../../lib/speakers.js';

/**
 * 一位說話人的顏色選擇：調色盤七色，加上 videos.json 原本的自訂色（若有）。
 * value 是調色盤名稱或 { light, deep }。
 */
export default function SpeakerColorPicker({ name, value, custom, onChange }) {
  const group = useId();
  const current = toSpeakerColor(value);
  const options = custom ? [...PALETTE, { key: null, label: '自訂', ...custom }] : PALETTE;

  return (
    <fieldset className="speaker-picker">
      <legend className="speaker-chip" style={speakerVars(current ?? PALETTE[0])}>
        <span className="speaker-chip__dot" aria-hidden="true" />
        {name}
      </legend>
      <div className="swatches">
        {options.map((option) => {
          const checked = option.key ? current?.key === option.key : current && !current.key;
          return (
            <label key={option.key ?? 'custom'} className="swatch" title={option.label}>
              <input
                type="radio"
                name={group}
                checked={Boolean(checked)}
                onChange={() => onChange(option.key ?? custom)}
                aria-label={`${name}：${option.label}`}
              />
              <span className="swatch__dot" style={speakerVars(option)} aria-hidden="true" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
