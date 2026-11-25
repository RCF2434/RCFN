/**
 * SRT 解析器（含說話人擴充）
 *
 * 說話人語法沿用 WebVTT 的 voice tag：在字幕行開頭寫 <v 名字>
 *
 *   3
 *   00:00:08,300 --> 00:00:11,500
 *   <v 小安>第一行屬於小安，
 *   沒有標記的下一行沿用小安。
 *   <v 阿蓓>同一句字幕裡可以換人。
 *
 * - 標記只在「行首」有效；同一句字幕內，沒有標記的行沿用上一行的說話人
 * - 每句字幕的第一行若沒有標記，視為無說話人（以中性色顯示）
 * - 接受 WebVTT 的 class 寫法 <v.loud 名字> 與結尾的 </v>
 * - 純 JS、無 DOM 依賴，瀏覽器與 Node 檢查腳本共用
 */

const TIME = String.raw`(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})`;
const TIMING_RE = new RegExp(String.raw`^\s*${TIME}\s*-->\s*${TIME}`);
const VOICE_RE = /^\s*<v(?:\.[^\s>]*)?\s+([^>]+?)\s*>/i;

function toSeconds(h, m, s, ms) {
  return Number(h || 0) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
}

/**
 * @returns {{
 *   cues: { id: number, start: number, end: number, lines: { speaker: string | null, text: string }[] }[],
 *   speakers: string[],   // 依首次出現順序
 *   warnings: string[],
 * }}
 */
export function parseSRT(input) {
  const source = String(input).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const blocks = source.split(/\n[ \t]*\n/);
  const cues = [];
  const speakers = [];
  const seen = new Set();
  const warnings = [];

  blocks.forEach((block, blockIndex) => {
    const lines = block.split('\n');
    while (lines.length && !lines[0].trim()) lines.shift();
    if (!lines.length) return;

    const label = `第 ${blockIndex + 1} 段${/^\d+$/.test(lines[0].trim()) ? `（編號 ${lines[0].trim()}）` : ''}`;
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1 || timingIndex > 1) {
      warnings.push(`${label}：找不到時間軸，已略過`);
      return;
    }
    const m = lines[timingIndex].match(TIMING_RE);
    if (!m) {
      warnings.push(`${label}：時間格式無法辨識「${lines[timingIndex].trim()}」`);
      return;
    }
    const start = toSeconds(m[1], m[2], m[3], m[4]);
    const end = toSeconds(m[5], m[6], m[7], m[8]);
    if (!(end > start)) {
      warnings.push(`${label}：結束時間不晚於開始時間，已略過`);
      return;
    }

    let speaker = null;
    const out = [];
    for (const raw of lines.slice(timingIndex + 1)) {
      let line = raw;
      const voice = line.match(VOICE_RE);
      if (voice) {
        speaker = voice[1].trim();
        line = line.slice(voice[0].length);
      }
      line = line.replace(/<\/v\s*>/gi, '').trim();
      if (!line) continue; // 標記獨占一行時，只切換說話人
      if (speaker && !seen.has(speaker)) {
        seen.add(speaker);
        speakers.push(speaker);
      }
      out.push({ speaker, text: line });
    }
    if (!out.length) {
      warnings.push(`${label}：沒有字幕文字，已略過`);
      return;
    }
    cues.push({ id: 0, start, end, lines: out });
  });

  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  cues.forEach((cue, i) => {
    cue.id = i;
  });
  return { cues, speakers, warnings };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

const INLINE_TAGS = new Set(['i', 'b', 'u']);

/**
 * 把一行字幕拆成節點樹，只保留 SRT 常見的 <i> <b> <u>，其餘標籤（如 <font>）直接移除。
 * 回傳 (string | { tag, children })[]，交給元件渲染，不使用 innerHTML。
 */
export function parseInline(text) {
  const root = { tag: null, children: [] };
  const stack = [root];
  const re = /<(\/?)([a-z]+)\b[^>]*>/gi;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) stack.at(-1).children.push(decodeEntities(text.slice(last, m.index)));
    last = re.lastIndex;
    const tag = m[2].toLowerCase();
    if (!INLINE_TAGS.has(tag)) continue;
    if (m[1]) {
      const open = stack.findLastIndex((node) => node.tag === tag);
      if (open > 0) stack.length = open;
    } else {
      const node = { tag, children: [] };
      stack.at(-1).children.push(node);
      stack.push(node);
    }
  }
  if (last < text.length) stack.at(-1).children.push(decodeEntities(text.slice(last)));
  return root.children;
}

export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
