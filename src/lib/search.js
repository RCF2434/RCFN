/**
 * 列表頁的模糊搜尋（Fuse.js）。搜尋範圍：標題、標籤、說話人、說明。
 *
 * 比對前，影片資料與搜尋字都先經過 normalizeForSearch：
 * - NFKC：全形英數 → 半形、半形片假名 → 全形（ＡＢＣ = ABC、ｱﾆﾒ = アニメ）
 * - 不分大小寫
 * - 片假名 → 平假名（アニメ = あにめ）
 * 搜尋字用空白分開時，每個詞都要符合（不限順序）。
 */
import Fuse from 'fuse.js';

const KATAKANA = /[ァ-ヶ]/g; // ァ–ヶ，減 0x60 就是對應的平假名 ぁ–ゖ

export function normalizeForSearch(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(KATAKANA, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

const KEYS = [
  { name: 'title', weight: 3 },
  { name: 'tags', weight: 2 },
  { name: 'speakers', weight: 1.5 },
  { name: 'description', weight: 1 },
];

const OPTIONS = {
  keys: KEYS,
  includeScore: true,
  // 0 = 完全一致才算，1 = 什麼都算；0.34 大約容許長一點的詞錯一個字
  threshold: 0.34,
  // 說明文字很長，符合的地方在哪裡都算
  ignoreLocation: true,
};

/** 建立搜尋函式：回傳依相關程度排序的影片；搜尋字是空的回傳 null */
export function createVideoSearch(videos) {
  const docs = videos.map((video, index) => ({
    index,
    title: normalizeForSearch(video.title),
    description: normalizeForSearch(video.description),
    tags: (video.tags ?? []).map(normalizeForSearch),
    speakers: Object.keys(video.speakers ?? {}).map(normalizeForSearch),
  }));
  const fuse = new Fuse(docs, OPTIONS);

  return function search(query) {
    const terms = normalizeForSearch(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return null;

    // 每個詞各搜一次，取交集；分數相加，越小越相關
    let scores = null;
    for (const term of terms) {
      const hits = new Map(fuse.search(term).map((r) => [r.item.index, r.score]));
      scores = scores
        ? new Map([...scores].filter(([i]) => hits.has(i)).map(([i, s]) => [i, s + hits.get(i)]))
        : hits;
      if (!scores.size) break;
    }
    return [...scores].sort((a, b) => a[1] - b[1]).map(([i]) => videos[i]);
  };
}
