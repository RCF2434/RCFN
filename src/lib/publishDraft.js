/**
 * 發布頁草稿：存在瀏覽器的 IndexedDB（只在這台電腦、這個瀏覽器）。
 * 字幕檔（最多 2 MB）和聊天室紀錄（最多 50 MB）放不進 localStorage，所以用 IndexedDB，
 * 並拆成三筆，大檔案只有換檔時才重寫：
 *   form     → { savedAt, target, form, idTouched, tags, channels, overrides, notes, encoding, page }
 *   subtitle → { name, source: 'file' | 'repo', buffer? , text? }
 *   chat     → 聊天室欄位狀態（不含解析後的 data，還原時從 json 重建）
 * 發布成功後清掉；超過 30 天的草稿不還原。
 */
const DB_NAME = 'rcfn-publish-draft';
const STORE = 'parts';
export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let dbPromise = null;
function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('這個瀏覽器不支援 IndexedDB'));
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => {
      dbPromise = null; // 下次再試
    });
  }
  return dbPromise;
}

async function run(mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** @returns {Promise<{ form: object | undefined, subtitle: object | undefined, chat: object | undefined }>} */
export async function loadDraftParts() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const out = {};
    for (const key of ['form', 'subtitle', 'chat']) {
      store.get(key).onsuccess = (event) => {
        out[key] = event.target.result;
      };
    }
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}

/** value 為 undefined 時刪除該筆 */
export function saveDraftPart(key, value) {
  return run('readwrite', (store) => (value === undefined ? store.delete(key) : store.put(value, key)));
}

export function clearPublishDraft() {
  return run('readwrite', (store) => store.clear());
}

/** 字幕欄位狀態 → 要存的資料（讀取中或錯誤的不存） */
export function subtitleForDraft(sub) {
  if (!sub || sub.loading || sub.error) return undefined;
  if (sub.buffer) return { name: sub.name, source: sub.source, buffer: sub.buffer };
  if (typeof sub.text === 'string') return { name: sub.name, source: sub.source, text: sub.text };
  return undefined;
}

/** 聊天室欄位狀態 → 要存的資料（data 是 json 解析出來的，不重複存） */
export function chatForDraft(chat) {
  if (!chat || chat.mode === 'none') return undefined;
  const { data, ...rest } = chat;
  return rest;
}

/** 存的聊天室資料 → 欄位狀態 */
export function chatFromDraft(saved) {
  if (!saved) return null;
  if (saved.mode !== 'new') return saved;
  try {
    return { ...saved, data: JSON.parse(saved.json) };
  } catch {
    return null;
  }
}
