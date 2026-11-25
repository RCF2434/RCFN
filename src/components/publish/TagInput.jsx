import { useRef, useState } from 'react';
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
      <div className="tag-input" onClick={() => inputRef.current?.focus()}>
        {value.map((tag) => (
          <span key={tag} className="tag-chip" {...tagColorProps(tag, colors)}>
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
