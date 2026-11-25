import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { MAX_TAGS, TAG_SEPARATORS, addTags, hasTag, normalizeTag } from '../../lib/tags.js';
import { tagColorProps } from '../../lib/tagColors.js';

const MAX_SUGGESTIONS = 12;

/**
 * 標籤輸入：Enter 或逗號（, ， 、）加入，Backspace 刪最後一個，離開欄位時自動加入打到一半的字。
 * 下方推薦目前已有的標籤，輸入時依文字篩選。
 * 中文輸入法選字時按的 Enter 不會被當成加入標籤。
 */
export default function TagInput({ id, value, onChange, suggestions, describedBy, disabled, colors }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const full = value.length >= MAX_TAGS;

  /*
   * ---------- 拖曳排序 ----------
   * 標籤會換行，所以看指標落在哪個標籤上就移過去；同一行要越過對方的中線才交換，
   * 避免寬度不同的兩個標籤來回跳。移動幾個像素才算拖曳，單純點一下不受影響。
   */
  const listRef = useRef(null);
  const latest = useRef(value);
  latest.current = value;
  const [dragTag, setDragTag] = useState(null);
  const [focusTag, setFocusTag] = useState(null); // 用鍵盤移動後，焦點跟著那個標籤
  const sortable = value.length > 1 && !disabled;

  const moveTag = (tag, to) => {
    const list = latest.current;
    const from = list.indexOf(tag);
    if (from < 0 || to < 0 || to >= list.length || to === from) return;
    const next = [...list];
    next.splice(to, 0, ...next.splice(from, 1));
    latest.current = next;
    onChange(next);
  };

  useEffect(() => {
    if (focusTag === null) return;
    listRef.current?.querySelector(`[data-tag="${CSS.escape(focusTag)}"]`)?.focus();
    setFocusTag(null);
  }, [value, focusTag]);

  const startDrag = (tag) => (event) => {
    if (!sortable || event.button !== 0 || event.target.closest('.tag-chip__remove')) return;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    const onPointerMove = (e) => {
      if (!active) {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
        active = true;
        setDragTag(tag);
      }
      e.preventDefault();
      const chips = [...(listRef.current?.querySelectorAll('[data-tag]') ?? [])];
      const from = chips.findIndex((el) => el.dataset.tag === tag);
      const to = chips.findIndex((el) => {
        const r = el.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      if (from < 0 || to < 0 || to === from) return;
      const fromRect = chips[from].getBoundingClientRect();
      const r = chips[to].getBoundingClientRect();
      const sameRow = Math.abs(r.top + r.height / 2 - (fromRect.top + fromRect.height / 2)) < r.height / 2;
      const mid = r.left + r.width / 2;
      if (sameRow && (to > from ? e.clientX < mid : e.clientX > mid)) return;
      moveTag(tag, to);
    };
    const end = () => {
      if (active) setDragTag(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const commit = (raw) => {
    const next = addTags(value, raw);
    if (next.length !== value.length) onChange(next);
    setText('');
  };

  const query = normalizeTag(text).toLocaleLowerCase();
  const matches = full
    ? []
    : suggestions
        .filter((tag) => !hasTag(value, tag) && (!query || tag.toLocaleLowerCase().includes(query)))
        .slice(0, MAX_SUGGESTIONS);

  return (
    <div className="tag-field">
      <div
        ref={listRef}
        className={`tag-input${dragTag !== null ? ' is-sorting' : ''}`}
        onClick={(event) => {
          // 點標籤本身（例如用鍵盤排序後）不要把焦點搶回輸入框
          if (!event.target.closest('[data-tag]')) inputRef.current?.focus();
        }}
      >
        {value.map((tag, index) => (
          <span
            key={tag}
            className={`tag-chip${sortable ? ' tag-chip--sortable' : ''}${dragTag === tag ? ' is-dragging' : ''}`}
            data-tag={tag}
            tabIndex={sortable ? 0 : undefined}
            aria-label={sortable ? `標籤 ${tag}，第 ${index + 1} 個：拖曳或按左右鍵調整順序` : undefined}
            title={sortable ? '拖曳調整順序' : undefined}
            onPointerDown={startDrag(tag)}
            onKeyDown={(event) => {
              if (!sortable || event.target !== event.currentTarget) return;
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                moveTag(tag, index + (event.key === 'ArrowLeft' ? -1 : 1));
                setFocusTag(tag);
              }
            }}
            {...tagColorProps(tag, colors)}
          >
            #{tag}
            <button
              type="button"
              className="tag-chip__remove"
              aria-label={`移除標籤 ${tag}`}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onChange(value.filter((t) => t !== tag));
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          value={text}
          disabled={disabled || full}
          placeholder={full ? `最多 ${MAX_TAGS} 個` : value.length ? '' : '輸入標籤後按 Enter'}
          autoComplete="off"
          aria-describedby={describedBy}
          onChange={(event) => {
            const next = event.target.value;
            const composing = event.nativeEvent.isComposing;
            if (!composing && TAG_SEPARATORS.test(next)) {
              const parts = next.split(TAG_SEPARATORS);
              const rest = parts.pop();
              const added = addTags(value, parts.join(','));
              if (added.length !== value.length) onChange(added);
              setText(rest);
            } else {
              setText(next);
            }
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              if (text.trim()) commit(text);
            } else if (event.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && commit(text)}
        />
      </div>

      {matches.length > 0 && !disabled && (
        <div className="tag-suggest">
          <p className="field__label">{query ? '符合的標籤' : '已有的標籤'}</p>
          <ul className="tags" aria-label="推薦標籤">
            {matches.map((tag) => (
              <li key={tag}>
                <button
                  type="button"
                  className="tag-chip tag-chip--suggest"
                  // 不讓輸入框失去焦點，避免打到一半的字先被加成標籤
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(tag)}
                  aria-label={`加入標籤 ${tag}`}
                  {...tagColorProps(tag, colors)}
                >
                  <Plus size={13} aria-hidden="true" />
                  {tag}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
