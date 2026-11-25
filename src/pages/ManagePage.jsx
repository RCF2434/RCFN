import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useGitHubConnection } from '../hooks/useGitHubConnection.js';
import { useDeployWatcher } from '../hooks/useDeployWatcher.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import ConnectionPanel from '../components/publish/ConnectionPanel.jsx';
import PublishStatus from '../components/publish/PublishStatus.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { deleteVideo, publicSiteUrl, removeVideo } from '../lib/publish.js';
import { LISTS, getList, listPath, videoListKey } from '../lib/lists.js';
import { thumbnailUrl } from '../lib/videos.js';
import { normalizeForSearch } from '../lib/search.js';
import { removeNotesDraft } from '../lib/notesDraft.js';
import { textLang } from '../lib/lang.js';

/** 一支影片的摘要：網址代稱、字幕、聊天室、註釋 */
function videoMeta(video) {
  return [
    video.chat ? '聊天室重播' : null,
    Array.isArray(video.notes) && video.notes.length ? `${video.notes.length} 則註釋` : null,
    Array.isArray(video.tags) && video.tags.length ? video.tags.map((t) => `#${t}`).join(' ') : null,
  ].filter(Boolean);
}

/**
 * 管理影片（只在本機開發時存在）：列出 repo 裡所有影片，可以編輯或刪除。
 * 新增影片在發布頁；編輯沿用發布頁的四步驟表單（/manage/<id>）。
 */
export default function ManagePage() {
  useDocumentTitle('管理影片');
  const uid = useId();
  const { settings, conn, setConn, connect, disconnect } = useGitHubConnection();
  const [listKey, setListKey] = useState(LISTS[0].key);
  const [query, setQuery] = useState('');
  const [job, setJob] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null); // 等待確認要刪除的影片
  const busy = job?.phase === 'committing';
  useDeployWatcher(conn.gh, job, setJob);

  const videos = conn.videos ?? [];
  const counts = useMemo(
    () => Object.fromEntries(LISTS.map((l) => [l.key, videos.filter((v) => videoListKey(v) === l.key).length])),
    [videos],
  );
  const q = normalizeForSearch(query.trim());
  const shown = videos.filter(
    (v) =>
      videoListKey(v) === listKey &&
      (!q || normalizeForSearch(v.title).includes(q) || normalizeForSearch(v.id).includes(q)),
  );

  // 確認框列出會刪掉的檔案（依目前讀到的 videos.json；實際刪除時會再以最新版本確認）
  const deletePreview = useMemo(() => {
    if (!pendingDelete || !conn.videos) return null;
    try {
      return removeVideo(conn.videos, pendingDelete.id);
    } catch {
      return null;
    }
  }, [pendingDelete, conn.videos]);

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target || busy) return;
    const base = { kind: 'delete', id: target.id, title: target.title };
    setJob({ ...base, phase: 'committing' });
    try {
      const result = await deleteVideo(conn.gh, { branch: settings.branch, id: target.id });
      setConn((c) => ({ ...c, videos: result.videos, headSha: result.commitSha }));
      removeNotesDraft(target.youtubeId);
      setJob({
        ...base,
        phase: 'deploying',
        commitSha: result.commitSha,
        startedAt: Date.now(),
        deletedFiles: result.deletedFiles,
        path: listPath(videoListKey(target)),
        openLabel: '開啟影片列表',
      });
    } catch (err) {
      setJob({ ...base, phase: 'failed', error: err.message });
    }
  }

  const siteUrl = settings.owner && settings.repo ? publicSiteUrl(settings.owner, settings.repo) : '';
  const current = getList(listKey);

  return (
    <div className="container publish-page manage-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={18} aria-hidden="true" />
        返回列表
      </Link>

      <header className="video-head">
        <p className="eyebrow">Backstage</p>
        <h1>管理影片</h1>
        <p className="lead">
          編輯或刪除已發布的影片，資料直接讀取本網站的 GitHub repo，修改後約 1–2 分鐘上線。新增影片請至「發布影片」。
        </p>
      </header>

      <ConnectionPanel
        settings={settings}
        conn={conn}
        onConnect={connect}
        onDisconnect={disconnect}
        step={null}
        intro="管理影片需要讀取本網站的 GitHub repo。"
      />

      {job && (
        <section className="panel danger-zone" aria-label="刪除進度">
          <p className="eyebrow">Delete</p>
          <PublishStatus job={job} repoUrl={conn.gh?.repoUrl ?? ''} siteUrl={siteUrl} />
          {job.phase !== 'committing' && (
            <button type="button" className="btn btn--ghost" onClick={() => setJob(null)}>
              關閉
            </button>
          )}
        </section>
      )}

      {conn.status === 'ready' && (
        <section className="panel manage-panel" aria-labelledby={`${uid}-title`}>
          <div className="manage-panel__head">
            <div>
              <p className="eyebrow">Videos</p>
              <h2 id={`${uid}-title`} className="panel__title">
                影片
              </h2>
            </div>
            <Link to="/publish" className="btn">
              <Plus size={16} aria-hidden="true" />
              發布新影片
            </Link>
          </div>

          <div className="manage-panel__filters">
            <fieldset className="choice-group">
              <legend className="visually-hidden">列表</legend>
              <div className="choice-group__options">
                {LISTS.map((l) => (
                  <label key={l.key} className="choice">
                    <input
                      type="radio"
                      name={`${uid}-list`}
                      value={l.key}
                      checked={listKey === l.key}
                      onChange={() => setListKey(l.key)}
                    />
                    <span className="choice__label" lang={l.key === 'nijisanji' ? 'ja' : 'en'}>
                      {l.label}
                      <span className="choice__count">{counts[l.key]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="search manage-search">
              <Search size={18} aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋標題或網址代稱"
                aria-label={`搜尋 ${current.label} 的影片`}
                autoComplete="off"
              />
              {query && (
                <button type="button" className="search__clear" aria-label="清除搜尋" onClick={() => setQuery('')}>
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {shown.length > 0 ? (
            <ul className="manage-list" aria-label={`${current.label} 的影片`}>
              {shown.map((video) => (
                <li key={video.id} className="manage-row">
                  <img className="manage-row__thumb" src={thumbnailUrl(video)} alt="" loading="lazy" decoding="async" />
                  <div className="manage-row__body">
                    <p className="manage-row__title" lang={textLang(video.title)}>
                      {video.title}
                    </p>
                    <p className="manage-row__meta">
                      <span className="mono">{video.id}</span>
                      {videoMeta(video).map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </p>
                  </div>
                  <div className="manage-row__actions">
                    <Link to={`/manage/${encodeURIComponent(video.id)}`} className="btn btn--ghost" aria-label={`編輯「${video.title}」`}>
                      <Pencil size={16} aria-hidden="true" />
                      編輯
                    </Link>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => setPendingDelete(video)}
                      disabled={busy}
                      aria-label={`刪除「${video.title}」`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      刪除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">{q ? `${current.label} 中沒有符合「${query.trim()}」的影片。` : `${current.label} 目前沒有影片。`}</p>
          )}
        </section>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`刪除「${pendingDelete?.title ?? ''}」？`}
        confirmLabel="刪除影片"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      >
        <p>
          會從 videos.json 移除這支影片{deletePreview?.files.length ? '，並刪除下列檔案' : ''}，部署完成後（約 1–2 分鐘）從網站消失。
        </p>
        {deletePreview?.files.length > 0 && (
          <ul className="confirm-dialog__files">
            {deletePreview.files.map((path) => (
              <li key={path} className="mono">
                {path}
              </li>
            ))}
          </ul>
        )}
        <p>刪除後只能從 GitHub 的 commit 紀錄還原。</p>
      </ConfirmDialog>
    </div>
  );
}
