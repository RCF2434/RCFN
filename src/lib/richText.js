/**
 * 說明文字裡的超連結：沿用 Markdown 的 [文字](連結) 寫法。
 * - 連結只接受 http／https（沒寫協定會補上 https://）；不合法的就原樣當成文字
 * - 不支援其他 Markdown 語法，也不會把裸網址自動變成連結
 */
import { normalizeNoteUrl } from './notes.js';

const LINK_RE = /\[([^\]\n]+)\]\(([^()\s]+)\)/g;

/**
 * 拆成文字與連結片段：[{ type: 'text', text } | { type: 'link', text, href }]
 * @param {string} text
 */
export function parseLinks(text) {
  const source = String(text ?? '');
  const parts = [];
  let last = 0;
  for (const m of source.matchAll(LINK_RE)) {
    const href = normalizeNoteUrl(m[2]);
    if (!href) continue; // 不合法的網址：整段留在文字裡
    if (m.index > last) parts.push({ type: 'text', text: source.slice(last, m.index) });
    parts.push({ type: 'link', text: m[1], href });
    last = m.index + m[0].length;
  }
  if (last < source.length) parts.push({ type: 'text', text: source.slice(last) });
  return parts;
}

/** 純文字版：[文字](連結) 只留下「文字」（卡片摘要、搜尋用） */
export function stripLinks(text) {
  return parseLinks(text)
    .map((part) => part.text)
    .join('');
}
