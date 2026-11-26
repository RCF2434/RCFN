/**
 * 多語字幕（中文／英文／日文）。
 *
 * videos.json：
 *   "subtitles": { "zh": "subtitles/<id>.zh.srt", "en": "…", "ja": "…" }   // 至少一種
 * 舊格式的單一 "subtitle" 視為中文，檔案不用搬動。
 *
 * 播放時把勾選的語言合併成一條依開始時間排序的時間軸（每句帶 lang），
 * 只跑一個同步迴圈；字幕層再依語言分組顯示。
 * 純 JS、無 DOM 依賴，瀏覽器與 Node 檢查腳本共用。
 */

/** 顯示順序也是字幕由上到下的順序 */
export const SUB_LANGS = [
  { key: 'zh', label: '中文', lang: 'zh-Hant' },
  { key: 'en', label: 'English', lang: 'en' },
  { key: 'ja', label: '日本語', lang: 'ja' },
];
export const SUB_LANG_KEYS = SUB_LANGS.map((l) => l.key);
export const LANG_BY_KEY = Object.fromEntries(SUB_LANGS.map((l) => [l.key, l]));

export const isSubLang = (key) => SUB_LANG_KEYS.includes(key);

/** 依固定順序（中 → EN → 日）排列 */
export const sortLangs = (keys) => SUB_LANG_KEYS.filter((key) => keys.includes(key));

/** 影片的字幕檔：{ zh?, en?, ja? } → 路徑；相容舊的單一 subtitle（視為中文） */
export function videoSubtitles(video) {
  const out = {};
  const map = video?.subtitles;
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    for (const key of SUB_LANG_KEYS) {
      if (typeof map[key] === 'string' && map[key].trim()) out[key] = map[key];
    }
  }
  if (!Object.keys(out).length && typeof video?.subtitle === 'string' && video.subtitle.trim()) out.zh = video.subtitle;
  return out;
}

/** 影片有哪些語言的字幕（固定順序） */
export function subtitleLangs(video) {
  return sortLangs(Object.keys(videoSubtitles(video)));
}

/** 新字幕檔的路徑 */
export function subtitlePath(id, lang) {
  return `subtitles/${id}.${lang}.srt`;
}

/**
 * 進影片頁時要顯示哪些語言：沿用上次勾選的（只取這支影片有的），
 * 一個都對不上就顯示第一種語言。
 */
export function initialLangs(stored, available) {
  if (!available.length) return [];
  const kept = sortLangs((Array.isArray(stored) ? stored : []).filter((key) => available.includes(key)));
  return kept.length ? kept : [available[0]];
}

/**
 * 把勾選語言的字幕合併成一條依開始時間排序的時間軸。
 * tracks：{ zh: { cues }, … }；回傳的每句多了 lang，id 重新編號（同步迴圈用 id 判斷有沒有變）。
 */
export function mergeTracks(tracks, langs) {
  const out = [];
  for (const lang of langs) {
    for (const cue of tracks?.[lang]?.cues ?? []) out.push({ ...cue, lang });
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end || SUB_LANG_KEYS.indexOf(a.lang) - SUB_LANG_KEYS.indexOf(b.lang));
  out.forEach((cue, i) => {
    cue.id = i;
  });
  return out;
}

/** 所有語言的說話人（依語言順序、首次出現順序，不重複），配色用 */
export function unionSpeakers(tracks) {
  const seen = new Set();
  const out = [];
  for (const key of SUB_LANG_KEYS) {
    for (const name of tracks?.[key]?.speakers ?? []) {
      if (!seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    }
  }
  return out;
}

/** 註釋對應字幕用的基準語言：依固定順序第一個有字幕的 */
export function referenceCues(tracks) {
  for (const key of SUB_LANG_KEYS) {
    if (tracks?.[key]?.cues?.length) return tracks[key].cues;
  }
  return [];
}

/**
 * 同時顯示多種語言時整體縮小，避免字幕佔掉太多畫面；
 * 第二、三種語言（.sub-group:not(.is-primary)）在 CSS 裡再小一級。
 */
export function multiLangScale(count) {
  if (count >= 3) return 0.82;
  if (count === 2) return 0.9;
  return 1;
}
