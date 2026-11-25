/**
 * 發布頁 → 預覽分頁的草稿傳遞
 *
 * 發布頁把草稿放在自己的 window 上，預覽分頁（由發布頁 window.open 開啟）透過
 * window.opener 直接讀同一個物件，不經過複製或 localStorage，大型聊天室紀錄也沒問題。
 * 草稿變動時用 BroadcastChannel 通知預覽分頁重新讀取。
 * 只在同一個網站（同源）的分頁之間有效，資料不會離開這台電腦。
 */

const KEY = '__rcfnPreviewDraft';
const CHANNEL = 'rcfn-preview';
export const PREVIEW_WINDOW = 'rcfn-preview';

let channel = null;
function getChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(CHANNEL);
  return channel;
}

/** 發布頁：更新草稿並通知預覽分頁 */
export function shareDraft(draft) {
  window[KEY] = draft;
  getChannel()?.postMessage('changed');
}

/** 發布頁：離開時清掉草稿 */
export function clearDraft() {
  delete window[KEY];
  getChannel()?.postMessage('changed');
}

/** 發布頁：開預覽分頁（同名視窗，重複按只會切過去） */
export function openPreview() {
  const url = `${window.location.pathname}${window.location.search}#/preview`;
  const win = window.open(url, PREVIEW_WINDOW);
  win?.focus();
}

/**
 * 預覽分頁：讀草稿
 * @returns {{ status: 'ready', draft: object } | { status: 'missing' | 'closed' }}
 */
export function readDraft() {
  try {
    const opener = window.opener;
    if (!opener) return { status: 'missing' };
    if (opener.closed) return { status: 'closed' };
    const draft = opener[KEY];
    return draft ? { status: 'ready', draft } : { status: 'missing' };
  } catch {
    return { status: 'missing' };
  }
}

/** 預覽分頁：草稿變動時呼叫 callback；回傳取消訂閱 */
export function onDraftChange(callback) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const listener = new BroadcastChannel(CHANNEL);
  listener.onmessage = callback;
  return () => listener.close();
}
