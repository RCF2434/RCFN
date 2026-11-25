import { useEffect } from 'react';

const FIRST_CHECK_MS = 4000;
const INTERVAL_MS = 8000;
const NO_RUN_TIMEOUT_MS = 3 * 60 * 1000;
const GIVE_UP_MS = 20 * 60 * 1000;

/**
 * 發布後追蹤 GitHub Actions 的部署進度。
 * job.phase 為 'deploying' 時開始輪詢，結束時把 phase 改成 done / failed / unknown。
 */
export function useDeployWatcher(gh, job, setJob) {
  const phase = job?.phase;
  const sha = job?.commitSha;
  const startedAt = job?.startedAt;

  useEffect(() => {
    if (phase !== 'deploying' || !gh || !sha) return undefined;
    const controller = new AbortController();
    let timer = 0;
    const finish = (patch) => setJob((current) => (current?.commitSha === sha ? { ...current, ...patch } : current));

    const tick = async () => {
      const elapsed = Date.now() - startedAt;
      try {
        const run = await gh.findDeployRun(sha, controller.signal);
        if (run?.status === 'completed') {
          finish(
            run.conclusion === 'success'
              ? { phase: 'done', run }
              : { phase: 'failed', run, error: `部署沒有成功（${run.conclusion}）。到 GitHub Actions 可以看到失敗原因。` },
          );
          return;
        }
        if (run) finish({ run });
        if (!run && elapsed > NO_RUN_TIMEOUT_MS) {
          finish({ phase: 'unknown', note: '等了三分鐘還沒看到部署紀錄。請確認 repo 的 Settings → Pages 來源是 GitHub Actions。' });
          return;
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (err.status === 401 || err.status === 403 || err.status === 404) {
          finish({ phase: 'unknown', note: 'Token 沒有讀取 Actions 的權限，這裡看不到部署進度；通常 1–2 分鐘後就會上線。' });
          return;
        }
        // 網路暫時不穩，下一輪再試
      }
      if (elapsed > GIVE_UP_MS) {
        finish({ phase: 'unknown', note: '部署比平常久，請到 GitHub Actions 查看。' });
        return;
      }
      timer = window.setTimeout(tick, INTERVAL_MS);
    };

    timer = window.setTimeout(tick, FIRST_CHECK_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [gh, phase, sha, startedAt, setJob]);
}
