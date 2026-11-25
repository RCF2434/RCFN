/**
 * ASS / SSA 字幕轉成本站的 SRT 格式
 *
 * - 只取 [Events] 裡的 Dialogue（Comment 略過），欄位順序依該段的 Format 行
 * - Name 欄位（舊工具叫 Actor）視為說話人，轉成行首的 <v 名字>；沒有就不標
 * - 開始與結束時間完全相同的幾行合成同一句字幕（例如雙語字幕的日文、中文）
 * - 特效標籤 {\...} 一律移除；\N、\n 換行，\h 換成空白；繪圖（\p1）整行略過
 * - 純 JS、無 DOM 依賴
 */

const DEFAULT_FORMAT = ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
const TIME_RE = /^\s*(\d+):(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?\s*$/;

/** 看副檔名或檔頭判斷是不是 ASS/SSA */
export function isASS(name, text) {
  return /\.(ass|ssa)$/i.test(name ?? '') || /^\s*\[Script Info\]/i.test(text ?? '');
}

function parseTime(value) {
  const m = String(value).match(TIME_RE);
  if (!m) return null;
  // ASS 是百分之一秒（.91 = 910ms）；小數位數不同時照位數換算
  const frac = m[4] ? Number(m[4].padEnd(3, '0')) / 1000 : 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + frac;
}

function srtTime(seconds) {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

/** ASS 文字 → 純文字行（不含說話人） */
function cleanText(raw) {
  if (/\{[^}]*\\p[1-9]/.test(raw)) return null; // 向量繪圖，不是字
  return raw
    .replace(/\{[^}]*\}/g, '')
    .replace(/\\[Nn]/g, '\n')
    .replace(/\\h/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * @returns {{ text: string, cues: number, speakers: string[], warnings: string[] }}
 */
export function assToSRT(input) {
  const lines = String(input).replace(/^﻿/, '').split(/\r\n?|\n/);
  const warnings = [];
  const events = [];
  let section = '';
  let format = DEFAULT_FORMAT;

  lines.forEach((line, index) => {
    const header = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (header) {
      section = header[1].trim().toLowerCase();
      return;
    }
    if (section !== 'events') return;
    const field = line.match(/^\s*(\w+)\s*:\s?(.*)$/);
    if (!field) return;
    const kind = field[1].toLowerCase();
    if (kind === 'format') {
      format = field[2].split(',').map((f) => f.trim().toLowerCase());
      return;
    }
    if (kind !== 'dialogue') return;

    // Text 一定是最後一欄，裡面可能有逗號
    const parts = field[2].split(',');
    const values = [...parts.slice(0, format.length - 1), parts.slice(format.length - 1).join(',')];
    const get = (key) => values[format.indexOf(key)] ?? '';
    const label = `第 ${index + 1} 行`;

    const start = parseTime(get('start'));
    const end = parseTime(get('end'));
    if (start === null || end === null) {
      warnings.push(`${label}：時間格式無法辨識，已略過`);
      return;
    }
    if (!(end > start)) {
      warnings.push(`${label}：結束時間不晚於開始時間，已略過`);
      return;
    }
    const text = cleanText(get('text'));
    if (!text?.length) return; // 空行或繪圖
    const speaker = (format.includes('name') ? get('name') : get('actor')).replace(/[<>]/g, '').trim() || null;
    events.push({ start, end, speaker, text, order: events.length });
  });

  // 同一時間的幾行合成一句；沒有說話人的行不併到有說話人的句子後面，以免被當成同一人
  const groups = [];
  const byTime = new Map();
  for (const ev of events) {
    const key = `${ev.start}|${ev.end}`;
    const group = byTime.get(key);
    if (group && (ev.speaker || !group.events.some((e) => e.speaker))) {
      group.events.push(ev);
    } else {
      const created = { start: ev.start, end: ev.end, order: ev.order, events: [ev] };
      byTime.set(key, created);
      groups.push(created);
    }
  }
  groups.sort((a, b) => a.start - b.start || a.end - b.end || a.order - b.order);

  const speakers = [];
  const blocks = groups.map((group, i) => {
    const body = group.events.flatMap((ev) => {
      if (ev.speaker && !speakers.includes(ev.speaker)) speakers.push(ev.speaker);
      const [first, ...rest] = ev.text;
      return [ev.speaker ? `<v ${ev.speaker}>${first}` : first, ...rest];
    });
    return `${i + 1}\n${srtTime(group.start)} --> ${srtTime(group.end)}\n${body.join('\n')}`;
  });

  if (!blocks.length) warnings.push('ASS 檔裡找不到任何 Dialogue 字幕');
  return { text: blocks.length ? `${blocks.join('\n\n')}\n` : '', cues: blocks.length, speakers, warnings };
}
