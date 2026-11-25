import { useId } from 'react';
import { PALETTE, speakerVars, swatchVars, toSpeakerColor } from '../../lib/speakers.js';
import { SUBTITLE_BACKGROUNDS } from '../../lib/contrast.js';
import HexField from './HexField.jsx';

/** 字幕在某種樣式下的樣子（沿用播放器的 sub-skin 規則），放在色碼欄位旁 */
function SubtitlePreview({ name, color, styles }) {
  return (
    <span className="speaker-preview" aria-hidden="true">
      {styles.map((style) => (
        <span key={style} className="speaker-preview__line sub-skin" data-sub-style={style} style={speakerVars(color)}>
          {name}
        </span>
      ))}
    </span>
  );
}

/**
 * 一位說話人的顏色選擇：調色盤七色，或自訂兩個色階。
 * value 是調色盤名稱或 { light, deep }；custom 是 videos.json 原本存的自訂色（若有），選「自訂」時從它開始改。
 */
export default function SpeakerColorPicker({ name, value, custom, onChange }) {
  const group = useId();
  const current = toSpeakerColor(value) ?? PALETTE[0];
  const isCustom = !current.key;

  return (
    <fieldset className="speaker-picker">
      <legend className="speaker-chip" style={swatchVars(current)}>
        <span className="speaker-chip__dot" aria-hidden="true" />
        {name}
      </legend>
      <div className="swatches">
        {PALETTE.map((option) => (
          <label key={option.key} className="swatch" title={option.label}>
            <input
              type="radio"
              name={group}
              checked={current.key === option.key}
              onChange={() => onChange(option.key)}
              aria-label={`${name}：${option.label}`}
            />
            <span className="swatch__dot" style={swatchVars(option)} aria-hidden="true" />
          </label>
        ))}
        <label className="swatch swatch--custom" title="自訂顏色">
          <input
            type="radio"
            name={group}
            checked={isCustom}
            // 有存過的自訂色就從它開始；否則從目前的調色盤顏色開始改
            onChange={() => {
              const start = custom ?? current;
              onChange({ light: start.light, deep: start.deep });
            }}
            aria-label={`${name}：自訂顏色`}
          />
          <span
            className="swatch__dot swatch__dot--custom"
            style={isCustom ? speakerVars(current) : undefined}
            aria-hidden="true"
          />
          <span className="swatch__text">自訂</span>
        </label>
      </div>

      {isCustom && (
        <div className="hex-fields">
          <HexField
            label="淺色階（黑底彩字的文字）"
            value={current.light}
            background={SUBTITLE_BACKGROUNDS.dark}
            onChange={(light) => onChange({ light, deep: current.deep })}
          >
            <SubtitlePreview name={name} color={current} styles={['dark']} />
          </HexField>
          <HexField
            label="深色階（白框彩字的文字、彩框白字的外框）"
            value={current.deep}
            background={SUBTITLE_BACKGROUNDS.white}
            onChange={(deep) => onChange({ light: current.light, deep })}
          >
            <SubtitlePreview name={name} color={current} styles={['light', 'filled']} />
          </HexField>
        </div>
      )}
    </fieldset>
  );
}
