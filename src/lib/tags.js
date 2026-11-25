export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 20;
/** 半形逗號、全形逗號、頓號都可以分隔標籤 */
export const TAG_SEPARATORS = /[,，、]/;

export function normalizeTag(raw) {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^#+\s*/, '')
    .slice(0, MAX_TAG_LENGTH)
    .trim();
}

const key = (tag) => tag.toLocaleLowerCase();

export function hasTag(tags, tag) {
  const k = key(tag);
  return (tags ?? []).some((t) => key(t) === k);
}

/** 把文字加進標籤清單：拆分、整理、去重複（不分大小寫）、不超過上限 */
export function addTags(tags, raw) {
  const next = [...tags];
  for (const part of String(raw).split(TAG_SEPARATORS)) {
    const tag = normalizeTag(part);
    if (tag && !hasTag(next, tag) && next.length < MAX_TAGS) next.push(tag);
  }
  return next;
}

/** 所有影片用過的標籤，依使用次數由多到少 */
export function collectTags(videos) {
  const counts = new Map();
  for (const video of videos ?? []) {
    for (const tag of video.tags ?? []) {
      const k = key(tag);
      const entry = counts.get(k) ?? { tag, count: 0 };
      entry.count += 1;
      counts.set(k, entry);
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-Hant'))
    .map((entry) => entry.tag);
}
