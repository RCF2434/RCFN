import { useState } from 'react';
import { Check, Circle, CircleCheck, CircleX, Copy, ExternalLink, LoaderCircle } from 'lucide-react';

const RUN_STATUS = {
  queued: '排隊中',
  waiting: '等待中',
  pending: '等待中',
  requested: '等待中',
  in_progress: '建置中',
};

function Step({ state, children }) {
  const Icon = { done: CircleCheck, active: LoaderCircle, failed: CircleX, pending: Circle }[state];
  return (
    <li className={`step step--${state}`}>
      <Icon size={18} className={state === 'active' ? 'spin' : undefined} aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

function CopyLink({ url }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-row">
      <input className="input mono" readOnly value={url} aria-label="影片頁公開網址" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="btn btn--icon"
        aria-label={copied ? '已複製' : '複製網址'}
        title={copied ? '已複製' : '複製網址'}
        onClick={() => {
          navigator.clipboard?.writeText(url).then(
            () => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            },
            () => {},
          );
        }}
      >
        {copied ? <Check size={18} /> : <Copy size={18} />}
      </button>
    </div>
  );
}

/** 發布後的進度：寫入 repo → GitHub Actions 部署 → 上線 */
export default function PublishStatus({ job, repoUrl, siteUrl }) {
  if (!job) return null;
  const { phase, commitSha, run } = job;
  const path = job.path ?? `/video/${job.id}`;
  const shareUrl = `${siteUrl}#${path}`;
  // 加上 ?v= 讓瀏覽器重新載入新版網站，而不是用這一頁已載入的舊版資料
  const openUrl = commitSha ? `${siteUrl}?v=${commitSha.slice(0, 7)}#${path}` : shareUrl;

  const commitState = phase === 'committing' ? 'active' : commitSha ? 'done' : 'failed';
  const deployState = !commitSha
    ? 'pending'
    : phase === 'done'
      ? 'done'
      : phase === 'failed'
        ? 'failed'
        : phase === 'unknown'
          ? 'pending'
          : 'active';

  return (
    <div className="publish-status" aria-live="polite">
      <ol className="steps">
        <Step state={commitState}>
          {commitState === 'active' && '寫入 GitHub repo…'}
          {commitState === 'done' && (
            <>
              已寫入 repo（
              <a href={`${repoUrl}/commit/${commitSha}`} target="_blank" rel="noreferrer" className="mono">
                {commitSha.slice(0, 7)}
              </a>
              ）
            </>
          )}
          {commitState === 'failed' && '寫入 repo 失敗'}
        </Step>
        <Step state={deployState}>
          {deployState === 'done' && '部署完成'}
          {deployState === 'failed' && '部署失敗'}
          {deployState === 'active' && `部署中${run ? `（${RUN_STATUS[run.status] ?? run.status}）` : ''}…通常 1–2 分鐘`}
          {deployState === 'pending' && (phase === 'unknown' ? '部署進度不明' : '部署')}
          {run?.html_url && (
            <>
              {' · '}
              <a href={run.html_url} target="_blank" rel="noreferrer">
                查看紀錄
              </a>
            </>
          )}
        </Step>
      </ol>

      {job.error && (
        <p className="notice notice--error" role="alert">
          {job.error}
        </p>
      )}
      {job.note && (
        <p className="notice">
          {job.note}{' '}
          <a href={`${repoUrl}/actions`} target="_blank" rel="noreferrer">
            開啟 GitHub Actions
          </a>
        </p>
      )}

      {/* 刪除影片：沒有要分享的網址，改說明結果 */}
      {job.kind === 'delete' && commitSha && (
        <div className="publish-share">
          <p>
            {phase === 'done'
              ? `已從網站移除「${job.title}」。`
              : `已從 repo 移除「${job.title}」，部署完成後會從網站消失。`}
            {job.deletedFiles?.length > 0 && ` 同時刪除了 ${job.deletedFiles.length} 個檔案。`}
          </p>
          {phase === 'done' && (
            <a className="btn" href={openUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              {job.openLabel ?? '開啟影片列表'}
            </a>
          )}
        </div>
      )}

      {job.kind !== 'delete' && (phase === 'done' || phase === 'unknown' || phase === 'deploying') && commitSha && (
        <div className="publish-share">
          <p className="field__label">{phase === 'done' ? '已上線，公開網址：' : '上線後的網址：'}</p>
          <CopyLink url={shareUrl} />
          {phase === 'done' && (
            <a className="btn" href={openUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} aria-hidden="true" />
              {job.openLabel ?? '開啟影片頁'}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
