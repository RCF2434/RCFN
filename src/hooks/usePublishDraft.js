import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DRAFT_MAX_AGE_MS,
  chatForDraft,
  chatFromDraft,
  clearPublishDraft,
  loadDraftParts,
  saveDraftPart,
  subtitleForDraft,
} from '../lib/publishDraft.js';

const SAVE_DELAY_MS = 600;
const ERROR = '瀏覽器無法自動儲存草稿（可能是無痕模式或空間不足），關閉分頁前請先發布。';

/**
 * 發布頁整份草稿的自動儲存與還原。
 * - 打開頁面時找草稿，有就直接還原（apply），並顯示還原時間讓使用者可以捨棄
 * - 還原檢查完成前不儲存，避免空白表單蓋掉草稿
 * - 表單（formPart）每次變動都存；字幕、聊天室只在換了檔案時才重寫
 * - 發布成功後呼叫 markPublished：清掉草稿，直到下次修改前都不再存
 * - enabled 為 false（編輯既有影片）時完全不讀也不寫，也不會清掉新增影片的草稿
 * @param {{ enabled?: boolean, formPart: object, sub: object | null, chat: object, hasContent: boolean }} current
 * @param {(draft: { form: object, sub: object | null, chat: object | null }) => void} apply
 */
export function usePublishDraft({ enabled = true, formPart, sub, chat, hasContent }, apply) {
  const [ready, setReady] = useState(false);
  const [restoredAt, setRestoredAt] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState(null);
  const formKey = JSON.stringify(formPart);

  const latest = useRef({});
  latest.current = { formKey, sub, chat };
  const lastSaved = useRef({}); // 已經寫進資料庫的內容，相同就不重寫
  const published = useRef(null); // 剛發布完的內容，沒改過就不存

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // 打開頁面：找草稿（停用時不讀，ready 維持 false，也就不會儲存）
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    loadDraftParts()
      .then(({ form, subtitle, chat: savedChat }) => {
        if (cancelled) return;
        const fresh = form?.savedAt && Date.now() - Date.parse(form.savedAt) < DRAFT_MAX_AGE_MS;
        if (!fresh) {
          if (form) clearPublishDraft().catch(() => {});
          return;
        }
        const restoredSub = subtitle ? { ...subtitle } : null;
        const restoredChat = chatFromDraft(savedChat);
        apply({ form, sub: restoredSub, chat: restoredChat });
        lastSaved.current = { sub: restoredSub, chat: restoredChat };
        setRestoredAt(form.savedAt);
      })
      .catch(() => !cancelled && setError(ERROR))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 變動後自動儲存
  useEffect(() => {
    if (!ready) return undefined;
    const timer = window.setTimeout(async () => {
      const p = published.current;
      if (p && p.formKey === formKey && p.sub === sub && p.chat === chat) return;
      published.current = null;
      try {
        if (!hasContent) {
          if (lastSaved.current.formKey !== undefined || lastSaved.current.sub || lastSaved.current.chat) {
            await clearPublishDraft();
          }
          lastSaved.current = {};
          setSavedAt(null);
          return;
        }
        const now = new Date().toISOString();
        await saveDraftPart('form', { ...JSON.parse(formKey), savedAt: now });
        if (lastSaved.current.sub !== sub) await saveDraftPart('subtitle', subtitleForDraft(sub));
        if (lastSaved.current.chat !== chat) await saveDraftPart('chat', chatForDraft(chat));
        lastSaved.current = { formKey, sub, chat };
        setSavedAt(now);
        setError(null);
      } catch {
        setError(ERROR);
      }
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [ready, formKey, sub, chat, hasContent]);

  /** 發布成功：清掉草稿；目前的內容（已發布）不再存，改了才存 */
  const markPublished = useCallback(() => {
    if (!enabledRef.current) return; // 編輯頁更新成功時，不要動到新增影片的草稿
    published.current = { ...latest.current };
    lastSaved.current = {};
    setSavedAt(null);
    setRestoredAt(null);
    clearPublishDraft().catch(() => {});
  }, []);

  /** 捨棄草稿（表單由呼叫端清空） */
  const discard = useCallback(() => {
    if (!enabledRef.current) return;
    lastSaved.current = {};
    setSavedAt(null);
    setRestoredAt(null);
    clearPublishDraft().catch(() => {});
  }, []);

  return { ready, restoredAt, savedAt, error, markPublished, discard };
}
