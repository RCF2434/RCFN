import data from '../data/videos.json';

export const videos = data;

export function findVideo(id) {
  return videos.find((video) => video.id === id) ?? null;
}

/** BASE_URL 為 './'，字幕檔放在 public/ 底下即可 */
export function subtitleUrl(video) {
  return `${import.meta.env.BASE_URL}${video.subtitle.replace(/^\/+/, '')}`;
}

/** 影片的頻道清單；相容舊格式的單一 channel 欄位 */
export function videoChannels(video) {
  const list = Array.isArray(video?.channels) ? video.channels : video?.channel ? [video.channel] : [];
  return list.filter((c) => c && c.name && c.url);
}

export function thumbnailUrl(video) {
  return video.thumbnail ?? `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
}

export function watchUrl(video) {
  return `https://www.youtube.com/watch?v=${video.youtubeId}`;
}
