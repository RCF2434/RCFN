/**
 * 影片分成兩個列表，每支影片只屬於其中一個（videos.json 的 list 欄位）。
 * 搜尋與標籤篩選只在同一個列表內進行。
 * 沒有 list 欄位的舊資料歸在第一個列表（にじさんじ），網址維持在首頁。
 */
export const LISTS = [
  { key: 'nijisanji', label: 'にじさんじ', path: '/' },
  { key: 'nijisanji-en', label: 'NIJISANJI EN', path: '/en' },
];

export const LIST_KEYS = LISTS.map((l) => l.key);
export const DEFAULT_LIST = LISTS[0].key;

const BY_KEY = Object.fromEntries(LISTS.map((l) => [l.key, l]));

export function isListKey(value) {
  return Object.hasOwn(BY_KEY, value ?? '');
}

/** 影片所屬的列表；沒填或填錯都歸在預設列表 */
export function videoListKey(video) {
  return isListKey(video?.list) ? video.list : DEFAULT_LIST;
}

export function getList(key) {
  return BY_KEY[key] ?? BY_KEY[DEFAULT_LIST];
}

export function listPath(key) {
  return getList(key).path;
}

/** 列表頁網址（可帶標籤篩選） */
export function listLink(key, tag) {
  const pathname = listPath(key);
  return tag ? { pathname, search: `?tag=${encodeURIComponent(tag)}` } : { pathname };
}
