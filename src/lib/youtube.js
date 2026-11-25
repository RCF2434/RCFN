let apiPromise = null;

/** 只載入一次 YouTube IFrame Player API */
export function loadYouTubeAPI() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => {
        apiPromise = null;
        script.remove();
        reject(new Error('無法載入 YouTube 播放器，請確認網路連線或關閉阻擋外部腳本的擴充功能。'));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

const PLAYER_ERRORS = {
  2: '影片 ID 格式不正確，請檢查 videos.json 的 youtubeId。',
  5: '瀏覽器無法播放這支影片。',
  100: '找不到影片，可能已被刪除或設為私人。',
  101: '影片擁有者不允許在其他網站嵌入播放。',
  150: '影片擁有者不允許在其他網站嵌入播放。',
};

/** 101、150：擁有者不允許嵌入（年齡限制的影片也會回這兩個代碼） */
export const EMBED_BLOCKED = new Set([101, 150]);

export function playerErrorMessage(code) {
  return PLAYER_ERRORS[code] ?? `播放器發生錯誤（代碼 ${code}）。`;
}

export const PLAYING = 1;
export const BUFFERING = 3;

const ID_RE = /^[\w-]{11}$/;

/**
 * YouTube oEmbed：不需要 API 金鑰，可以從瀏覽器直接呼叫（有 CORS）。
 * 回傳 { title, uploader: { name, url } }；影片不存在或不允許嵌入時丟出錯誤。
 */
export async function fetchOEmbed(youtubeId, signal) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`oEmbed HTTP ${response.status}`);
  const data = await response.json();
  return {
    title: data.title ?? '',
    uploader: data.author_name ? { name: data.author_name, url: data.author_url ?? null } : null,
  };
}

/**
 * 從各種 YouTube 網址取出影片 ID：watch?v=、youtu.be/、shorts/、embed/、live/，
 * 或直接貼 11 字元的 ID。辨識不出來回傳 null。
 */
export function parseYouTubeId(input) {
  const value = String(input ?? '').trim();
  if (ID_RE.test(value)) return value;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') ?? url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)?.[1];
  }
  return id && ID_RE.test(id) ? id : null;
}
