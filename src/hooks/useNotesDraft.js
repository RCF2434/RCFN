import { useCallback, useEffect, useRef, useState } from 'react';
import { loadNotesDraft, removeNotesDraft, sameAsDraft, saveNotesDraft } from '../lib/notesDraft.js';

const SAVE_DELAY_MS = 800;
const IDLE = { offer: null, restoredAt: null, savedAt: null, error: null };

/**
 * 註釋草稿自動儲存與還原。
 * - 換影片時找草稿：目前沒有註釋就直接還原；已經有（例如從 repo 讀進來的）就 offer 讓使用者選
 * - 只有使用者自己編輯過（markEdited）才儲存，載入 repo 資料不會覆蓋草稿
 * - 還在詢問要不要還原時不儲存，避免草稿被蓋掉
 * toRows：草稿的 [{ time, text }] → 編輯列（帶 key）
 */
export function useNotesDraft(youtubeId, rows, setRows, toRows) {
  const [state, setState] = useState(IDLE);
  const edited = useRef(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // 換影片：找這支影片的草稿
  useEffect(() => {
    edited.current = false;
    if (!youtubeId) {
      setState(IDLE);
      return;
    }
    const draft = loadNotesDraft(youtubeId);
    const current = rowsRef.current;
    if (!draft || sameAsDraft(draft.notes, current)) {
      setState(IDLE);
    } else if (!current.some((row) => row.time.trim() || row.text.trim())) {
      setRows(toRows(draft.notes));
      setState({ ...IDLE, restoredAt: draft.savedAt });
    } else {
      setState({ ...IDLE, offer: draft });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [youtubeId]);

  // 使用者編輯後自動儲存
  useEffect(() => {
    if (!youtubeId || !edited.current || state.offer) return undefined;
    const timer = window.setTimeout(() => {
      try {
        const savedAt = saveNotesDraft(youtubeId, rows);
        setState((s) => ({ ...s, savedAt, error: null }));
      } catch {
        setState((s) => ({ ...s, error: '瀏覽器無法儲存草稿（可能是無痕模式或空間不足），請改用匯出。' }));
      }
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [youtubeId, rows, state.offer]);

  const markEdited = useCallback(() => {
    edited.current = true;
  }, []);

  /** 還原詢問中的草稿 */
  const restore = () => {
    if (!state.offer) return;
    setRows(toRows(state.offer.notes));
    setState({ ...IDLE, restoredAt: state.offer.savedAt });
  };

  /** 捨棄草稿；如果是自動還原的，一併清空編輯中的註釋 */
  const discard = () => {
    removeNotesDraft(youtubeId);
    if (state.restoredAt) setRows([]);
    edited.current = false;
    setState(IDLE);
  };

  return { ...state, markEdited, restore, discard };
}
