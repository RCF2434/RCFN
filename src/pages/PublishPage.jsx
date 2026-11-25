import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ChevronDown, ExternalLink, FileText, Send, Upload } from 'lucide-react';
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
import TagInput from '../components/publish/TagInput.jsx';
import ChannelField, { channelProblems, channelRows } from '../components/publish/ChannelField.jsx';
import NotesEditor, { noteRows, notesProblems, rowsToNotes } from '../components/publish/NotesEditor.jsx';
import { numberNotes } from '../lib/notes.js';
import { removeNotesDraft } from '../lib/notesDraft.js';
import ChatField, { NO_CHAT, chatState } from '../components/publish/ChatField.jsx';
import { readChatData } from '../lib/chat.js';
import { collectTags } from '../lib/tags.js';
import { videoChannels, videos as bundledVideos } from '../lib/videos.js';

const EMPTY = [];
const EMPTY_FORM = { url: '', title: '', description: '', id: '' };

export default function PublishPage() {
  useDocumentTitle('發布影片');
  const uid = useId();

  /* ---------- GitHub 連線 ---------- */
  const { settings, conn, setConn, connect, disconnect: disconnectGitHub } = useGitHubConnection();
  const disconnect = () => {
    disconnectGitHub();
    setTarget('');
  };

  /* ---------- 表單 ---------- */
  const [target, setTarget] = useState(''); // '' = 新增；否則為要更新的影片 id
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
        ? '這支影片不允許在其他網站播放（擁有者關閉了嵌入，或影片有年齡限制），觀眾會看不到，請換一支。'
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

  async function acceptFile(file) {
    if (!file) return;
    ++loadSeq.current;
    setJob(null);
    if (file.size > MAX_SUBTITLE_BYTES) {
      setSub({ name: file.name, source: 'file', error: '檔案超過 2 MB，看起來不是字幕檔。' });
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

  /* ---------- 檢查 ---------- */
  const problems = [];
  if (!youtubeId) problems.push(form.url.trim() ? '無法從網址辨識出 YouTube 影片' : '填入 YouTube 網址');
  else if (embedProblem) problems.push('換一支可以嵌入播放的影片');
  if (!form.title.trim()) problems.push('填入標題');
  if (mode === 'create') {
    if (!id) problems.push('填入網址代稱');
    else if (!ID_RE.test(id)) problems.push('網址代稱只能用英文字母、數字、底線（_）和連字號（-）');
    else if (conn.videos?.some((v) => v.id === id)) problems.push(`網址代稱「${id}」已經被使用，請換一個`);
  }
  if (!sub) problems.push('選擇字幕檔');
  else if (sub.loading) problems.push('字幕檔讀取中');
  else if (sub.error) problems.push('換一個字幕檔');
  else if (parsed && !parsed.cues.length) problems.push('字幕檔裡讀不到任何字幕');
  problems.push(...channelProblems(channels));
  problems.push(...notesProblems(notes));
  if (conn.status !== 'ready') problems.push('在上方連線 GitHub');

  const busy = job?.phase === 'committing';
  const canPublish = problems.length === 0 && !busy;

  // 要寫進 videos.json 的這一筆；發布與新分頁預覽共用
  const description = form.description.trim();
  const entry = {
    id,
    youtubeId,
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
      // 之後再改就是更新這支影片
      setTarget(id);
      setJob({ phase: 'deploying', id, commitSha: result.commitSha, startedAt: Date.now() });
    } catch (err) {
      setJob({ phase: 'failed', id, error: err.message });
    }
  }

  useDeployWatcher(conn.gh, job, setJob);

  // 推薦標籤：連線後用 repo 最新的影片清單，沒連線就用網站目前打包的清單
  const tagSuggestions = useMemo(() => collectTags(conn.videos ?? bundledVideos), [conn.videos]);

  const siteUrl = settings.owner && settings.repo ? publicSiteUrl(settings.owner, settings.repo) : '';
  const duration = parsed?.cues.at(-1)?.end;

  return (
    <div className="container publish-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={18} aria-hidden="true" />
        返回列表
      </Link>

      <header className="video-head">
        <p className="eyebrow">Backstage</p>
        <h1>發布影片</h1>
        <p className="lead">
          貼上 YouTube 網址、選字幕檔，先在預覽裡確認效果。按下發布後，網站會把資料寫進你的 GitHub repo 並自動重新部署，約 1–2
          分鐘後所有人都看得到。
        </p>
      </header>

      <ConnectionPanel settings={settings} conn={conn} onConnect={connect} onDisconnect={disconnect} />

      <div className="publish-layout">
        <div className="publish-form">
          {/* ---------- 影片 ---------- */}
          <section className="panel" aria-labelledby={`${uid}-video`}>
            <div>
              <p className="eyebrow">Step 2 · 影片</p>
              <h2 id={`${uid}-video`} className="panel__title">
                影片資料
              </h2>
            </div>

            {conn.status === 'ready' && conn.videos.length > 0 && (
              <div className="field">
                <label className="field__label" htmlFor={`${uid}-target`}>
                  要做什麼
                </label>
                <div className="select">
                  <select
                    id={`${uid}-target`}
                    className="input"
                    value={target}
                    onChange={(event) => chooseTarget(event.target.value)}
                    disabled={busy}
                  >
                    <option value="">新增一支影片</option>
                    {conn.videos.map((video) => (
                      <option key={video.id} value={video.id}>
                        更新：{video.title}（{video.id}）
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} aria-hidden="true" />
                </div>
              </div>
            )}

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
                  '貼上網址後，會用右邊的預覽自動檢查影片能不能嵌入播放。'
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
                按 Enter 或逗號加入，最多 10 個，每個最多 20 字。點下方已有的標籤可以直接加入。
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
                {existing ? '，更新時不能改。' : '。預設用影片 ID，可以改成好記的英文。'}
              </p>
            </div>
          </section>

          {/* ---------- 字幕檔 ---------- */}
          <section className="panel" aria-labelledby={`${uid}-sub`}>
            <div>
              <p className="eyebrow">Step 3 · 字幕</p>
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
              <span>或把檔案拖曳到這裡；.ass 會自動轉成 .srt，Name 欄位當作說話人</span>
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
                        ? '看起來有亂碼，換一個編碼試試。'
                        : '發布時會轉存成 UTF-8。預覽裡的字是亂碼的話，換一個編碼。'}
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
              <p className="eyebrow">Step 4 · Cast</p>
              <h2 id={`${uid}-cast`} className="panel__title">
                說話人顏色
              </h2>
            </div>
            {!parsed ? (
              <p className="muted">選擇字幕檔後，這裡會列出字幕裡的說話人。</p>
            ) : speakers.length === 0 ? (
              <p className="muted">
                字幕裡沒有說話人標記，所有字幕會用中性色。要分色的話，在字幕行開頭寫{' '}
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
                    {duplicateColors.map((names) => names.join('、')).join('；')} 用了同一個顏色，觀眾會比較難分辨。
                  </p>
                )}
              </>
            )}
          </section>

          {/* ---------- 註釋 ---------- */}
          <section className="panel" aria-labelledby={`${uid}-notes`}>
            <div>
              <p className="eyebrow">Step 5 · Notes</p>
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

          {/* ---------- 聊天室重播 ---------- */}
          <section className="panel" aria-labelledby={`${uid}-chat`}>
            <div>
              <p className="eyebrow">Step 6 · Chat replay</p>
              <h2 id={`${uid}-chat`} className="panel__title">
                聊天室重播（選填）
              </h2>
            </div>
            <p className="panel__text muted">直播錄檔可以附上聊天紀錄，影片頁會在播放器右邊依時間重播聊天室。</p>
            <ChatField value={chat} onChange={setChat} youtubeId={youtubeId} disabled={busy} />
          </section>
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
              用正式影片頁的版面預覽，只有這台電腦看得到。這一頁要保持開著，修改會自動同步過去。
            </p>
          </div>
        </section>

        {/* ---------- 發布 ---------- */}
        <section className="panel panel--ticket publish-submit" aria-labelledby={`${uid}-publish`}>
          <p className="eyebrow">Step 7 · Admit One</p>
          <h2 id={`${uid}-publish`} className="panel__title">
            {mode === 'create' ? '發布' : '更新'}
          </h2>

          {problems.length > 0 ? (
            <div>
              <p className="field__label">發布前還需要：</p>
              <ul className="checklist">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
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
              {job.phase !== 'committing' && (
                <button type="button" className="btn btn--ghost" onClick={() => chooseTarget('')}>
                  再發布一支
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
