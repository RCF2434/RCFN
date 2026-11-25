/**
 * 檢查 src/data/videos.json 與 public/ 底下的字幕檔。
 * npm run check:subs 單獨執行；npm run build 前也會自動跑。
 * 錯誤（檔案不存在、設定缺欄位）會讓 build 失敗；格式警告只列出不擋部署。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSRT } from '../src/lib/srt.js';
import { PALETTE_KEYS, resolveSpeakerColors, toSpeakerColor } from '../src/lib/speakers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const videos = JSON.parse(await readFile(path.join(root, 'src/data/videos.json'), 'utf8'));

let errors = 0;
let warnings = 0;
const error = (msg) => {
  errors += 1;
  console.error(`  [錯誤] ${msg}`);
};
const warn = (msg) => {
  warnings += 1;
  console.warn(`  [警告] ${msg}`);
};

const ids = new Set();
for (const video of videos) {
  console.log(`\n${video.id ?? '(缺少 id)'}  ${video.title ?? ''}`);

  for (const field of ['id', 'youtubeId', 'title', 'subtitle']) {
    if (!video[field]) error(`缺少欄位 "${field}"`);
  }
  if (video.id && !/^[\w-]+$/.test(video.id)) error(`id 只能用英數字、底線、連字號：「${video.id}」`);
  if (video.id && ids.has(video.id)) error(`id 重複：「${video.id}」`);
  ids.add(video.id);
  if (video.youtubeId && !/^[\w-]{11}$/.test(video.youtubeId)) warn(`youtubeId 通常是 11 個字元：「${video.youtubeId}」`);

  for (const [name, value] of Object.entries(video.speakers ?? {})) {
    if (!toSpeakerColor(value)) {
      warn(`說話人「${name}」的顏色設定無效，將自動配色。可用：${PALETTE_KEYS.join(', ')}，或 { "light": "#RRGGBB", "deep": "#RRGGBB" }`);
    }
  }

  if (video.tags !== undefined && (!Array.isArray(video.tags) || video.tags.some((t) => typeof t !== 'string' || !t.trim()))) {
    warn('tags 應該是字串陣列，例如 ["訪談", "科技"]');
  }

  if (video.channels !== undefined && !Array.isArray(video.channels)) warn('channels 應該是陣列');
  const channelList = Array.isArray(video.channels) ? video.channels : video.channel ? [video.channel] : [];
  channelList.forEach((c, i) => {
    const label = `第 ${i + 1} 個頻道`;
    if (!c || typeof c.name !== 'string' || !/^https:\/\/www\.youtube\.com\//.test(c.url ?? '')) {
      warn(`${label}需要 name 與 url（https://www.youtube.com/…），不會顯示`);
    } else if (c.avatar && !/^https:\/\//.test(c.avatar)) {
      warn(`${label}的 avatar 應該是 https 圖片網址`);
    }
  });

  if (video.notes !== undefined) {
    if (!Array.isArray(video.notes)) warn('notes 應該是陣列，例如 [{ "time": 83, "text": "註釋" }]');
    else
      video.notes.forEach((n, i) => {
        if (!n || !Number.isFinite(n.time) || n.time < 0) warn(`第 ${i + 1} 則註釋的 time 應該是秒數（數字）`);
        if (!n || typeof n.text !== 'string' || !n.text.trim()) warn(`第 ${i + 1} 則註釋沒有內容`);
      });
  }

  if (!video.subtitle) continue;
  let text;
  try {
    text = await readFile(path.join(root, 'public', video.subtitle), 'utf8');
  } catch {
    error(`找不到字幕檔 public/${video.subtitle}`);
    continue;
  }

  const result = parseSRT(text);
  result.warnings.forEach(warn);
  if (!result.cues.length) error('字幕檔解析後沒有任何字幕');

  const configured = new Set(Object.keys(video.speakers ?? {}));
  const colors = resolveSpeakerColors(result.speakers, video.speakers);
  const auto = result.speakers.filter((name) => !configured.has(name));
  const unused = [...configured].filter((name) => !result.speakers.includes(name));
  const unlabeled = result.cues.reduce((n, cue) => n + cue.lines.filter((line) => !line.speaker).length, 0);

  console.log(`  ${result.cues.length} 句字幕；說話人：${result.speakers.map((n) => `${n}(${colors.get(n).key ?? '自訂'})`).join('、') || '無'}`);
  if (auto.length) console.log(`  自動配色：${auto.join('、')}（可在 videos.json 的 speakers 指定）`);
  if (unlabeled) console.log(`  ${unlabeled} 行沒有標記說話人，將以中性色顯示`);
  const noteTimes = Array.isArray(video.notes) ? video.notes.filter((n) => Number.isFinite(n?.time)).map((n) => n.time) : [];
  const uncovered = noteTimes.filter((t) => !result.cues.some((c) => c.start <= t && t < c.end));
  if (noteTimes.length) console.log(`  ${noteTimes.length} 則註釋${uncovered.length ? `，其中 ${uncovered.length} 則的時間沒有字幕（不會標在字幕上）` : ''}`);
  if (unused.length) warn(`videos.json 設定了字幕裡沒出現的說話人：${unused.join('、')}（名稱需與 <v 名字> 完全一致）`);
}

console.log('\n標籤顏色（src/data/tags.json）');
let tagColors = {};
try {
  tagColors = JSON.parse(await readFile(path.join(root, 'src/data/tags.json'), 'utf8'));
} catch (err) {
  if (err.code !== 'ENOENT') error(`src/data/tags.json 不是有效的 JSON：${err.message}`);
}
const usedTags = new Set(videos.flatMap((v) => v.tags ?? []).map((t) => t.toLocaleLowerCase()));
for (const [tag, value] of Object.entries(tagColors ?? {})) {
  if (!toSpeakerColor(value)) {
    warn(`標籤「${tag}」的顏色設定無效，可用：${PALETTE_KEYS.join(', ')}，或 { "light": "#RRGGBB", "deep": "#RRGGBB" }`);
  }
  if (!usedTags.has(tag.toLocaleLowerCase())) console.log(`  「${tag}」目前沒有影片使用`);
}
console.log(`  已設定 ${Object.keys(tagColors ?? {}).length} 個標籤的顏色`);

console.log(`\n完成：${errors} 個錯誤、${warnings} 個警告`);
process.exit(errors ? 1 : 0);
