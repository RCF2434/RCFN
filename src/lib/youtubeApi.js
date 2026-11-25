/**
 * YouTube Data API v3：發布時查頻道的名稱與頭貼，結果存進 videos.json，觀眾瀏覽時不會呼叫 API。
 * 金鑰只存在這個瀏覽器（發布頁只在本機開發時出現，不會隨網站上線）。
 */
const API = 'https://www.googleapis.com/youtube/v3/channels';
const KEY_STORAGE = 'ytsubs:youtube-api-key';

export function loadApiKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function saveApiKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* 無痕模式時只在這次有效 */
  }
}

/**
 * 解析頻道連結，回傳查詢方式：{ handle } / { id } / { username }，或 { error }。
 * 支援：https://www.youtube.com/@帳號、/channel/UC…、/user/名稱、直接打 @帳號 或 UC 開頭的頻道 ID。
 */
export function parseChannelInput(input) {
  const value = String(input ?? '').trim();
  if (!value) return null;
  if (/^@[\w.\-·]+$/u.test(value)) return { handle: value };
  if (/^UC[\w-]{22}$/.test(value)) return { id: value };
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return { error: '看不懂這個連結' };
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  if (host !== 'youtube.com') return { error: '請貼 YouTube 頻道的連結' };
  const [first, second] = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (first?.startsWith('@')) return { handle: first };
  if (first === 'channel' && /^UC[\w-]{22}$/.test(second ?? '')) return { id: second };
  if (first === 'user' && second) return { username: second };
  if (first === 'c') return { error: '舊式的 /c/ 網址查不到，請改貼頻道的 @帳號 網址' };
  if (first === 'watch' || url.searchParams.has('v')) return { error: '這是影片連結，請貼頻道的連結' };
  return { error: '請貼頻道首頁的連結，例如 https://www.youtube.com/@帳號' };
}

function describeError(status, body) {
  const text = JSON.stringify(body ?? {});
  if (/API_KEY_INVALID|keyInvalid|API key not valid/i.test(text)) return 'API 金鑰無效，請確認有沒有貼錯。';
  if (/quotaExceeded|RATE_LIMIT/i.test(text)) return '今天的 API 額度用完了，明天再試。';
  if (/REFERRER|ipRefererBlocked|referer/i.test(text)) {
    return '金鑰限制了網站來源，請在 Google Cloud 把 http://localhost:5173/* 加進允許的網站。';
  }
  if (/accessNotConfigured|SERVICE_DISABLED|has not been used|disabled/i.test(text)) {
    return '這組金鑰的專案還沒啟用 YouTube Data API v3。';
  }
  return `YouTube API 回應錯誤（HTTP ${status}）`;
}

/** 查頻道；回傳 { id, name, handle, url, avatar } */
export async function fetchChannel(key, query, signal) {
  const params = new URLSearchParams({ part: 'snippet', key });
  if (query.handle) params.set('forHandle', query.handle);
  else if (query.id) params.set('id', query.id);
  else params.set('forUsername', query.username);

  let response;
  try {
    response = await fetch(`${API}?${params}`, { signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('連不上 YouTube API，請檢查網路連線。');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(describeError(response.status, body));

  const item = body?.items?.[0];
  if (!item) throw new Error('找不到這個頻道，請確認連結。');
  const { title, customUrl, thumbnails } = item.snippet;
  const handle = customUrl?.startsWith('@') ? customUrl : null;
  return {
    id: item.id,
    name: title,
    handle,
    url: handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${item.id}`,
    avatar: (thumbnails?.medium ?? thumbnails?.high ?? thumbnails?.default)?.url ?? null,
  };
}
