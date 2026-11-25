/**
 * 註釋草稿自動儲存在瀏覽器（localStorage），每支影片一份：
 *   ytsubs:notes-draft:<youtubeId> → { savedAt, notes: [{ time: 輸入的文字, text }] }
 * 時間存成輸入框裡的文字，打到一半的也能原樣還原。
 * 發布成功後清掉；超過 30 天沒動的草稿會在下次儲存時順便刪除。
 */
const PREFIX = 'ytsubs:notes-draft:';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const filledNotes = (rows) =>
  rows.filter((row) => row.time.trim() || row.text.trim()).map((row) => ({ time: row.time.trim(), text: row.text }));

export function loadNotesDraft(youtubeId) {
  try {
    const data = JSON.parse(localStorage.getItem(PREFIX + youtubeId) ?? 'null');
    if (!data || !Array.isArray(data.notes) || !data.notes.length) return null;
    const notes = data.notes
      .filter((n) => n && typeof n.time === 'string' && typeof n.text === 'string')
      .map((n) => ({ time: n.time, text: n.text }));
    return notes.length ? { savedAt: data.savedAt ?? null, notes } : null;
  } catch {
    return null;
  }
}

export function removeNotesDraft(youtubeId) {
  try {
    localStorage.removeItem(PREFIX + youtubeId);
  } catch {
    /* 忽略 */
  }
}

function pruneOldDrafts(now) {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const savedAt = JSON.parse(localStorage.getItem(key) ?? 'null')?.savedAt;
      if (!savedAt || now - Date.parse(savedAt) > MAX_AGE_MS) localStorage.removeItem(key);
    }
  } catch {
    /* 忽略 */
  }
}

/** 儲存草稿；全部空白就刪掉。回傳儲存時間，存不了（無痕模式、空間不足）會丟出錯誤 */
export function saveNotesDraft(youtubeId, rows) {
  const notes = filledNotes(rows);
  if (!notes.length) {
    removeNotesDraft(youtubeId);
    return null;
  }
  const now = Date.now();
  const savedAt = new Date(now).toISOString();
  localStorage.setItem(PREFIX + youtubeId, JSON.stringify({ savedAt, notes }));
  pruneOldDrafts(now);
  return savedAt;
}

/** 草稿和目前的內容是否相同 */
export function sameAsDraft(draftNotes, rows) {
  return JSON.stringify(draftNotes) === JSON.stringify(filledNotes(rows));
}

/** 顯示用：今天的只顯示時間，其他加上日期 */
export function formatSavedAt(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const today = new Date();
  return date.toDateString() === today.toDateString() ? time : `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}
