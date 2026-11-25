/** WCAG 2 對比計算，給自訂顏色時即時提示可讀性 */
export const HEX_RE = /^#[0-9a-f]{6}$/i;

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  if (!HEX_RE.test(a) || !HEX_RE.test(b)) return null;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** 標籤底色：淺色主題米色、深色主題深灰（與 tokens.css 的 --surface 相同） */
export const TAG_BACKGROUNDS = { light: '#f5f0e8', dark: '#2a2824' };
export const MIN_CONTRAST = 4.5;

/**
 * 說話人顏色要對比的底色：
 * - light（淺色階）用在「黑底彩字」的半透明黑底上
 * - deep（深色階）用在「白框彩字」的白色描邊上，以及「彩框白字」襯在白字後面
 */
export const SUBTITLE_BACKGROUNDS = { dark: '#141414', white: '#FFFFFF' };
