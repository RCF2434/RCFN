/**
 * 影片註釋：videos.json 的 notes: [{ time: 秒數, text: "註釋內容", url?: "https://…" }]
 * - 依時間排序後編號 1、2、3…
 * - 字幕播到該時間時，那一句字幕後面標示（*編號）
 * - 影片頁下方列出「1. 註釋內容」，點編號跳到該時間；有 url 時在文字最後加上外連連結
 */

/**
 * 整理註釋的連結：空白回傳 ''；沒寫協定時補上 https://；只接受 http／https。
 * 不合法回傳 null。
 */
export function normalizeNoteUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.href;
  } catch {
    return null;
  }
}

/** 連結顯示用的名稱：網域（去掉 www.） */
export function noteUrlLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** 解析時間輸入：83、1:23、1:23.5、1:02:03、1:23,5；不合法回傳 null */
export function parseTimeInput(input) {
  const value = String(input ?? '').trim().replace(',', '.');
  if (!value) return null;
  const m = value.match(/^(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const parts = [m[1], m[2], m[3]].filter((p) => p !== undefined).map(Number);
  const seconds = parts.reduce((total, part) => total * 60 + part, 0);
  // 有分鐘時，秒數不能超過 59
  if (parts.length > 1 && parts.at(-1) >= 60) return null;
  if (parts.length === 3 && parts[1] >= 60) return null;
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) / 1000 : null;
}

/** 顯示用時間：1:23、1:02:03；有小數就留一位（1:23.5） */
export function formatTimestamp(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const whole = Math.floor(seconds);
  const frac = Math.round((seconds - whole) * 10);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  const base = h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  return frac ? `${base}.${frac}` : base;
}

/** 整理成排序好的註釋，加上編號：[{ number, time, text, url }]（url 不合法就不顯示） */
export function numberNotes(notes) {
  return (Array.isArray(notes) ? notes : [])
    .filter((n) => n && Number.isFinite(n.time) && n.time >= 0 && typeof n.text === 'string' && n.text.trim())
    .map((n, order) => ({ time: n.time, text: n.text.trim(), url: normalizeNoteUrl(n.url) || null, order }))
    .sort((a, b) => a.time - b.time || a.order - b.order)
    .map(({ time, text, url }, i) => ({ number: i + 1, time, text, url }));
}

/** 找出包含這個時間的第一句字幕（cues 依開始時間排序） */
export function cueAt(cues, time) {
  for (const cue of cues) {
    if (cue.start > time) break;
    if (time < cue.end) return cue;
  }
  return null;
}

/** 點註釋時要跳到的時間：那句字幕的開頭，讓觀眾看到完整的一句；沒有字幕就跳到註釋時間 */
export function jumpTime(cues, time) {
  return cueAt(cues, time)?.start ?? time;
}

/** 每句字幕要標示的註釋編號：Map<cue.id, number[]> */
export function noteMarkers(cues, numbered) {
  const markers = new Map();
  for (const note of numbered) {
    const cue = cueAt(cues, note.time);
    if (cue) markers.set(cue.id, [...(markers.get(cue.id) ?? []), note.number]);
  }
  return markers;
}

/*
 * 註釋草稿檔（匯出／匯入）：
 *   { "type": "ytsubs-notes", "version": 1, "video": { "id", "youtubeId", "title" }, "exportedAt",
 *     "notes": [{ "time": 83.5, "text": "…", "url": "https://…" }, { "time": "1:2", "text": "打到一半" }] }
 * 時間合法就存秒數；還沒打完或格式錯的，原樣存成文字，匯入後可以接著改。
 * 匯入也接受只有 notes 陣列的檔案，或 videos.json 裡的 notes 格式。
 */
export const NOTES_FILE_TYPE = 'ytsubs-notes';
export const MAX_NOTES_FILE_BYTES = 1024 * 1024;

export function serializeNotesDraft(rows, video = {}) {
  const notes = rows
    .filter((row) => row.time.trim() || row.text.trim() || row.url?.trim())
    .map((row) => {
      const seconds = parseTimeInput(row.time);
      const note = { time: seconds ?? row.time.trim(), text: row.text };
      if (row.url?.trim()) note.url = row.url.trim();
      return note;
    });
  const data = {
    type: NOTES_FILE_TYPE,
    version: 1,
    video: { id: video.id || null, youtubeId: video.youtubeId || null, title: video.title || null },
    exportedAt: new Date().toISOString(),
    notes,
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** 解析匯入的檔案：回傳 { items: [{ time: 顯示用文字, text, url }], video }；格式不對就丟出錯誤 */
export function parseNotesFile(text) {
  let data;
  try {
    data = JSON.parse(String(text).replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('這不是 JSON 檔，請選之前匯出的註釋檔。');
  }
  const list = Array.isArray(data) ? data : data?.notes;
  if (!Array.isArray(list)) throw new Error('檔案裡找不到註釋（notes）。');
  const items = list
    .filter((n) => n && typeof n === 'object')
    .map((n) => ({
      time: typeof n.time === 'number' && Number.isFinite(n.time) ? formatTimestamp(n.time) : String(n.time ?? '').trim(),
      text: typeof n.text === 'string' ? n.text : '',
      url: typeof n.url === 'string' ? n.url : '',
    }))
    .filter((n) => n.time || n.text.trim() || n.url.trim());
  if (!items.length) throw new Error('檔案裡沒有任何註釋。');
  return { items, video: Array.isArray(data) ? null : (data.video ?? null) };
}
