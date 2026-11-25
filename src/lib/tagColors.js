/**
 * 標籤文字顏色。設定存在 src/data/tags.json：
 *   { "動畫": "blue", "訪談": { "light": "#F2C1D9", "deep": "#8A2E5C" } }
 * 值可以是調色盤名稱，或自訂兩個色碼：
 * - deep ：淺色主題（米色底）的文字顏色
 * - light：深色主題（深灰底）的文字顏色
 * 由 CSS 依主題切換。
 */
import data from '../data/tags.json';
import { toSpeakerColor } from './speakers.js';

export const TAG_COLORS = data;

/** 依標籤找顏色（不分大小寫）；沒設定或設定無效回傳 null */
export function tagColor(tag, colors = TAG_COLORS) {
  if (!tag || !colors) return null;
  const k = tag.toLocaleLowerCase();
  for (const [name, value] of Object.entries(colors)) {
    if (name.toLocaleLowerCase() === k) return toSpeakerColor(value);
  }
  return null;
}

/** 比較兩個顏色是否相同 */
export function sameColor(a, b) {
  const id = (c) => (c ? `${c.light}|${c.deep}`.toLowerCase() : '');
  return id(a) === id(b);
}

/** 給標籤元素的屬性：有顏色才加 data-color 與 CSS 變數 */
export function tagColorProps(tag, colors = TAG_COLORS) {
  const color = tagColor(tag, colors);
  if (!color) return {};
  return {
    'data-color': color.key ?? 'custom',
    style: { '--tag-light': color.light, '--tag-deep': color.deep },
  };
}

/** 存檔用：只留有效的設定（調色盤名稱或 { light, deep }），依標籤名稱排序 */
export function serializeTagColors(colors) {
  const entries = Object.entries(colors)
    .filter(([name, value]) => name.trim() && toSpeakerColor(value))
    .map(([name, value]) =>
      typeof value === 'string' ? [name, value] : [name, { light: value.light.toUpperCase(), deep: value.deep.toUpperCase() }],
    )
    .sort(([a], [b]) => a.localeCompare(b, 'zh-Hant'));
  return `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`;
}
