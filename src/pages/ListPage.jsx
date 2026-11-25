import { useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { LayoutGrid, List, Plus, Search, SearchX, X } from 'lucide-react';
import { videos } from '../lib/videos.js';
import { collectTags, hasTag, normalizeTag } from '../lib/tags.js';
import { createVideoSearch, normalizeForSearch } from '../lib/search.js';
import { tagColorProps } from '../lib/tagColors.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStoredState } from '../hooks/useStoredState.js';
import VideoCard from '../components/VideoCard.jsx';

/** 網址上的 ?tag=a&tag=b，整理成不重複、對應到現有寫法的標籤 */
function readTags(params, allTags) {
  const out = [];
  for (const raw of params.getAll('tag')) {
    const tag = normalizeTag(raw);
    if (!tag || hasTag(out, tag)) continue;
    out.push(allTags.find((t) => hasTag([t], tag)) ?? tag);
  }
  return out;
}

export default function ListPage() {
  useDocumentTitle(null);
  const [query, setQuery] = useState('');
  const [params, setParams] = useSearchParams();
  // 檢視模式：grid = 卡片（不顯示說明），list = 清單（縮圖在左，標題說明在右）
  const [view, setView] = useStoredState('list-view', 'grid', (v) => v === 'grid' || v === 'list');
  const inputRef = useRef(null);
  const inputId = useId();
  const allTags = useMemo(() => collectTags(videos), []);
  const selected = useMemo(() => readTags(params, allTags), [params, allTags]);
  const keyword = query.trim();
  const search = useMemo(() => createVideoSearch(videos), []);

  // 選了多個標籤時，影片要同時有這些標籤才列出
  // 有搜尋字時依相關程度排序（模糊搜尋），再套用標籤篩選
  const list = useMemo(
    () => (search(keyword) ?? videos).filter((v) => selected.every((t) => hasTag(v.tags, t))),
    [search, keyword, selected],
  );

  // 還沒選的標籤；打字時只列出符合的
  const tagQuery = normalizeForSearch(normalizeTag(query));
  const available = allTags.filter(
    (t) => !hasTag(selected, t) && (!tagQuery || normalizeForSearch(t).includes(tagQuery)),
  );

  const setTags = (tags) => setParams(new URLSearchParams(tags.map((t) => ['tag', t])), { replace: true });
  const addTag = (tag) => {
    if (!hasTag(selected, tag)) setTags([...selected, tag]);
  };
  const removeTag = (tag) => setTags(selected.filter((t) => t !== tag));
  const clearAll = () => {
    setQuery('');
    setTags([]);
    inputRef.current?.focus();
  };

  const emptyMessage = [
    selected.length > 0 && `同時有標籤「${selected.join('」「')}」`,
    keyword && `符合「${query.trim()}」`,
  ]
    .filter(Boolean)
    .join('且');

  return (
    <div className="container">
      <section className="page-head">
        <p className="eyebrow">非官方字幕</p>
        <h1>にじさんじ</h1>
        <div className="field">
          <label htmlFor={inputId} className="field__label">
            搜尋影片
          </label>
          <div className="search search--tags" onClick={() => inputRef.current?.focus()}>
            <Search size={18} aria-hidden="true" />
            {selected.map((tag) => (
              <span key={tag} className="tag-chip" {...tagColorProps(tag)}>
                #{tag}
                <button
                  type="button"
                  className="tag-chip__remove"
                  aria-label={`移除標籤 ${tag}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeTag(tag);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                if (event.key === 'Enter') {
                  // 打的字剛好是現有標籤，就轉成標籤
                  const tag = tagQuery && allTags.find((t) => normalizeForSearch(t) === tagQuery);
                  if (tag) {
                    event.preventDefault();
                    addTag(tag);
                    setQuery('');
                  }
                } else if (event.key === 'Backspace' && !query && selected.length) {
                  removeTag(selected.at(-1));
                }
              }}
              placeholder={selected.length ? '再輸入關鍵字或標籤' : '片名、說明或標籤'}
              autoComplete="off"
            />
            {(selected.length > 0 || query) && (
              <button type="button" className="search__clear" aria-label="清除搜尋與標籤" onClick={clearAll}>
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {available.length > 0 && (
          <div className="tag-bar">
            <p className="field__label">
              {tagQuery ? '符合的標籤' : selected.length ? '再加入標籤（要同時符合）' : '依標籤篩選'}
            </p>
            <ul className="tags" aria-label="可加入的標籤">
              {available.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    className="tag-chip tag-chip--suggest"
                    onClick={() => {
                      addTag(tag);
                      if (tagQuery) setQuery('');
                    }}
                    aria-label={`加入標籤 ${tag}`}
                    {...tagColorProps(tag)}
                  >
                    <Plus size={13} aria-hidden="true" />
                    {tag}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <div className="list-toolbar">
        <p className="muted" aria-live="polite">
          {list.length} 支影片
        </p>
        <div className="view-toggle" role="group" aria-label="檢視模式">
          <button
            type="button"
            className="view-toggle__btn"
            aria-pressed={view === 'grid'}
            onClick={() => setView('grid')}
            title="卡片"
          >
            <LayoutGrid size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="view-toggle__btn"
            aria-pressed={view === 'list'}
            onClick={() => setView('list')}
            title="清單"
          >
            <List size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {list.length > 0 ? (
        <ul className={view === 'list' ? 'video-list' : 'video-grid'} aria-label="影片列表">
          {list.map((video, index) => (
            <VideoCard
              key={video.id}
              video={video}
              index={index}
              layout={view}
              selectedTags={selected}
              onTagClick={addTag}
            />
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          <SearchX size={36} aria-hidden="true" />
          <p>找不到{emptyMessage}的影片。</p>
          <button type="button" className="btn" onClick={clearAll}>
            清除搜尋與標籤
          </button>
        </div>
      )}
    </div>
  );
}
