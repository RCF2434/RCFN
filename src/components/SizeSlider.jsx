import { useId } from 'react';

/** 字幕大小：五段，scale 乘在字幕字級上（字級本身會隨播放器高度縮放） */
export const SUB_SIZES = [
  { label: '特小', scale: 0.7 },
  { label: '小', scale: 0.85 },
  { label: '中', scale: 1 },
  { label: '大', scale: 1.2 },
  { label: '特大', scale: 1.45 },
];
export const DEFAULT_SUB_SIZE = 2;
export const isSubSize = (v) => Number.isInteger(v) && v >= 0 && v < SUB_SIZES.length;

export default function SizeSlider({ value, onChange }) {
  const id = useId();
  const current = SUB_SIZES[value] ?? SUB_SIZES[DEFAULT_SUB_SIZE];
  return (
    <div className="size-slider">
      <label htmlFor={id} className="seg__legend">
        字幕大小
      </label>
      <div className="size-slider__row">
        <span className="size-slider__glyph size-slider__glyph--sm" aria-hidden="true">
          字
        </span>
        <input
          id={id}
          type="range"
          min={0}
          max={SUB_SIZES.length - 1}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-valuetext={current.label}
        />
        <span className="size-slider__glyph size-slider__glyph--lg" aria-hidden="true">
          字
        </span>
        <output htmlFor={id} className="size-slider__value">
          {current.label}
        </output>
      </div>
    </div>
  );
}
