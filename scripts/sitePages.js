/**
 * 網址不用 # 時，GitHub Pages 需要的建置設定（vite.config.js 使用）：
 *
 * 1. 網站路徑（base）：GitHub Pages 的專案網站在 /<repo>/ 底下。
 *    GitHub Actions 建置時從 GITHUB_REPOSITORY 自動判斷；repo 名稱是 <帳號>.github.io 時為 /。
 *    可用環境變數 BASE_PATH、SITE_URL 覆寫（例如改用自訂網域）。
 *
 * 2. 分享預覽（Open Graph／X）：社群平台的爬蟲不執行 JavaScript，只讀 HTML 本身，
 *    所以建置時替每個公開頁面各產生一份 HTML，寫入自己的標題、說明與分享圖：
 *    - index.html            首頁（にじさんじ 列表），全站分享圖 og-image.jpg
 *    - en/index.html         NIJISANJI EN 列表
 *    - video/<id>/index.html 每支影片（依 src/data/videos.json），分享圖為 YouTube 縮圖
 *    - 404.html              其他網址（發布頁、舊的 /#/ 連結等）：載入網站後由前端路由處理
 *    全站的標題與說明取自 index.html 的 <title> 與 <meta name="description">。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LISTS } from '../src/lib/lists.js';
import { stripLinks } from '../src/lib/richText.js';

const OG_START = '<!-- og:start（建置時自動產生，見 scripts/sitePages.js） -->';
const OG_END = '<!-- og:end -->';
// 全站分享圖：public/og-image.jpg（1200×630）
const SITE_IMAGE = { file: 'og-image.jpg', width: 1200, height: 630 };
const MAX_DESCRIPTION = 200;

const escapeAttr = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unescapeAttr = (value) =>
  String(value).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const withSlash = (p) => (p.endsWith('/') ? p : `${p}/`);

/** 網站路徑與公開網址：dev 一律在 / ；build 時依 GitHub Actions 的環境變數判斷 */
export function siteLocation(env, command) {
  if (command === 'serve') return { base: '/', siteUrl: '' };
  const [owner = '', repo = ''] = String(env.GITHUB_REPOSITORY ?? '').split('/');
  const userSite = repo && repo.toLowerCase() === `${owner.toLowerCase()}.github.io`;
  let base = env.BASE_PATH || (repo && !userSite ? `/${repo}/` : '/');
  base = withSlash(base.startsWith('/') ? base : `/${base}`);
  const siteUrl = env.SITE_URL ? withSlash(env.SITE_URL) : owner ? `https://${owner.toLowerCase()}.github.io${base}` : '';
  return { base, siteUrl };
}

/** 從 index.html 讀全站標題與說明 */
function readSite(html) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1].trim() ?? '';
  const description = unescapeAttr(html.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1] ?? '');
  return { title, description };
}

function clip(text, max = MAX_DESCRIPTION) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** 把一頁的標題、說明與 og:／twitter: meta 寫進 HTML（重複呼叫會取代上一次寫入的） */
function withMeta(html, meta) {
  const tags = [
    ['property', 'og:site_name', meta.siteName],
    ['property', 'og:type', meta.type],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['property', 'og:url', meta.url],
    ['property', 'og:image', meta.image],
    ['property', 'og:image:width', meta.imageWidth],
    ['property', 'og:image:height', meta.imageHeight],
    ['property', 'og:image:alt', meta.imageAlt],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
    ['name', 'twitter:image', meta.image],
  ]
    .filter(([, , value]) => value !== undefined && value !== null && value !== '')
    .map(([attr, key, value]) => `    <meta ${attr}="${key}" content="${escapeAttr(value)}" />`);
  const block = [`    ${OG_START}`, ...tags, `    ${OG_END}`].join('\n');

  // 先拿掉上一次寫入的區塊（index.html 先寫一次全站的，其他頁面再換成自己的）
  const start = html.indexOf(OG_START);
  const end = html.indexOf(OG_END);
  const cleaned = start !== -1 && end > start ? html.slice(0, start).trimEnd() + html.slice(end + OG_END.length) : html;
  return cleaned
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeAttr(meta.title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${escapeAttr(meta.description)}$2`)
    .replace('</head>', `${block}\n  </head>`);
}

/** Vite 外掛：只在 build 時作用 */
export function sitePages({ base, siteUrl }) {
  let root = process.cwd();
  // 有公開網址就用絕對網址（爬蟲需要）；本機建置沒有時退回網站路徑
  const abs = (p) => (siteUrl ? `${siteUrl}${p}` : `${base}${p}`);

  const siteMeta = (site) => ({
    siteName: site.title,
    type: 'website',
    title: site.title,
    description: site.description,
    url: siteUrl,
    image: abs(SITE_IMAGE.file),
    imageWidth: SITE_IMAGE.width,
    imageHeight: SITE_IMAGE.height,
    imageAlt: site.title,
  });

  return {
    name: 'rcfn-site-pages',
    apply: 'build',
    configResolved(config) {
      root = config.root;
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html) => withMeta(html, siteMeta(readSite(html))),
    },
    // index.html 由 Vite 最後才放進輸出，所以等檔案寫出後再讀它來產生其他頁面
    writeBundle(options) {
      const outDir = options.dir;
      const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
      const site = readSite(html);
      const emit = (fileName, meta) => {
        const file = path.join(outDir, fileName);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, withMeta(html, meta));
      };

      // 其他網址：GitHub Pages 找不到檔案時回傳 404.html，網站載入後由前端路由顯示正確頁面
      emit('404.html', siteMeta(site));

      // 首頁以外的列表
      for (const list of LISTS) {
        if (list.path === '/') continue;
        const dir = list.path.replace(/^\/|\/$/g, '');
        emit(`${dir}/index.html`, { ...siteMeta(site), title: `${list.label}｜${site.title}`, url: abs(`${dir}/`) });
      }

      // 每支影片
      const videos = JSON.parse(readFileSync(path.join(root, 'src/data/videos.json'), 'utf8'));
      for (const video of Array.isArray(videos) ? videos : []) {
        if (!video?.id || !/^[\w-]+$/.test(video.id) || !video.youtubeId) continue;
        const thumbnail = video.thumbnail || `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
        emit(`video/${video.id}/index.html`, {
          siteName: site.title,
          type: 'video.other',
          title: `${video.title}｜${site.title}`,
          description: clip(stripLinks(video.description) || site.description),
          url: abs(`video/${video.id}/`),
          image: thumbnail,
          // YouTube 的 hqdefault 縮圖固定 480×360；自訂縮圖不知道尺寸就不寫
          imageWidth: video.thumbnail ? undefined : 480,
          imageHeight: video.thumbnail ? undefined : 360,
          imageAlt: video.title,
        });
      }
    },
  };
}
