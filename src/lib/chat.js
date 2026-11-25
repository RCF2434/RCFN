/**
 * 直播錄檔的聊天室重播。
 *
 * 來源：yt-dlp 下載的聊天紀錄（每行一個 JSON）
 *   yt-dlp --skip-download --write-subs --sub-langs live_chat <影片網址>
 *
 * 轉成精簡的純文字格式存進 public/chats/<id>.json（不存頭貼與圖片）：
 *   {
 *     "v": 1,
 *     "a": [[名稱, 身分]],                  // 身分：o 直播主、m 管理員、s 會員、v 已驗證、"" 一般
 *     "m": [[秒數, 作者索引, 內容, 額外?]]  // 內容：純文字；自訂表情存成代碼（:_hello:）
 *   }
 *   額外：{ "p": [金額, 底色, 字色] } 超級留言／超級貼圖（貼圖存文字說明）、{ "k": "m" } 會員訊息
 */

export const CHAT_VERSION = 1;

/** YouTube 的 ARGB 整數色 → CSS 顏色 */
export function argbToCss(value) {
  if (!Number.isFinite(value)) return null;
  const n = value >>> 0;
  const a = ((n >>> 24) & 255) / 255;
  const r = (n >>> 16) & 255;
  const g = (n >>> 8) & 255;
  const b = n & 255;
  return a >= 0.999 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
}

/** 訊息內容 runs → 純文字；一般表情符號保留，自訂表情改成代碼 */
function convertRuns(runs) {
  if (!Array.isArray(runs)) return '';
  let out = '';
  for (const run of runs) {
    if (typeof run.text === 'string') {
      out += run.text;
    } else if (run.emoji) {
      const { emoji } = run;
      if (!emoji.isCustomEmoji && emoji.emojiId && !emoji.emojiId.startsWith('UC')) out += emoji.emojiId;
      else out += emoji.shortcuts?.[0] ?? emoji.image?.accessibility?.accessibilityData?.label ?? '';
    }
  }
  return out;
}

const textOf = (node) =>
  node?.simpleText ?? (Array.isArray(node?.runs) ? node.runs.map((r) => r.text ?? '').join('') : '');

function roleOf(badges) {
  let role = '';
  for (const badge of badges ?? []) {
    const r = badge.liveChatAuthorBadgeRenderer;
    if (!r) continue;
    const icon = r.icon?.iconType;
    if (icon === 'OWNER') return 'o';
    if (icon === 'MODERATOR') role = 'm';
    else if (r.customThumbnail && role !== 'm') role = 's';
    else if (icon === 'VERIFIED' && !role) role = 'v';
  }
  return role;
}

const authorOf = (r) => ({
  key: r.authorExternalChannelId || textOf(r.authorName),
  name: textOf(r.authorName),
  role: roleOf(r.authorBadges),
});

/** 一則聊天項目 → { author, content, extra? }；不支援的類型回傳 null */
function convertItem(item) {
  const [type, r] = Object.entries(item ?? {})[0] ?? [];
  if (!r) return null;
  switch (type) {
    case 'liveChatTextMessageRenderer': {
      const content = convertRuns(r.message?.runs);
      return content ? { author: authorOf(r), content } : null;
    }
    case 'liveChatPaidMessageRenderer':
      return {
        author: authorOf(r),
        content: convertRuns(r.message?.runs),
        extra: { p: [textOf(r.purchaseAmountText), argbToCss(r.bodyBackgroundColor), argbToCss(r.bodyTextColor)] },
      };
    case 'liveChatPaidStickerRenderer': {
      const label = r.sticker?.accessibility?.accessibilityData?.label;
      return {
        author: authorOf(r),
        content: label ? `［貼圖］${label}` : '［貼圖］',
        extra: { p: [textOf(r.purchaseAmountText), argbToCss(r.backgroundColor), argbToCss(r.moneyChipTextColor)] },
      };
    }
    case 'liveChatMembershipItemRenderer': {
      const header = textOf(r.headerPrimaryText) || textOf(r.headerSubtext);
      const content = [header, convertRuns(r.message?.runs)].filter(Boolean).join(' ');
      return { author: authorOf(r), content, extra: { k: 'm' } };
    }
    case 'liveChatSponsorshipsGiftPurchaseAnnouncementRenderer': {
      const header = r.header?.liveChatSponsorshipsHeaderRenderer;
      if (!header) return null;
      return {
        author: { ...authorOf(header), key: r.authorExternalChannelId || authorOf(header).key },
        content: textOf(header.primaryText),
        extra: { k: 'm' },
      };
    }
    default:
      return null;
  }
}

function actionsOf(line) {
  const replay = line.replayChatItemAction;
  if (replay) {
    return { actions: replay.actions ?? [], offset: Number(replay.videoOffsetTimeMsec ?? line.videoOffsetTimeMsec) };
  }
  if (line.addChatItemAction) return { actions: [line], offset: Number(line.videoOffsetTimeMsec) };
  return { actions: [], offset: NaN };
}

/**
 * 轉換 yt-dlp 的 live_chat.json（每行一個 JSON）。
 * @returns {{ data: object, stats: { messages, paid, members, authors, skipped, badLines, start, end } }}
 */
export function convertYtDlpChat(text) {
  const authors = [];
  const authorIndex = new Map();
  const messages = [];
  const stats = { messages: 0, paid: 0, members: 0, authors: 0, skipped: 0, badLines: 0, start: null, end: null };

  for (const raw of String(text).replace(/^﻿/, '').split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let line;
    try {
      line = JSON.parse(raw);
    } catch {
      stats.badLines += 1;
      continue;
    }
    const { actions, offset } = actionsOf(line);
    for (const action of actions) {
      const item = action.addChatItemAction?.item;
      if (!item) continue;
      const msg = convertItem(item);
      if (!msg || !Number.isFinite(offset)) {
        stats.skipped += 1;
        continue;
      }
      let index = authorIndex.get(msg.author.key);
      if (index === undefined) {
        index = authors.length;
        authorIndex.set(msg.author.key, index);
        authors.push([msg.author.name, msg.author.role]);
      }
      // 開播前的留言放在 0 秒
      const t = Math.max(0, Math.round(offset / 100) / 10);
      messages.push(msg.extra ? [t, index, msg.content, msg.extra] : [t, index, msg.content]);
      if (msg.extra?.p) stats.paid += 1;
      if (msg.extra?.k === 'm') stats.members += 1;
    }
  }

  messages.sort((a, b) => a[0] - b[0]);
  if (!messages.length) {
    throw new Error(stats.badLines ? '讀不懂這個檔案，請確認是 yt-dlp 下載的 live_chat.json。' : '檔案裡沒有任何聊天訊息。');
  }
  stats.messages = messages.length;
  stats.authors = authors.length;
  stats.start = messages[0][0];
  stats.end = messages.at(-1)[0];
  return { data: { v: CHAT_VERSION, a: authors, m: messages }, stats };
}

/** 精簡格式 → 播放用資料：{ messages: [{ id, t, author: { name, role }, content, paid, member }] } */
export function readChatData(json) {
  if (!json || json.v !== CHAT_VERSION || !Array.isArray(json.a) || !Array.isArray(json.m)) {
    throw new Error('聊天室紀錄的格式不正確');
  }
  const authors = json.a.map(([name, role]) => ({ name: String(name ?? ''), role: role ?? '' }));
  const messages = json.m
    .filter((m) => Array.isArray(m) && Number.isFinite(m[0]) && authors[m[1]])
    .map(([t, a, content, extra], id) => ({
      id,
      t,
      author: authors[a],
      content: typeof content === 'string' ? content : '',
      paid: extra?.p ? { amount: extra.p[0], bg: extra.p[1], fg: extra.p[2] } : null,
      member: extra?.k === 'm',
    }));
  return { messages };
}

/** 播放到 time 時，最後一則該顯示的訊息索引（-1 = 還沒有）；messages 依時間排序 */
export function lastIndexAt(messages, time) {
  let lo = 0;
  let hi = messages.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (messages[mid].t <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
