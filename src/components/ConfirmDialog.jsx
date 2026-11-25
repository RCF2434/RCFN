import { useEffect, useId, useRef } from 'react';

/**
 * 二次確認的對話框（原生 <dialog>）：瀏覽器負責背景遮罩、Esc 關閉、焦點留在對話框內。
 * 打開時焦點放在「取消」，避免按一下 Enter 就做了不可復原的事。
 * @param {{
 *   open: boolean,
 *   title: string,
 *   children?: import('react').ReactNode,  // 說明文字
 *   confirmLabel: string,
 *   cancelLabel?: string,
 *   danger?: boolean,                       // 確認鈕用警示色
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = '取消', danger, onConfirm, onCancel }) {
  const ref = useRef(null);
  const cancelRef = useRef(null);
  const uid = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby={`${uid}-title`}
      aria-describedby={children ? `${uid}-desc` : undefined}
      // Esc：瀏覽器會關掉對話框，這裡同步狀態
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      // 點遮罩（對話框本體以外）也算取消
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="confirm-dialog__body">
        <h2 id={`${uid}-title`} className="confirm-dialog__title">
          {title}
        </h2>
        {children && (
          <div id={`${uid}-desc`} className="confirm-dialog__text">
            {children}
          </div>
        )}
        <div className="confirm-dialog__actions">
          <button ref={cancelRef} type="button" className="btn btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`btn${danger ? ' btn--danger' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
