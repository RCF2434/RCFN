import { useId, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { getList, videoListKey } from '../lib/lists.js';
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

/** listKey：顯示哪一個列表（見 lib/lists.js）；搜尋與標籤只在這個列表內 */
export default function ListPage({ listKey }) {
  const current = getList(listKey);
  useDocumentTitle(current.label);
  const [query, setQuery] = useState('');
  const [params, setParams] = useSearchParams();
  // 檢視模式：grid = 卡片（不顯示說明），list = 清單（縮圖在左，標題說明在右）
  const [view, setView] = useStoredState('list-view', 'grid', (v) => v === 'grid' || v === 'list');
  const inputRef = useRef(null);
  const inputId = useId();
  const listVideos = useMemo(() => videos.filter((v) => videoListKey(v) === current.key), [current.key]);
  const allTags = useMemo(() => collectTags(listVideos), [listVideos]);
  const selected = useMemo(() => readTags(params, allTags), [params, allTags]);
  const keyword = query.trim();
  const search = useMemo(() => createVideoSearch(listVideos), [listVideos]);

  // 選了多個標籤時，影片要同時有這些標籤才列出
  // 有搜尋字時依相關程度排序（模糊搜尋），再套用標籤篩選
  const list = useMemo(
    () => (search(keyword) ?? listVideos).filter((v) => selected.every((t) => hasTag(v.tags, t))),
    [search, keyword, selected, listVideos],
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
    <>
    <div className="container">
      <section className="page-head">
        <div className="field">
          <label htmlFor={inputId} className="field__label">
            搜尋 {current.label} 的影片
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
              placeholder={'輸入關鍵字...'}
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
            <p className="field__label">依標籤篩選</p>
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
      </div>

      {/* 影片區另起一個容器：卡片格式放寬到 95%，上方的搜尋、標籤、工具列維持原本寬度 */}
      <div className={`container${view === 'grid' ? ' container--cards' : ''}`}>
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
      ) : listVideos.length === 0 ? (
        <div className="empty-state">
          <p>{current.label} 目前沒有影片。</p>
        </div>
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
    </>
  );
}
