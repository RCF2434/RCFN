import { parseLinks } from '../lib/richText.js';

/** 把文字裡的 [文字](連結) 顯示成超連結（開新分頁），其餘照原樣輸出 */
export default function LinkedText({ text }) {
  return parseLinks(text).map((part, i) =>
    part.type === 'link' ? (
      <a key={i} href={part.href} className="inline-link" target="_blank" rel="noopener noreferrer" title={part.href}>
        {part.text}
      </a>
    ) : (
      part.text
    ),
  );
}
