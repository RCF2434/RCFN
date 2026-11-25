/**
 * 發布頁的 GitHub 連線設定。
 * owner / repo / branch 存 localStorage；token 只有勾「記住」才存 localStorage，否則存 sessionStorage（關分頁就清掉）。
 */
const SETTINGS_KEY = 'ytsubs:github';
const TOKEN_KEY = 'ytsubs:github-token';

function read(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(storage, key, value) {
  try {
    if (value) storage.setItem(key, value);
    else storage.removeItem(key);
  } catch {
    /* 無痕模式或封鎖儲存時，只在這次頁面有效 */
  }
}

/** 部署在 <owner>.github.io/<repo>/ 時自動帶入 owner 與 repo */
function detectRepo() {
  const { hostname, pathname } = window.location;
  const m = hostname.match(/^([^.]+)\.github\.io$/i);
  if (!m) return { owner: '', repo: '' };
  const first = pathname.split('/').filter(Boolean)[0];
  return { owner: m[1], repo: first && !first.endsWith('.html') ? first : `${m[1]}.github.io` };
}

export function loadSettings() {
  let stored = {};
  try {
    stored = JSON.parse(read(localStorage, SETTINGS_KEY) ?? '{}') ?? {};
  } catch {
    stored = {};
  }
  const detected = detectRepo();
  const remembered = read(localStorage, TOKEN_KEY);
  return {
    owner: stored.owner || detected.owner,
    repo: stored.repo || detected.repo,
    branch: stored.branch || 'main',
    token: remembered ?? read(sessionStorage, TOKEN_KEY) ?? '',
    remember: remembered !== null || stored.remember === true,
  };
}

export function saveSettings({ owner, repo, branch, token, remember }) {
  write(localStorage, SETTINGS_KEY, JSON.stringify({ owner, repo, branch, remember }));
  write(localStorage, TOKEN_KEY, remember ? token : '');
  write(sessionStorage, TOKEN_KEY, remember ? '' : token);
}

export function clearToken() {
  write(localStorage, TOKEN_KEY, '');
  write(sessionStorage, TOKEN_KEY, '');
}
