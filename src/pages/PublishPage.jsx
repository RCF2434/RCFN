import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ExternalLink, FileText, Send, Upload } from 'lucide-react';
import { clearDraft, openPreview, shareDraft } from '../lib/previewDraft.js';
import { ID_RE, publicSiteUrl, publishVideo } from '../lib/publish.js';
import { EMBED_BLOCKED, fetchOEmbed, parseYouTubeId } from '../lib/youtube.js';
import { parseSRT, formatTime } from '../lib/srt.js';
import { assToSRT, isASS } from '../lib/ass.js';
import { resolveSpeakerColors, toSpeakerColor } from '../lib/speakers.js';
import {
  ENCODINGS,
  MAX_SUBTITLE_BYTES,
  decodeSubtitle,
  encodingLabel,
  normalizeSubtitle,
} from '../lib/subtitleFile.js';
import { useDeployWatcher } from '../hooks/useDeployWatcher.js';
import { useGitHubConnection } from '../hooks/useGitHubConnection.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import ConnectionPanel from '../components/publish/ConnectionPanel.jsx';
import SpeakerColorPicker from '../components/publish/SpeakerColorPicker.jsx';
import PublishStatus from '../components/publish/PublishStatus.jsx';
import SubtitlePlayer from '../components/SubtitlePlayer.jsx';
import TicketTear from '../components/TicketTear.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import TagInput from '../components/publish/TagInput.jsx';
import ChannelField, { channelProblems, channelRows } from '../components/publish/ChannelField.jsx';
import NotesEditor, { noteRows, notesProblems, rowsToNotes, textRows } from '../components/publish/NotesEditor.jsx';
import { usePublishDraft } from '../hooks/usePublishDraft.js';
import { LISTS, isListKey, videoListKey } from '../lib/lists.js';
import { formatSavedAt } from '../lib/notesDraft.js';
import { numberNotes } from '../lib/notes.js';
import { removeNotesDraft } from '../lib/notesDraft.js';
import ChatField, { NO_CHAT, chatState } from '../components/publish/ChatField.jsx';
import { readChatData } from '../lib/chat.js';
import { collectTags } from '../lib/tags.js';
import { videoChannels, videos as bundledVideos } from '../lib/videos.js';

const EMPTY = [];
// list：所屬列表（見 lib/lists.js），新增影片時必須選擇
const EMPTY_FORM = { url: '', title: '', description: '', id: '', list: '' };
/** 發布分成四頁，填完一頁按下一步 */
const PAGES = ['影片與聊天室', '字幕與說話人', '註釋', '連線與發布'];

/**
 * 發布頁（/publish）只新增影片；editId 有值時是編輯頁（/manage/<id>），載入 repo 裡的那支影片來更新。
 * 兩者共用同一套四步驟表單。刪除影片在管理頁（ManagePage）。
 */
export default function PublishPage({ editId = null }) {
  const editing = Boolean(editId);
  useDocumentTitle(editing ? '編輯影片' : '發布影片');
  const uid = useId();

  /* ---------- GitHub 連線 ---------- */
  const { settings, conn, setConn, connect, disconnect } = useGitHubConnection();

  /* ---------- 表單 ---------- */
  const [target, setTarget] = useState(editId ?? ''); // '' = 新增；否則為要更新的影片 id
  const [form, setForm] = useState(EMPTY_FORM);
  const [idTouched, setIdTouched] = useState(false);
  const [sub, setSub] = useState(null); // { name, source: 'file' | 'repo', buffer?, text?, loading?, error? }
  const [encoding, setEncoding] = useState('auto');
  const [overrides, setOverrides] = useState({});
  const [tags, setTags] = useState(EMPTY);
  const [channels, setChannels] = useState(EMPTY);
  const [notes, setNotes] = useState(EMPTY);
  const [chat, setChat] = useState(NO_CHAT);
  const [keptChat, setKeptChat] = useState(null); // repo 裡已有的聊天室紀錄（給預覽用）
  const previewRef = useRef(null);
  const [job, setJob] = useState(null);
  const [dragging, setDragging] = useState(false);
  const loadSeq = useRef(0);

  const existing = target ? conn.videos?.find((v) => v.id === target) ?? null : null;
  // 編輯頁在連線並找到影片之前，只顯示連線區塊
  const showGate = editing && !existing;
  const mode = existing ? 'update' : 'create';
  const youtubeId = parseYouTubeId(form.url);
  const id = existing ? existing.id : idTouched ? form.id.trim() : (youtubeId ?? '');
  const setField = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  // 用預覽播放器檢查影片能不能嵌入：不允許嵌入、私人或已刪除時 YouTube 會回報錯誤代碼
  const [playerCheck, setPlayerCheck] = useState({ id: null, ready: false, errorCode: null });
  const onPlayerStatus = useCallback((status) => setPlayerCheck({ id: youtubeId, ...status }), [youtubeId]);

  // 影片上傳者的頻道（oEmbed）：影片頁標題上方會顯示
  const [oembed, setOembed] = useState({ id: null, uploader: null });
  useEffect(() => {
    if (!youtubeId) return undefined;
    const controller = new AbortController();
    fetchOEmbed(youtubeId, controller.signal)
      .then(({ uploader }) => setOembed({ id: youtubeId, uploader }))
      .catch((err) => err.name !== 'AbortError' && setOembed({ id: youtubeId, uploader: null }));
    return () => controller.abort();
  }, [youtubeId]);
  const uploader = oembed.id === youtubeId ? oembed.uploader : null;
  const embedCode = playerCheck.id === youtubeId ? playerCheck.errorCode : null;
  const embedProblem =
    embedCode == null
      ? null
      : EMBED_BLOCKED.has(embedCode)
        ? '這支影片不允許在其他網站播放（擁有者關閉了嵌入，或影片有年齡限制），觀眾將無法觀看，請改用其他影片。'
        : embedCode === 100
          ? '找不到這支影片，可能已刪除或設為私人。'
          : embedCode === 2
            ? 'YouTube 不認得這個影片 ID，請確認網址。'
            : null;

  async function chooseTarget(value) {
    const seq = ++loadSeq.current;
    setTarget(value);
    setJob(null);
    setEncoding('auto');
    const entry = value ? conn.videos.find((v) => v.id === value) : null;
    if (!entry) {
      setForm(EMPTY_FORM);
      setIdTouched(false);
      setSub(null);
      setOverrides({});
      setTags(EMPTY);
      setChannels(EMPTY);
      setNotes(EMPTY);
      setChat(NO_CHAT);
      return;
    }
    setForm({
      url: `https://www.youtube.com/watch?v=${entry.youtubeId}`,
      title: entry.title ?? '',
      description: entry.description ?? '',
      id: entry.id,
      // 舊資料沒有 list，網站上一直顯示在預設列表，這裡照實帶入
      list: videoListKey(entry),
    });
    setOverrides(entry.speakers ?? {});
    setTags(Array.isArray(entry.tags) ? entry.tags : EMPTY);
    setChannels(channelRows(videoChannels(entry)));
    setNotes(noteRows(entry.notes));
    setChat(chatState(entry.chat));
    const name = entry.subtitle.split('/').pop();
    setSub({ name, source: 'repo', loading: true });
    try {
      const text = await conn.gh.readText(`public/${entry.subtitle}`, conn.headSha);
      if (seq === loadSeq.current) setSub({ name, source: 'repo', text });
    } catch (err) {
      if (seq === loadSeq.current) setSub({ name, source: 'repo', error: `讀不到 repo 裡的字幕檔：${err.message}` });
    }
  }

  // 編輯頁：連線後載入這支影片（只載入一次；更新後 repo 版本前進也不會蓋掉正在編輯的內容）
  const loadedId = useRef(null);
  useEffect(() => {
    if (!editing || conn.status !== 'ready' || loadedId.current === editId) return;
    if (!conn.videos.some((v) => v.id === editId)) return;
    loadedId.current = editId;
    chooseTarget(editId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, editId, conn.status, conn.videos]);

  async function acceptFile(file) {
    if (!file) return;
    ++loadSeq.current;
    setJob(null);
    if (file.size > MAX_SUBTITLE_BYTES) {
      setSub({ name: file.name, source: 'file', error: '檔案超過 2 MB，不是有效的字幕檔。' });
      return;
    }
    const buffer = await file.arrayBuffer();
    setEncoding('auto');
    setSub({ name: file.name, source: 'file', buffer });
  }

  /* ---------- 解析字幕與配色 ---------- */
  const decoded = useMemo(() => {
    if (sub?.buffer) {
      const result = decodeSubtitle(sub.buffer, encoding);
      if (!isASS(sub.name, result.text)) return result;
      // ASS 檔：轉成 SRT，之後的預覽與發布都用轉好的內容
      const converted = assToSRT(result.text);
      return { ...result, text: converted.text, convertedFrom: 'ASS', warnings: converted.warnings };
    }
    if (typeof sub?.text === 'string') return { text: sub.text, encoding: 'utf-8', garbled: false };
    return null;
  }, [sub, encoding]);
  const parsed = useMemo(() => (decoded ? parseSRT(decoded.text) : null), [decoded]);
  const subWarnings = [...(decoded?.warnings ?? []), ...(parsed?.warnings ?? [])];
  const speakers = parsed?.speakers ?? EMPTY;

  const activeOverrides = useMemo(
    () => Object.fromEntries(Object.entries(overrides).filter(([name]) => speakers.includes(name))),
    [overrides, speakers],
  );
  const colors = useMemo(() => resolveSpeakerColors(speakers, activeOverrides), [speakers, activeOverrides]);
  const speakerConfig = useMemo(
    () =>
      Object.fromEntries(
        speakers.map((name) => {
          const value = activeOverrides[name];
          return [name, toSpeakerColor(value) ? value : colors.get(name).key];
        }),
      ),
    [speakers, activeOverrides, colors],
  );
  const duplicateColors = useMemo(() => {
    const seen = new Map();
    for (const name of speakers) {
      const c = colors.get(name);
      const k = c.key ?? `${c.light}${c.deep}`;
      seen.set(k, [...(seen.get(k) ?? []), name]);
    }
    return [...seen.values()].filter((names) => names.length > 1);
  }, [speakers, colors]);

  const savedNotes = useMemo(() => rowsToNotes(notes), [notes]);
  const previewNotes = useMemo(() => numberNotes(savedNotes), [savedNotes]);

  // 聊天室紀錄：沿用原本的路徑，沒有就用 chats/<id>.json
  const chatPath = chat.path ?? `chats/${id}.json`;
  const chatFiles =
    chat.mode === 'new'
      ? [{ path: `public/${chatPath}`, content: chat.json }]
      : chat.mode === 'remove'
        ? [{ path: `public/${chat.path}`, delete: true }]
        : [];

  // repo 裡已有的聊天室紀錄：讀進來給預覽用
  useEffect(() => {
    if (chat.mode !== 'keep' || !conn.gh || keptChat?.path === chat.path) return undefined;
    let cancelled = false;
    setKeptChat({ path: chat.path, status: 'loading', messages: [], error: null });
    conn.gh
      .readText(`public/${chat.path}`, conn.headSha)
      .then((text) => !cancelled && setKeptChat({ path: chat.path, status: 'ready', error: null, ...readChatData(JSON.parse(text)) }))
      .catch((err) => !cancelled && setKeptChat({ path: chat.path, status: 'error', messages: [], error: err.message }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.mode, chat.path, conn.gh]);

  const newChat = useMemo(
    () => (chat.mode === 'new' ? { status: 'ready', error: null, ...readChatData(chat.data) } : null),
    [chat.mode, chat.data],
  );
  const previewChat = chat.mode === 'new' ? newChat : chat.mode === 'keep' && keptChat?.path === chat.path ? keptChat : undefined;

  /* ---------- 檢查（依頁分組：每頁按下一步前要先解決自己那頁的） ---------- */
  const pageProblems = [[], [], [], []];
  const [videoP, subP, notesP, publishP] = pageProblems;
  if (!youtubeId) videoP.push(form.url.trim() ? '無法從網址辨識出 YouTube 影片' : '填入 YouTube 網址');
  else if (embedProblem) videoP.push('換一支可以嵌入播放的影片');
  if (!isListKey(form.list)) videoP.push('選擇所屬列表');
  if (!form.title.trim()) videoP.push('填入標題');
  if (mode === 'create') {
    if (!id) videoP.push('填入網址代稱');
    else if (!ID_RE.test(id)) videoP.push('網址代稱只能用英文字母、數字、底線（_）和連字號（-）');
    else if (conn.videos?.some((v) => v.id === id)) videoP.push(`網址代稱「${id}」已經被使用，請換一個`);
  }
  videoP.push(...channelProblems(channels));
  if (!sub) subP.push('選擇字幕檔');
  else if (sub.loading) subP.push('字幕檔讀取中');
  else if (sub.error) subP.push('換一個字幕檔');
  else if (parsed && !parsed.cues.length) subP.push('字幕檔裡讀不到任何字幕');
  notesP.push(...notesProblems(notes));
  if (conn.status !== 'ready') publishP.push('連線 GitHub');
  const problems = pageProblems.flatMap((list, page) => list.map((text) => ({ page, text })));

  const busy = job?.phase === 'committing';
  const canPublish = problems.length === 0 && !busy;

  /* ---------- 分頁 ---------- */
  const [page, setPage] = useState(0);
  const [blockedPage, setBlockedPage] = useState(null); // 按了下一步但這頁還沒填好
  const [visited, setVisited] = useState(() => new Set([0])); // 去過的頁才會打勾
  const stepsRef = useRef(null);
  function goTo(next) {
    setPage(next);
    setBlockedPage(null);
    setVisited((v) => (v.has(next) ? v : new Set(v).add(next)));
    // 換頁後回到步驟列，從這頁開頭開始填
    if (stepsRef.current && stepsRef.current.getBoundingClientRect().top < 0) {
      stepsRef.current.scrollIntoView({ block: 'start' });
    }
  }
  function next() {
    if (pageProblems[page].length) setBlockedPage(page);
    else goTo(page + 1);
  }

  /*
   * ---------- 整份草稿自動儲存（不小心關掉分頁可以接著填） ----------
   * 只有新增影片才存草稿；編輯頁每次都從 repo 載入，避免舊草稿蓋掉 repo 上較新的內容
   * （註釋另有每支影片各自的草稿，見 NotesEditor）。
   */
  const readyChannels = channels.filter((r) => r.status === 'ready').map((r) => r.channel);
  const draftNotes = notes
    .filter((r) => r.time.trim() || r.text.trim() || r.url?.trim())
    .map((r) => (r.url?.trim() ? { time: r.time, text: r.text, url: r.url } : { time: r.time, text: r.text }));
  const draft = usePublishDraft(
    {
      enabled: !editing,
      formPart: {
        form,
        idTouched,
        tags,
        channels: readyChannels,
        overrides,
        notes: draftNotes,
        encoding,
        page,
      },
      sub,
      chat,
      hasContent: Boolean(
        form.url.trim() ||
          form.title.trim() ||
          form.description.trim() ||
          tags.length ||
          readyChannels.length ||
          draftNotes.length ||
          sub ||
          chat.mode !== 'none',
      ),
    },
    (saved) => {
      const f = saved.form;
      setForm({ ...EMPTY_FORM, ...f.form });
      setIdTouched(Boolean(f.idTouched));
      setTags(Array.isArray(f.tags) ? f.tags : EMPTY);
      setChannels(channelRows(f.channels));
      setOverrides(f.overrides ?? {});
      setNotes(textRows(f.notes));
      setEncoding(f.encoding ?? 'auto');
      if (saved.sub) setSub(saved.sub);
      if (saved.chat) setChat(saved.chat);
      const restoredPage = Math.min(Math.max(Number(f.page) || 0, 0), PAGES.length - 1);
      setPage(restoredPage);
      setVisited(new Set(Array.from({ length: restoredPage + 1 }, (_, i) => i)));
    },
  );

  // 發布成功（開始部署）就清掉草稿
  const { markPublished } = draft;
  useEffect(() => {
    if (job?.phase === 'deploying') markPublished();
  }, [job?.phase, job?.commitSha, markPublished]);

  const [confirmDiscard, setConfirmDiscard] = useState(false);
  function discardDraft() {
    setConfirmDiscard(false);
    draft.discard();
    chooseTarget('');
    goTo(0);
    setVisited(new Set([0]));
  }

  // 要寫進 videos.json 的這一筆；發布與新分頁預覽共用
  const description = form.description.trim();
  const entry = {
    id,
    youtubeId,
    list: isListKey(form.list) ? form.list : undefined,
    title: form.title.trim(),
    description: description || undefined,
    subtitle: existing?.subtitle ?? `subtitles/${id}.srt`,
    speakers: speakers.length ? speakerConfig : undefined,
    tags: tags.length ? tags : undefined,
    channels: channels.some((r) => r.status === 'ready')
      ? channels.filter((r) => r.status === 'ready').map((r) => r.channel)
      : undefined,
    channel: undefined, // 舊格式，一律改存 channels
    notes: savedNotes.length ? savedNotes : undefined,
    chat: chat.mode === 'keep' ? chat.path : chat.mode === 'new' ? chatPath : undefined,
    // 查不到時（例如網路問題）沿用原本存的
    uploader: uploader ?? (existing?.youtubeId === youtubeId ? existing?.uploader : undefined),
  };

  /* ---------- 新分頁預覽：把草稿交給預覽分頁 ---------- */
  const entryKey = JSON.stringify(entry);
  useEffect(() => {
    if (!youtubeId) {
      clearDraft();
      return;
    }
    shareDraft({
      video: JSON.parse(entryKey),
      subs: parsed
        ? { status: 'ready', error: null, cues: parsed.cues, speakers: parsed.speakers }
        : { status: 'idle', error: null, cues: EMPTY, speakers: EMPTY },
      chat: previewChat,
    });
  }, [youtubeId, entryKey, parsed, previewChat]);
  useEffect(() => clearDraft, []);

  async function publish() {
    if (!canPublish) return;
    setJob({ phase: 'committing', id });
    try {
      const result = await publishVideo(conn.gh, {
        branch: settings.branch,
        entry,
        subtitleText: normalizeSubtitle(decoded.text),
        extraFiles: chatFiles,
        mode,
      });
      setConn((c) => ({ ...c, videos: result.videos, headSha: result.commitSha }));
      removeNotesDraft(youtubeId); // 已經發布，草稿用不到了
      if (chat.mode === 'new') {
        setKeptChat({ path: chatPath, status: 'ready', error: null, ...readChatData(chat.data) });
        setChat({ mode: 'keep', path: chatPath });
      } else if (chat.mode === 'remove') {
        setChat(NO_CHAT);
      }
      // 新增後要再修改，從「編輯這支影片」進編輯頁（發布頁只負責新增）
      setJob({ phase: 'deploying', id, commitSha: result.commitSha, startedAt: Date.now() });
    } catch (err) {
      setJob({ phase: 'failed', id, error: err.message });
    }
  }
  // 發布成功後（部署中或完成）不再列出「發布前還需要」：此時網址代稱已被這支影片使用，列出來只會誤導
  const published = job && job.phase !== 'committing' && job.phase !== 'failed';

  useDeployWatcher(conn.gh, job, setJob);

  // 推薦標籤：連線後用 repo 最新的影片清單，沒連線就用網站目前打包的清單
  const tagSuggestions = useMemo(() => collectTags(conn.videos ?? bundledVideos), [conn.videos]);

  const siteUrl = settings.owner && settings.repo ? publicSiteUrl(settings.owner, settings.repo) : '';
  const duration = parsed?.cues.at(-1)?.end;

  return (
    <div className="container publish-page">
      <Link to={editing ? '/manage' : '/'} className="back-link">
        <ArrowLeft size={18} aria-hidden="true" />
        {editing ? '返回管理影片' : '返回列表'}
      </Link>

      <header className="video-head">
        <p className="eyebrow">Backstage</p>
        <h1>{editing ? '編輯影片' : '發布影片'}</h1>
        <p className="lead">
          {editing
            ? '修改影片資料、字幕或註釋後，於第 4 步按「更新到網站」。資料會寫入本網站的 GitHub repo 並自動重新部署，約 1–2 分鐘後更新上線。'
            : '貼上 YouTube 網址並選擇字幕檔，於預覽中確認效果。發布後資料會寫入本網站的 GitHub repo 並自動重新部署，約 1–2 分鐘後公開上線。已發布的影片請到「管理影片」編輯或刪除。'}
        </p>
      </header>

      {/* 編輯頁：連線並找到影片前，只顯示連線 */}
      {showGate && (
        <div className="publish-gate">
          {conn.status === 'ready' ? (
            <p className="notice notice--error" role="alert">
              repo 裡找不到「{editId}」這支影片，可能已被刪除。<Link to="/manage">返回管理影片</Link>
            </p>
          ) : (
            <ConnectionPanel
              settings={settings}
              conn={conn}
              onConnect={connect}
              onDisconnect={disconnect}
              step={null}
              intro="編輯影片需要讀取本網站的 GitHub repo。"
            />
          )}
        </div>
      )}
      {!showGate && (
      <>

      {draft.restoredAt && (
        <p className="notice notice--preview publish-draft-notice" role="status">
          已還原 {formatSavedAt(draft.restoredAt)} 自動儲存的草稿{form.title.trim() ? `「${form.title.trim()}」` : ''}，可繼續編輯。{' '}
          <button type="button" className="link-btn" onClick={() => setConfirmDiscard(true)} disabled={busy}>
            捨棄草稿，重新開始
          </button>
        </p>
      )}
      <ConfirmDialog
        open={confirmDiscard}
        title="捨棄這份草稿？"
        confirmLabel="捨棄並重新開始"
        cancelLabel="保留草稿"
        danger
        onConfirm={discardDraft}
        onCancel={() => setConfirmDiscard(false)}
      >
        <p>
          目前填寫的影片資料、字幕檔、說話人顏色、註釋與聊天室紀錄都會清空，自動儲存的草稿也會刪除，且無法復原。
        </p>
      </ConfirmDialog>

      <nav ref={stepsRef} className="wizard-steps" aria-label="發布步驟">
        <ol>
          {PAGES.map((label, i) => {
            const done = i !== page && visited.has(i) && pageProblems[i].length === 0;
            return (
              <li key={label}>
                <button
                  type="button"
                  className={`wizard-step${i === page ? ' is-current' : ''}${done ? ' is-done' : ''}`}
                  aria-current={i === page ? 'step' : undefined}
                  onClick={() => goTo(i)}
                >
                  <span className="wizard-step__num" aria-hidden="true">
                    {done ? <Check size={14} /> : i + 1}
                  </span>
                  <span className="wizard-step__label">{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="publish-layout">
        <div className="publish-form">
          {/* ========== 第 1 頁：影片資料＋聊天室 ========== */}
          <div className="wizard-page" hidden={page !== 0}>
          <section className="panel" aria-labelledby={`${uid}-video`}>
            <div>
              <p className="eyebrow">Video</p>
              <h2 id={`${uid}-video`} className="panel__title">
                影片資料
              </h2>
            </div>

            <fieldset className="field choice-group">
              <legend className="field__label">所屬列表</legend>
              <div className="choice-group__options">
                {LISTS.map((l) => (
                  <label key={l.key} className="choice">
                    <input
                      type="radio"
                      name={`${uid}-list`}
                      value={l.key}
                      checked={form.list === l.key}
                      onChange={() => setForm((f) => ({ ...f, list: l.key }))}
                      disabled={busy}
                    />
                    <span className="choice__label" lang={l.key === 'nijisanji' ? 'ja' : 'en'}>
                      {l.label}
                    </span>
                  </label>
                ))}
              </div>
              <p className="field__hint">影片只會出現在所選的列表，搜尋也只在該列表內進行。</p>
            </fieldset>

            <div className="field">
              <label className="field__label" htmlFor={`${uid}-url`}>
                YouTube 網址
              </label>
              <input
                id={`${uid}-url`}
                className="input"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                placeholder="https://www.youtube.com/watch?v=…"
                value={form.url}
                onChange={setField('url')}
                aria-describedby={`${uid}-url-hint`}
              />
              <p
                id={`${uid}-url-hint`}
                className={`field__hint${(form.url.trim() && !youtubeId) || embedProblem ? ' field__hint--error' : ''}`}
                role={embedProblem ? 'alert' : undefined}
              >
                {youtubeId ? (
                  embedProblem ?? (
                    <>
                      影片 ID：<span className="mono">{youtubeId}</span>
                      {uploader && ` · 頻道：${uploader.name}`}
                      {playerCheck.id === youtubeId && playerCheck.ready ? '' : ' · 檢查能否嵌入播放中…'}
                    </>
                  )
                ) : form.url.trim() ? (
                  '辨識不出影片 ID。支援 watch?v=、youtu.be/、shorts/ 等網址。'
                ) : (
                  '貼上網址後，會以右側預覽自動檢查影片是否允許嵌入播放。'
                )}
              </p>
            </div>

            <div className="field">
              <label className="field__label" htmlFor={`${uid}-title`}>
                標題
              </label>
              <input id={`${uid}-title`} className="input" value={form.title} onChange={setField('title')} />
            </div>

            <div className="field">
              <label className="field__label" htmlFor={`${uid}-desc`}>
                說明（選填）
              </label>
              <textarea
                id={`${uid}-desc`}
                className="input"
                rows={3}
                value={form.description}
                onChange={setField('description')}
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor={`${uid}-tags`}>
                標籤（選填）
              </label>
              <TagInput
                id={`${uid}-tags`}
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                colors={conn.tagColors ?? undefined}
                describedBy={`${uid}-tags-hint`}
                disabled={busy}
              />
              <p id={`${uid}-tags-hint`} className="field__hint">
                按 Enter 或逗號加入，最多 10 個，每個最多 20 字。點選下方既有標籤可直接加入，拖曳標籤可調整順序。
                標籤的文字顏色在 <Link to="/tag-colors">標籤顏色</Link> 設定。
              </p>
            </div>

            <div className="field">
              <span className="field__label">頻道（選填）</span>
              <ChannelField value={channels} onChange={setChannels} disabled={busy} />
            </div>

            <div className="field">
              <label className="field__label" htmlFor={`${uid}-id`}>
                網址代稱
              </label>
              {existing ? (
                <p id={`${uid}-id`} className="mono">
                  {existing.id}
                </p>
              ) : (
                <input
                  id={`${uid}-id`}
                  className="input mono"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="例如 my-video"
                  value={id}
                  onChange={(event) => {
                    setIdTouched(true);
                    setForm((f) => ({ ...f, id: event.target.value }));
                  }}
                  aria-describedby={`${uid}-id-hint`}
                />
              )}
              <p id={`${uid}-id-hint`} className="field__hint">
                影片頁網址會是 <span className="mono">…/#/video/{id || '代稱'}</span>
                {existing ? '，更新時不能改。' : '。預設為影片 ID，可改為容易辨識的英文。'}
              </p>
            </div>
          </section>

          {/* ---------- 聊天室重播 ---------- */}
          <section className="panel" aria-labelledby={`${uid}-chat`}>
            <div>
              <p className="eyebrow">Chat replay</p>
              <h2 id={`${uid}-chat`} className="panel__title">
                聊天室重播（選填）
              </h2>
            </div>
            <p className="panel__text muted">直播錄檔可以附上聊天紀錄，影片頁會在播放器右邊依時間重播聊天室。</p>
            <ChatField value={chat} onChange={setChat} youtubeId={youtubeId} disabled={busy} />
          </section>
          </div>

          {/* ========== 第 2 頁：字幕檔＋說話人顏色 ========== */}
          <div className="wizard-page" hidden={page !== 1}>
          <section className="panel" aria-labelledby={`${uid}-sub`}>
            <div>
              <p className="eyebrow">Subtitles</p>
              <h2 id={`${uid}-sub`} className="panel__title">
                字幕檔
              </h2>
            </div>

            <label
              className={`dropzone${dragging ? ' is-dragging' : ''}`}
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDrop={() => setDragging(false)}
            >
              <input
                type="file"
                accept=".srt,.ass,.ssa,.txt"
                disabled={busy}
                onChange={(event) => {
                  acceptFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <Upload size={24} aria-hidden="true" />
              <strong>{sub ? '換一個字幕檔' : '選擇 .srt 或 .ass 檔'}</strong>
              <span>或將檔案拖曳至此；.ass 會自動轉為 .srt，Name 欄位作為說話人</span>
            </label>

            {sub && (
              <div className="sub-file">
                <p className="sub-file__name">
                  <FileText size={16} aria-hidden="true" />
                  <span className="mono">{sub.name}</span>
                  {sub.source === 'repo' && <span className="muted">（目前 repo 裡的檔案）</span>}
                  {decoded?.convertedFrom && (
                    <span className="muted">（已從 {decoded.convertedFrom} 轉成 SRT，發布時存成 .srt）</span>
                  )}
                </p>

                {sub.loading && <p className="muted">讀取中…</p>}
                {sub.error && (
                  <p className="notice notice--error" role="alert">
                    {sub.error}
                  </p>
                )}

                {sub.buffer && (
                  <div className="field">
                    <label className="field__label" htmlFor={`${uid}-enc`}>
                      檔案編碼
                    </label>
                    <div className="select">
                      <select
                        id={`${uid}-enc`}
                        className="input"
                        value={encoding}
                        onChange={(event) => setEncoding(event.target.value)}
                      >
                        {ENCODINGS.map((e) => (
                          <option key={e.key} value={e.key}>
                            {e.key === 'auto' ? `自動判斷（${encodingLabel(decoded?.encoding)}）` : e.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={18} aria-hidden="true" />
                    </div>
                    <p className={`field__hint${decoded?.garbled ? ' field__hint--error' : ''}`}>
                      {decoded?.garbled
                        ? '疑似有亂碼，請改用其他編碼。'
                        : '發布時會轉存為 UTF-8。預覽出現亂碼時，請改用其他編碼。'}
                    </p>
                  </div>
                )}

                {parsed && (
                  <dl className="meta">
                    <div>
                      <dt>句數</dt>
                      <dd className="mono">{parsed.cues.length}</dd>
                    </div>
                    <div>
                      <dt>字幕長度</dt>
                      <dd className="mono">{formatTime(duration)}</dd>
                    </div>
                    <div>
                      <dt>說話人</dt>
                      <dd className="mono">{speakers.length}</dd>
                    </div>
                  </dl>
                )}

                {subWarnings.length > 0 && (
                  <details className="notice notice--warning">
                    <summary>有 {subWarnings.length} 個格式問題（不影響發布，有問題的段落會略過）</summary>
                    <ul>
                      {subWarnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </section>

          {/* ---------- 說話人顏色 ---------- */}
          <section className="panel" aria-labelledby={`${uid}-cast`}>
            <div>
              <p className="eyebrow">Cast</p>
              <h2 id={`${uid}-cast`} className="panel__title">
                說話人顏色
              </h2>
            </div>
            {!parsed ? (
              <p className="muted">選擇字幕檔後，此處會列出字幕中的說話人。</p>
            ) : speakers.length === 0 ? (
              <p className="muted">
                字幕中沒有說話人標記，所有字幕會以中性色顯示。如需分色，請在字幕行開頭加上{' '}
                <code className="mono">{'<v 名字>'}</code>。
              </p>
            ) : (
              <>
                <div className="speaker-pickers">
                  {speakers.map((name) => (
                    <SpeakerColorPicker
                      key={name}
                      name={name}
                      value={speakerConfig[name]}
                      custom={
                        existing?.speakers?.[name] && typeof existing.speakers[name] === 'object'
                          ? toSpeakerColor(existing.speakers[name])
                          : null
                      }
                      onChange={(value) => setOverrides((o) => ({ ...o, [name]: value }))}
                    />
                  ))}
                </div>
                {duplicateColors.length > 0 && (
                  <p className="field__hint">
                    {duplicateColors.map((names) => names.join('、')).join('；')} 使用相同顏色，觀看時不易區分。
                  </p>
                )}
              </>
            )}
          </section>
          </div>

          {/* ========== 第 3 頁：註釋 ========== */}
          <div className="wizard-page" hidden={page !== 2}>
          <section className="panel" aria-labelledby={`${uid}-notes`}>
            <div>
              <p className="eyebrow">Notes</p>
              <h2 id={`${uid}-notes`} className="panel__title">
                註釋（選填）
              </h2>
            </div>
            <NotesEditor
              value={notes}
              onChange={setNotes}
              cues={parsed?.cues ?? EMPTY}
              getCurrentTime={youtubeId ? () => previewRef.current?.getCurrentTime() : null}
              onPreview={(time) => previewRef.current?.seekTo(time)}
              disabled={busy}
              video={{ id, youtubeId, title: form.title.trim() }}
            />
          </section>
          </div>

          {/* ========== 第 4 頁：連線 GitHub＋發布 ========== */}
          <div className="wizard-page" hidden={page !== 3}>
          <ConnectionPanel
            settings={settings}
            conn={conn}
            onConnect={connect}
            onDisconnect={disconnect}
            step={null}
            intro="發布時需要寫入本網站的 GitHub repo。僅預覽字幕效果時不需連線。"
          />

          <section className="panel panel--ticket publish-submit" aria-labelledby={`${uid}-publish`}>
            <p className="eyebrow">Admit One</p>
            <h2 id={`${uid}-publish`} className="panel__title">
              {mode === 'create' ? '發布' : '更新'}
            </h2>

            {published ? null : problems.length > 0 ? (
              <div>
                <p className="field__label">{editing ? '更新前還需要：' : '發布前還需要：'}</p>
                <ul className="checklist">
                  {problems.map((p) => (
                    <li key={p.text}>
                      {p.text}
                      {p.page !== 3 && (
                        <>
                          {' '}
                          <button type="button" className="link-btn" onClick={() => goTo(p.page)}>
                            回到第 {p.page + 1} 步
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="muted">
                {mode === 'create'
                  ? `會在 ${settings.owner}/${settings.repo} 新增「${form.title.trim()}」與字幕檔 subtitles/${id}.srt。`
                  : `會更新「${existing.title}」的資料與字幕檔。`}
              </p>
            )}

            <button type="button" className="btn" onClick={publish} disabled={!canPublish}>
              <Send size={16} aria-hidden="true" />
              {busy ? '發布中…' : mode === 'create' ? '發布到網站' : '更新到網站'}
            </button>

            {job && (
              <>
                <TicketTear />
                <PublishStatus job={job} repoUrl={conn.gh?.repoUrl ?? ''} siteUrl={siteUrl} />
                {published && (
                  <div className="btn-row">
                    {editing ? (
                      <Link to="/manage" className="btn btn--ghost">
                        返回管理影片
                      </Link>
                    ) : (
                      <>
                        <Link to={`/manage/${encodeURIComponent(job.id)}`} className="btn btn--ghost">
                          編輯這支影片
                        </Link>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => {
                            chooseTarget('');
                            goTo(0);
                          }}
                        >
                          再發布一支
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
          </div>

          {/* ---------- 上一步／下一步 ---------- */}
          {blockedPage === page && pageProblems[page].length > 0 && (
            <div className="notice notice--warning" role="alert">
              <p className="field__label">這一步還需要：</p>
              <ul>
                {pageProblems[page].map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="wizard-nav">
            {page > 0 && (
              <button type="button" className="btn btn--ghost" onClick={() => goTo(page - 1)}>
                <ArrowLeft size={16} aria-hidden="true" />
                上一步
              </button>
            )}
            {page < PAGES.length - 1 && (
              <button type="button" className="btn wizard-nav__next" onClick={next}>
                下一步：{PAGES[page + 1]}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          {(draft.error || draft.savedAt) && (
            <p className={`field__hint publish-draft-status${draft.error ? ' field__hint--error' : ''}`} role="status">
              {draft.error ?? `已自動儲存草稿（${formatSavedAt(draft.savedAt)}），關閉分頁後重新開啟可繼續編輯。`}
            </p>
          )}
        </div>

        {/* ---------- 預覽 ---------- */}
        <section className="publish-preview" aria-labelledby={`${uid}-preview`}>
          <h2 id={`${uid}-preview`} className="publish-preview__title">
            預覽
          </h2>
          {youtubeId ? (
            <SubtitlePlayer
              ref={previewRef}
              youtubeId={youtubeId}
              cues={parsed?.cues ?? EMPTY}
              colors={colors}
              notes={previewNotes}
              chat={previewChat}
              onStatus={onPlayerStatus}
            />
          ) : (
            <div className="preview-empty">
              <p>填入 YouTube 網址後，影片和字幕會出現在這裡。</p>
            </div>
          )}
          {youtubeId && !parsed && <p className="field__hint">選擇字幕檔後，字幕會疊在影片上。</p>}
          <div className="publish-preview__actions">
            <button type="button" className="btn btn--ghost" onClick={openPreview} disabled={!youtubeId}>
              <ExternalLink size={16} aria-hidden="true" />
              在新分頁預覽影片頁
            </button>
            <p className="field__hint">
              以正式影片頁的版面預覽，僅限本機檢視。預覽期間請保持此頁開啟，修改內容會自動同步。
            </p>
          </div>
        </section>
      </div>
      </>
      )}
    </div>
  );
}
