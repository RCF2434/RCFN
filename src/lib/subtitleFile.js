/**
 * 讀取使用者選的字幕檔。台灣常見的舊字幕檔是 Big5，
 * 自動判斷：有 BOM 照 BOM；否則先試 UTF-8，不是合法 UTF-8 就當 Big5。
 * 發布時一律存成 UTF-8。
 */
export const ENCODINGS = [
  { key: 'auto', label: '自動判斷' },
  { key: 'utf-8', label: 'UTF-8' },
  { key: 'big5', label: 'Big5（繁體）' },
  { key: 'gb18030', label: 'GB18030（簡體）' },
  { key: 'utf-16le', label: 'UTF-16' },
];

export const MAX_SUBTITLE_BYTES = 2 * 1024 * 1024;

const ENCODING_LABEL = Object.fromEntries(ENCODINGS.map((e) => [e.key, e.label]));
ENCODING_LABEL['utf-16be'] = 'UTF-16';

export function encodingLabel(key) {
  return ENCODING_LABEL[key] ?? key;
}

function sniff(bytes) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return 'utf-8';
  } catch {
    return 'big5';
  }
}

/** @returns {{ text: string, encoding: string, garbled: boolean }} */
export function decodeSubtitle(buffer, encoding = 'auto') {
  const bytes = new Uint8Array(buffer);
  const used = encoding === 'auto' ? sniff(bytes) : encoding;
  const text = new TextDecoder(used).decode(bytes).replace(/^﻿/, '');
  return { text, encoding: used, garbled: text.includes('�') };
}

/** 存進 repo 前統一換行 */
export function normalizeSubtitle(text) {
  const out = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  return out.endsWith('\n') ? out : `${out}\n`;
}
