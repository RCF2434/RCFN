import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/**
 * 內容過長時先收合成 lines 行，最後一行淡出，按「顯示更多」展開。
 * - 依內文實際的行高換算高度，桌機與手機（字級不同）都是 lines 行
 * - 內容比 lines 多兩行以上才收合（只多一行時收起來再加按鈕並沒有省到空間）
 * - 收起來的部分如果被鍵盤聚焦、或網址錨點（#note-3）指到裡面，就自動展開
 * - 收回時，如果區塊開頭已捲到頁首導覽列底下，捲回區塊開頭
 */
/** 內文一行的高度：取第一段文字所在元素的行高（字級可能由內層元素設定，例如手機版的說明） */
function lineHeightOf(inner) {
  let el = inner;
  while (el.firstElementChild) el = el.firstElementChild;
  const style = getComputedStyle(el);
  return parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.6;
}

export default function Collapsible({ lines = 3, children, className = '' }) {
  const id = useId();
  const rootRef = useRef(null);
  const innerRef = useRef(null);
  const [metrics, setMetrics] = useState({ overflowing: false, height: 0 });
  const [open, setOpen] = useState(false);

  // 量行高與內容高度；字型載入、視窗寬度改變時會變，用 ResizeObserver 重新判斷
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return undefined;
    const check = () => {
      const lineHeight = lineHeightOf(inner);
      const height = Math.round(lineHeight * lines);
      const overflowing = inner.scrollHeight > height + lineHeight + 1;
      setMetrics((m) => (m.height === height && m.overflowing === overflowing ? m : { height, overflowing }));
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [lines]);
  const { overflowing, height } = metrics;

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
        // 淡出從最後一行開始
        style={collapsed ? { maxHeight: height, '--fade-start': `${((lines - 1) / lines) * 100}%` } : undefined}
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
