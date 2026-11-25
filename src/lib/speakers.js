/**
 * 說話人配色
 *
 * 每個顏色有兩個色階：
 * - light：用在深色底上（黑底彩字）
 * - deep ：用在白底上當文字（白框彩字），或當底色配白字（彩框白字）
 * 以下每組在三種字幕樣式下的 WCAG 對比皆 ≥ 6:1。
 */

/** 沒有標記說話人的字幕行 */
export const NEUTRAL = { key: 'neutral', light: '#F5F0E8', deep: '#333333' };

/**
 * 調色盤。米白（ivory）與無說話人的預設色相同，可以手動指定給說話人，但：
 * - auto: false：自動配色不會分到它（否則看起來像沒標記說話人）
 * - speakerOnly：標籤顏色不提供（等同標籤的「預設」）
 */
export const PALETTE = [
  { key: 'gold', label: '金', light: '#E8CB74', deep: '#7A5F14' },
  { key: 'blue', label: '藍', light: '#9EC5F0', deep: '#2F5B8C' },
  { key: 'green', label: '綠', light: '#95D2A1', deep: '#33693F' },
  { key: 'red', label: '紅', light: '#F4A79F', deep: '#A1342B' },
  { key: 'violet', label: '紫', light: '#CDB8EE', deep: '#63458A' },
  { key: 'teal', label: '青', light: '#8ED8D0', deep: '#256660' },
  { key: 'orange', label: '橘', light: '#F5BA6E', deep: '#8A5210' },
  { key: 'ivory', label: '米白', light: NEUTRAL.light, deep: NEUTRAL.deep, auto: false, speakerOnly: true },
];

/** 色塊、名牌上的小圓點：米白的深色階是深灰，照原樣會畫成深色點，這裡改成米白在中間、深灰外圈 */
export function swatchVars(color) {
  return color?.key === 'ivory'
    ? { '--spk-light': color.deep, '--spk-deep': color.light }
    : speakerVars(color);
}

export const PALETTE_KEYS = PALETTE.map((p) => p.key);
const BY_KEY = Object.fromEntries(PALETTE.map((p) => [p.key, p]));
const HEX = /^#[0-9a-f]{6}$/i;

/** videos.json 的設定值：調色盤名稱（"gold"）或自訂 { "light": "#...", "deep": "#..." } */
export function toSpeakerColor(value) {
  if (typeof value === 'string') return BY_KEY[value] ?? null;
  if (value && HEX.test(value.light) && HEX.test(value.deep)) {
    return { key: null, light: value.light, deep: value.deep };
  }
  return null;
}

/**
 * 決定每位說話人的顏色：先套用 videos.json 指定的，
 * 其餘依出場順序從尚未使用的調色盤顏色依序分配。
 * @param {string[]} speakers
 * @param {Record<string, string | { light: string, deep: string }>} [config]
 * @returns {Map<string, { key: string | null, light: string, deep: string }>}
 */
export function resolveSpeakerColors(speakers, config) {
  const colors = new Map();
  const taken = new Set();
  for (const [name, value] of Object.entries(config ?? {})) {
    const color = toSpeakerColor(value);
    if (!color) continue;
    colors.set(name, color);
    if (color.key) taken.add(color.key);
  }
  const autoColors = PALETTE.filter((p) => p.auto !== false);
  const free = autoColors.filter((p) => !taken.has(p.key));
  const pool = free.length ? free : autoColors;
  let next = 0;
  for (const name of speakers) {
    if (!colors.has(name)) colors.set(name, pool[next++ % pool.length]);
  }
  return colors;
}

export function colorOf(colors, speaker) {
  return (speaker && colors.get(speaker)) || NEUTRAL;
}

/** 給元件 style 用的 CSS 變數 */
export function speakerVars(color) {
  return { '--spk-light': color.light, '--spk-deep': color.deep };
}
