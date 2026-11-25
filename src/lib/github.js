/**
 * 最小的 GitHub REST API 用戶端，只用在發布頁。
 * api.github.com 支援 CORS，靜態網站可以直接呼叫；token 只會送到 api.github.com。
 */
const API = 'https://api.github.com';
export const VIDEOS_PATH = 'src/data/videos.json';
export const TAGS_PATH = 'src/data/tags.json';
export const WORKFLOW_PATH = '.github/workflows/deploy.yml';
const LARGE_FILE_CHARS = 512 * 1024;

export class GitHubError extends Error {
  constructor(message, status = 0, { stale = false } = {}) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.stale = stale; // 分支在讀取後被別人更新，重試即可
  }
}

function describe(status, detail) {
  if (status === 401) return 'Token 無效或已過期，請重新產生一組。';
  if (status === 403 && /rate limit/i.test(detail)) return 'GitHub API 次數已達上限，請稍後再試。';
  if (status === 403) return 'Token 權限不足：需要這個 repo 的 Contents「Read and write」權限。';
  if (status === 404) return '找不到 repo、分支或檔案；也可能是 token 沒有這個 repo 的存取權。';
  if (status === 409) return 'repo 沒有任何內容，請先將專案推送至 GitHub。';
  return `GitHub 回應錯誤（HTTP ${status}）${detail ? `：${detail}` : ''}`;
}

const encodePath = (path) => path.split('/').map(encodeURIComponent).join('/');

export function createGitHub({ owner, repo, token }) {
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  async function request(path, { method = 'GET', body, raw = false, signal } = {}) {
    const headers = {
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
    };
    if (body) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetch(base + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal,
        cache: 'no-store',
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new GitHubError('連不上 GitHub，請檢查網路連線。');
    }
    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.json()).message ?? '';
      } catch {
        /* 不是 JSON */
      }
      const stale = response.status === 422 && /fast.?forward/i.test(detail);
      throw new GitHubError(describe(response.status, detail), response.status, { stale });
    }
    return raw ? response.text() : response.json();
  }

  async function getHead(branch) {
    const ref = await request(`/git/ref/heads/${encodePath(branch)}`);
    const commit = await request(`/git/commits/${ref.object.sha}`);
    return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
  }

  function readText(path, ref) {
    return request(`/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`, { raw: true });
  }

  /** 檔案是否存在：列出所在資料夾來判斷，不必下載檔案本身（聊天室紀錄可能很大） */
  async function pathExists(path, ref) {
    const slash = path.lastIndexOf('/');
    const dir = slash === -1 ? '' : path.slice(0, slash);
    const name = path.slice(slash + 1);
    try {
      const list = await request(`/contents/${encodePath(dir)}?ref=${encodeURIComponent(ref)}`);
      return Array.isArray(list) && list.some((item) => item.type === 'file' && item.name === name);
    } catch (err) {
      if (err.status === 404) return false;
      throw err;
    }
  }

  async function readVideos(ref) {
    let text;
    try {
      text = await readText(VIDEOS_PATH, ref);
    } catch (err) {
      if (err.status === 404) {
        throw new GitHubError(`這個分支裡找不到 ${VIDEOS_PATH}，請確認 repo 與分支是這個網站的專案。`, 404);
      }
      throw err;
    }
    let videos;
    try {
      videos = JSON.parse(text);
    } catch {
      throw new GitHubError(`${VIDEOS_PATH} 不是有效的 JSON，請先在 GitHub 上修正。`);
    }
    if (!Array.isArray(videos)) throw new GitHubError(`${VIDEOS_PATH} 的格式應該是陣列。`);
    return videos;
  }

  /** 標籤顏色設定；舊版專案沒有這個檔案時當成空的 */
  async function readTagColors(ref) {
    let text;
    try {
      text = await readText(TAGS_PATH, ref);
    } catch (err) {
      if (err.status === 404) return {};
      throw err;
    }
    try {
      const data = JSON.parse(text);
      return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
      throw new GitHubError(`${TAGS_PATH} 不是有效的 JSON，請先在 GitHub 上修正。`);
    }
  }

  /**
   * 把多個文字檔寫進同一個 commit，部署只會觸發一次。
   * files：[{ path, content }]，或 { path, delete: true } 刪除檔案。
   * 大檔案（例如聊天室紀錄）先用 blob API 上傳，避免 tree 請求太大。
   */
  async function commitFiles({ branch, head, files, message }) {
    const entries = [];
    for (const file of files) {
      if (file.delete) {
        entries.push({ path: file.path, mode: '100644', type: 'blob', sha: null });
      } else if (file.content.length > LARGE_FILE_CHARS) {
        const blob = await request('/git/blobs', { method: 'POST', body: { content: file.content, encoding: 'utf-8' } });
        entries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
      } else {
        entries.push({ path: file.path, mode: '100644', type: 'blob', content: file.content });
      }
    }
    const tree = await request('/git/trees', {
      method: 'POST',
      body: { base_tree: head.treeSha, tree: entries },
    });
    const commit = await request('/git/commits', {
      method: 'POST',
      body: { message, tree: tree.sha, parents: [head.commitSha] },
    });
    await request(`/git/refs/heads/${encodePath(branch)}`, {
      method: 'PATCH',
      body: { sha: commit.sha, force: false },
    });
    return commit.sha;
  }

  /** 找這個 commit 觸發的部署 workflow；需要 token 有 Actions 讀取權限 */
  async function findDeployRun(sha, signal) {
    const data = await request(`/actions/runs?head_sha=${sha}&per_page=10`, { signal });
    const runs = data.workflow_runs ?? [];
    return runs.find((run) => run.path?.startsWith(WORKFLOW_PATH)) ?? runs[0] ?? null;
  }

  return {
    owner,
    repo,
    repoUrl: `https://github.com/${owner}/${repo}`,
    getHead,
    readText,
    pathExists,
    readVideos,
    readTagColors,
    commitFiles,
    findDeployRun,
  };
}
