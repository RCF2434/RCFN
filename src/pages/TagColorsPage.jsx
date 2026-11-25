import { useEffect, useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, RotateCcw, Search, Send } from 'lucide-react';
import { PALETTE } from '../lib/speakers.js';
import { collectTags } from '../lib/tags.js';
import { TAG_COLORS, sameColor, serializeTagColors, tagColor, tagColorProps } from '../lib/tagColors.js';
import { HEX_RE, MIN_CONTRAST, TAG_BACKGROUNDS, contrastRatio } from '../lib/contrast.js';
import { publicSiteUrl, saveTagColors } from '../lib/publish.js';
import { videos as bundledVideos } from '../lib/videos.js';
import { useGitHubConnection } from '../hooks/useGitHubConnection.js';
import { useDeployWatcher } from '../hooks/useDeployWatcher.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import ConnectionPanel from '../components/publish/ConnectionPanel.jsx';
import PublishStatus from '../components/publish/PublishStatus.jsx';
import TicketTear from '../components/TicketTear.jsx';

const DEFAULT_OPTION = { key: '', label: '預設', light: 'var(--text)', deep: 'var(--text)' };
const OPTIONS = [DEFAULT_OPTION, ...PALETTE];
const CUSTOM = 'custom';
const SEARCH_THRESHOLD = 12;

/** 一個色碼欄位：色盤＋可直接輸入的色碼，並在實際底色上預覽、顯示對比 */
function HexField({ label, value, onChange, background, tag }) {
  const id = useId();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const ratio = contrastRatio(value, background);
  const low = ratio !== null && ratio < MIN_CONTRAST;

  return (
    <div className="hex-field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      <div className="hex-field__row">
        <input
          type="color"
          className="hex-field__picker"
          value={value.toLowerCase()}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          aria-label={`${label}：用色盤選`}
        />
        <input
          id={id}
          className="input mono"
          value={text}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            setText(event.target.value);
            const hex = event.target.value.trim().replace(/^#?/, '#');
            if (HEX_RE.test(hex)) onChange(hex.toUpperCase());
          }}
          onBlur={() => setText(value)}
        />
        <span className="hex-field__preview" style={{ background, color: value }} aria-hidden="true">
          #{tag}
        </span>
      </div>
      <p className={`field__hint${low ? ' field__hint--error' : ''}`}>
        對比 {ratio ? ratio.toFixed(1) : '—'}:1{low ? `，低於 ${MIN_CONTRAST}:1，可能看不清楚` : ''}
      </p>
    </div>
  );
}

/** 一個標籤一列：預覽＋使用次數＋顏色選擇（預設、調色盤、自訂） */
function TagColorRow({ tag, count, colors, onChange, disabled }) {
  const group = useId();
  const color = tagColor(tag, colors);
  const current = color ? (color.key ?? CUSTOM) : '';

  return (
    <fieldset className="tag-color-row" disabled={disabled}>
      <legend className="tag-color-row__head">
        <span className="tag-chip" {...tagColorProps(tag, colors)}>
          #{tag}
        </span>
        <span className="muted">{count ? `${count} 支影片` : '沒有影片使用'}</span>
      </legend>
      <div className="swatches">
        {OPTIONS.map((option) => (
          <label key={option.key || 'default'} className="swatch" title={option.label}>
            <input
              type="radio"
              name={group}
              checked={current === option.key}
              onChange={() => onChange(tag, option.key)}
              aria-label={`${tag}：${option.label}`}
            />
            <span
              className={`swatch__dot${option.key ? '' : ' swatch__dot--default'}`}
              style={{ '--spk-light': option.light, '--spk-deep': option.deep }}
              aria-hidden="true"
            />
          </label>
        ))}
        <label className="swatch swatch--custom" title="自訂色碼">
          <input
            type="radio"
            name={group}
            checked={current === CUSTOM}
            // 從目前的顏色開始改；沒有顏色就從第一個調色盤顏色開始
            onChange={() => onChange(tag, { light: (color ?? PALETTE[0]).light, deep: (color ?? PALETTE[0]).deep })}
            aria-label={`${tag}：自訂色碼`}
          />
          <span
            className="swatch__dot swatch__dot--custom"
            style={current === CUSTOM ? { '--spk-light': color.light, '--spk-deep': color.deep } : undefined}
            aria-hidden="true"
          />
          <span className="swatch__text">自訂</span>
        </label>
      </div>

      {current === CUSTOM && (
        <div className="hex-fields">
          <HexField
            label="淺色主題的文字（米色底）"
            value={color.deep}
            background={TAG_BACKGROUNDS.light}
            tag={tag}
            onChange={(deep) => onChange(tag, { light: color.light, deep })}
          />
          <HexField
            label="深色主題的文字（深灰底）"
            value={color.light}
            background={TAG_BACKGROUNDS.dark}
            tag={tag}
            onChange={(light) => onChange(tag, { light, deep: color.deep })}
          />
        </div>
      )}
    </fieldset>
  );
}

export default function TagColorsPage() {
  useDocumentTitle('標籤顏色');
  const uid = useId();
  const { settings, conn, setConn, connect, disconnect } = useGitHubConnection();

  // 連線後以 repo 最新的資料為準，沒連線就用網站目前打包的資料
  const videos = conn.videos ?? bundledVideos;
  const base = conn.tagColors ?? TAG_COLORS;
  const [draft, setDraft] = useState(null); // null = 沒有修改
  const colors = draft ?? base;
  const dirty = draft !== null && serializeTagColors(draft) !== serializeTagColors(base);

  const [filter, setFilter] = useState('');
  const [job, setJob] = useState(null);
  useDeployWatcher(conn.gh, job, setJob);

  const rows = useMemo(() => {
    const counts = new Map();
    for (const video of videos) {
      for (const tag of video.tags ?? []) {
        const k = tag.toLocaleLowerCase();
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    const used = collectTags(videos);
    const usedKeys = new Set(used.map((t) => t.toLocaleLowerCase()));
    // 設定了顏色但已經沒有影片使用的標籤也列出來，方便清掉
    const orphans = Object.keys(colors).filter((t) => !usedKeys.has(t.toLocaleLowerCase()));
    return [...used, ...orphans].map((tag) => ({ tag, count: counts.get(tag.toLocaleLowerCase()) ?? 0 }));
  }, [videos, colors]);

  const keyword = filter.trim().toLocaleLowerCase();
  const shown = keyword ? rows.filter((r) => r.tag.toLocaleLowerCase().includes(keyword)) : rows;
  const changedCount = useMemo(() => {
    if (!dirty) return 0;
    const all = new Set([...Object.keys(base), ...Object.keys(draft)].map((t) => t.toLocaleLowerCase()));
    return [...all].filter((k) => !sameColor(tagColor(k, base), tagColor(k, draft))).length;
  }, [dirty, base, draft]);

  /** value：調色盤名稱、{ light, deep }，或空字串（不上色） */
  const setColor = (tag, value) => {
    setJob((j) => (j?.phase === 'committing' ? j : null));
    setDraft((d) => {
      const next = { ...(d ?? base) };
      for (const name of Object.keys(next)) {
        if (name.toLocaleLowerCase() === tag.toLocaleLowerCase()) delete next[name];
      }
      if (value) next[tag] = value;
      return next;
    });
  };

  const busy = job?.phase === 'committing';
  const problems = [];
  if (!dirty) problems.push('還沒有修改任何顏色');
  if (conn.status !== 'ready') problems.push('在上方連線 GitHub');

  async function save() {
    if (problems.length || busy) return;
    const next = draft;
    setJob({ phase: 'committing', path: '/', openLabel: '打開影片列表' });
    try {
      const content = serializeTagColors(next);
      const { commitSha } = await saveTagColors(conn.gh, { branch: settings.branch, content });
      setConn((c) => ({ ...c, tagColors: JSON.parse(content), headSha: commitSha }));
      setDraft(null);
      setJob({ phase: 'deploying', commitSha, startedAt: Date.now(), path: '/', openLabel: '打開影片列表' });
    } catch (err) {
      setJob({ phase: 'failed', path: '/', error: err.message });
    }
  }

  const siteUrl = settings.owner && settings.repo ? publicSiteUrl(settings.owner, settings.repo) : '';

  return (
    <div className="container publish-page">
      <Link to="/publish" className="back-link">
        <ArrowLeft size={18} aria-hidden="true" />
        回到發布影片
      </Link>

      <header className="video-head">
        <p className="eyebrow">Backstage</p>
        <h1>標籤顏色</h1>
        <p className="lead">
          幫每個標籤選一個文字顏色，列表頁、影片頁和搜尋框裡的標籤都會套用。儲存後會寫進 GitHub repo
          並重新部署。顏色在淺色與深色主題會自動換成適合的深淺，可以用右上角的按鈕切換主題確認。
        </p>
      </header>

      <ConnectionPanel settings={settings} conn={conn} onConnect={connect} onDisconnect={disconnect} />

      <div className="tag-colors-layout">
        <section className="panel" aria-labelledby={`${uid}-list`}>
          <div>
            <p className="eyebrow">Tags</p>
            <h2 id={`${uid}-list`} className="panel__title">
              {rows.length} 個標籤
            </h2>
          </div>

          {rows.length > SEARCH_THRESHOLD && (
            <div className="field">
              <label className="field__label" htmlFor={`${uid}-filter`}>
                找標籤
              </label>
              <div className="search">
                <Search size={18} aria-hidden="true" />
                <input
                  id={`${uid}-filter`}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {rows.length === 0 ? (
            <p className="muted">還沒有任何影片有標籤。到發布頁幫影片加上標籤後，就可以在這裡設定顏色。</p>
          ) : shown.length === 0 ? (
            <p className="muted">沒有符合「{filter.trim()}」的標籤。</p>
          ) : (
            <div className="tag-color-list">
              {shown.map(({ tag, count }) => (
                <TagColorRow key={tag} tag={tag} count={count} colors={colors} onChange={setColor} disabled={busy} />
              ))}
            </div>
          )}
        </section>

        <section className="panel panel--ticket tag-colors-save" aria-labelledby={`${uid}-save`}>
          <p className="eyebrow">Admit One</p>
          <h2 id={`${uid}-save`} className="panel__title">
            儲存
          </h2>
          {problems.length > 0 ? (
            <ul className="checklist">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">改了 {changedCount} 個標籤的顏色。</p>
          )}
          <div className="btn-row">
            <button type="button" className="btn" onClick={save} disabled={problems.length > 0 || busy}>
              <Send size={16} aria-hidden="true" />
              {busy ? '儲存中…' : '儲存並發布'}
            </button>
            {dirty && !busy && (
              <button type="button" className="btn btn--ghost" onClick={() => setDraft(null)}>
                <RotateCcw size={16} aria-hidden="true" />
                還原
              </button>
            )}
          </div>
          {job && (
            <>
              <TicketTear />
              <PublishStatus job={job} repoUrl={conn.gh?.repoUrl ?? ''} siteUrl={siteUrl} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
