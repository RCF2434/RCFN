import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/**
 * 內容過長時先收合，下方淡出，按「顯示更多」展開。
 * - 內容超過 collapsedHeight（px）一段距離才收合，短的內容不出現按鈕
 * - 收起來的部分如果被鍵盤聚焦、或網址錨點（#note-3）指到裡面，就自動展開
 * - 收回時，如果區塊開頭已捲到頁首導覽列底下，捲回區塊開頭
 */
const MIN_HIDDEN = 40; // 至少要藏掉這麼多才值得收合，避免只為了半行出現按鈕

export default function Collapsible({ collapsedHeight, children, className = '' }) {
  const id = useId();
  const rootRef = useRef(null);
  const innerRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  const [open, setOpen] = useState(false);

  // 量內容高度；字型載入、視窗寬度改變時內容高度會變，用 ResizeObserver 重新判斷
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return undefined;
    const check = () => setOverflowing(inner.scrollHeight > collapsedHeight + MIN_HIDDEN);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [collapsedHeight]);

  // 網址錨點指到收起來的內容：展開
  useEffect(() => {
    const target = window.location.hash.slice(1);
    if (target && innerRef.current?.querySelector(`[id="${CSS.escape(decodeURIComponent(target))}"]`)) setOpen(true);
  }, []);

  const collapsed = overflowing && !open;

  const toggle = () => {
    if (open) {
      // 收回時，區塊（含小標）的開頭若在頁首導覽列底下或畫面外，捲回來停在導覽列下方
      const target = rootRef.current?.closest('section') ?? rootRef.current;
      const headerBottom = document.querySelector('.site-nav')?.getBoundingClientRect().bottom ?? 0;
      const top = target?.getBoundingClientRect().top ?? 0;
      if (top < headerBottom) window.scrollBy(0, top - headerBottom - 16);
    }
    setOpen(!open);
  };

  return (
    <div ref={rootRef} className={`collapsible${collapsed ? ' is-collapsed' : ''} ${className}`.trim()}>
      <div
        id={id}
        className="collapsible__content"
        style={collapsed ? { maxHeight: collapsedHeight } : undefined}
        // 用 Tab 移到收起來的連結時，展開讓它看得到
        onFocus={() => collapsed && setOpen(true)}
      >
        <div ref={innerRef}>{children}</div>
      </div>
      {overflowing && (
        <button type="button" className="link-btn collapsible__toggle" aria-expanded={open} aria-controls={id} onClick={toggle}>
          {open ? '顯示較少' : '顯示更多'}
        </button>
      )}
    </div>
  );
}
