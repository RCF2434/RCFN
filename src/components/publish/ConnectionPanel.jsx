import { useId, useState } from 'react';
import { ExternalLink, KeyRound, RefreshCw, Unplug } from 'lucide-react';
import Toggle from '../Toggle.jsx';

const NEW_TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

/** 步驟一：連線 GitHub。連線成功後收合成一行摘要。 */
export default function ConnectionPanel({ settings, conn, onConnect, onDisconnect }) {
  const [draft, setDraft] = useState(settings);
  const [editing, setEditing] = useState(false);
  const uid = useId();
  const connected = conn.status === 'ready';
  const connecting = conn.status === 'connecting';
  const bind = (key) => ({
    id: `${uid}-${key}`,
    value: draft[key],
    onChange: (event) => setDraft((d) => ({ ...d, [key]: event.target.value })),
  });

  if (connected && !editing) {
    return (
      <section className="panel conn-panel" aria-labelledby={`${uid}-title`}>
        <div className="conn-summary">
          <div>
            <p className="eyebrow">Step 1 · GitHub</p>
            <h2 id={`${uid}-title`} className="panel__title">
              已連線
            </h2>
            <p className="muted">
              <span className="mono">
                {settings.owner}/{settings.repo}
              </span>{' '}
              · {settings.branch} 分支 · repo 裡有 {conn.videos.length} 支影片
            </p>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => onConnect(settings)}>
              <RefreshCw size={16} aria-hidden="true" />
              重新讀取
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setDraft(settings);
                setEditing(true);
              }}
            >
              變更
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setDraft((d) => ({ ...d, token: '' }));
                onDisconnect();
              }}
            >
              <Unplug size={16} aria-hidden="true" />
              中斷並清除 token
            </button>
          </div>
        </div>
      </section>
    );
  }

  const canSubmit = draft.owner.trim() && draft.repo.trim() && draft.branch.trim() && draft.token.trim() && !connecting;

  return (
    <section className="panel conn-panel" aria-labelledby={`${uid}-title`}>
      <div>
        <p className="eyebrow">Step 1 · GitHub</p>
        <h2 id={`${uid}-title`} className="panel__title">
          連線你的 repo
        </h2>
      </div>
      <p className="panel__text muted">
        發布時需要寫入這個網站的 GitHub repo。只想先預覽字幕效果，可以跳過這步，直接往下填。
      </p>

      <form
        className="conn-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit) return;
          const next = {
            ...draft,
            owner: draft.owner.trim(),
            repo: draft.repo.trim(),
            branch: draft.branch.trim(),
            token: draft.token.trim(),
          };
          setDraft(next);
          setEditing(false);
          onConnect(next);
        }}
      >
        <div className="conn-grid">
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-owner`}>
              GitHub 帳號
            </label>
            <input className="input" autoComplete="off" spellCheck={false} {...bind('owner')} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-repo`}>
              Repository
            </label>
            <input className="input" autoComplete="off" spellCheck={false} {...bind('repo')} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor={`${uid}-branch`}>
              分支
            </label>
            <input className="input" autoComplete="off" spellCheck={false} {...bind('branch')} />
          </div>
        </div>

        <div className="field field--wide">
          <label className="field__label" htmlFor={`${uid}-token`}>
            Personal access token
          </label>
          <input
            className="input mono"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="github_pat_…"
            {...bind('token')}
          />
          <Toggle checked={draft.remember} onChange={(remember) => setDraft((d) => ({ ...d, remember }))}>
            記住在這個瀏覽器
          </Toggle>
          <p className="field__hint">
            不勾的話，關掉分頁就會清除。共用電腦請不要勾。token 只會送到 api.github.com。
          </p>
        </div>

        <details className="help">
          <summary>
            <KeyRound size={16} aria-hidden="true" />
            怎麼取得 token？
          </summary>
          <ol>
            <li>
              打開 GitHub 的{' '}
              <a href={NEW_TOKEN_URL} target="_blank" rel="noreferrer">
                新增 fine-grained token 頁面
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            </li>
            <li>
              Repository access 選 <strong>Only select repositories</strong>，只勾這個網站的 repo。
            </li>
            <li>
              Permissions → Repository permissions：<strong>Contents</strong> 設 Read and write；
              <strong>Actions</strong> 設 Read-only（選填，用來顯示部署進度）。
            </li>
            <li>建立後複製 token，貼到上面。token 只會顯示一次。</li>
          </ol>
        </details>

        {conn.status === 'error' && (
          <p className="notice notice--error" role="alert">
            {conn.error}
          </p>
        )}

        <div className="btn-row">
          <button type="submit" className="btn" disabled={!canSubmit}>
            {connecting ? '連線中…' : '連線'}
          </button>
          {editing && (
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              取消
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
