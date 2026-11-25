import { TAGS_PATH, VIDEOS_PATH } from './github.js';

export const ID_RE = /^[\w-]+$/;

/**
 * 新增或更新 videos.json 的一筆資料，回傳新陣列。
 * 新影片放最前面（列表最新的在上）；更新時保留原本有、表單沒有的欄位（例如 thumbnail）。
 */
export function upsertVideo(videos, entry, mode) {
  const index = videos.findIndex((video) => video.id === entry.id);
  if (mode === 'create') {
    if (index !== -1) throw new Error(`網址代稱「${entry.id}」已經被另一支影片使用，請換一個。`);
    return [entry, ...videos];
  }
  if (index === -1) throw new Error(`repo 裡已經沒有「${entry.id}」這支影片，可能剛被刪除，請重新讀取。`);
  const next = [...videos];
  next[index] = { ...videos[index], ...entry };
  return next;
}

export function serializeVideos(videos) {
  return `${JSON.stringify(videos, null, 2)}\n`;
}

/**
 * 把字幕檔與 videos.json 寫進同一個 commit。
 * 每次都從分支最新的 videos.json 重新套用，分支在途中被更新時自動重試。
 */
export async function publishVideo(gh, { branch, entry, subtitleText, mode, extraFiles = [] }) {
  const verb = mode === 'create' ? '新增' : '更新';
  for (let attempt = 1; ; attempt += 1) {
    const head = await gh.getHead(branch);
    const videos = upsertVideo(await gh.readVideos(head.commitSha), entry, mode);
    try {
      const commitSha = await gh.commitFiles({
        branch,
        head,
        message: `${verb}影片：${entry.title}\n\n由RCFN · 非官方字幕的發布頁送出。`,
        files: [
          { path: `public/${entry.subtitle}`, content: subtitleText },
          { path: VIDEOS_PATH, content: serializeVideos(videos) },
          ...extraFiles,
        ],
      });
      return { commitSha, videos };
    } catch (err) {
      if (!err.stale || attempt >= 3) throw err;
    }
  }
}

/** 儲存標籤顏色：content 是整份 tags.json 的文字（serializeTagColors 的結果），分支在途中被更新時自動重試 */
export async function saveTagColors(gh, { branch, content }) {
  for (let attempt = 1; ; attempt += 1) {
    const head = await gh.getHead(branch);
    try {
      const commitSha = await gh.commitFiles({
        branch,
        head,
        message: '更新標籤顏色\n\n由RCFN · 非官方字幕的標籤顏色頁送出。',
        files: [{ path: TAGS_PATH, content }],
      });
      return { commitSha };
    } catch (err) {
      if (!err.stale || attempt >= 3) throw err;
    }
  }
}

/** 網站公開網址：在 GitHub Pages（或自訂網域）上就用目前網址，本機開發時推算 github.io 網址 */
export function publicSiteUrl(owner, repo) {
  const { hostname, origin, pathname } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
  if (!local) return origin + pathname;
  const host = `${owner.toLowerCase()}.github.io`;
  return repo.toLowerCase() === host ? `https://${host}/` : `https://${host}/${repo}/`;
}
