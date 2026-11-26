import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const UPDATED = '2026-11-26';

/** 外部連結：開新分頁 */
function Ext({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-link">
      {children}
    </a>
  );
}

/**
 * 隱私說明（/privacy）。內容依實際程式整理：網站本身不用 cookie、不做追蹤，
 * 只用 localStorage 記住觀眾的偏好；cookie 與 IP 傳送都來自第三方（YouTube、Google Fonts、GitHub Pages）。
 * 程式改到這些行為時（例如新增分析工具、改用其他嵌入方式），這頁也要一起更新。
 */
export default function PrivacyPage() {
  useDocumentTitle('隱私說明');

  return (
    <div className="container privacy-page">
      <header className="page-head">
        <p className="eyebrow">Privacy</p>
        <h1>隱私說明</h1>
        <p className="muted">最後更新：{UPDATED}</p>
      </header>

      <div className="privacy">
        <section>
          <h2>本網站不使用 cookie，也不追蹤瀏覽行為</h2>
          <p>
            本網站沒有使用 cookie，沒有放置 Google Analytics 等分析或廣告追蹤工具，也沒有帳號、留言或任何表單，不蒐集個人資料。
          </p>
        </section>

        <section>
          <h2>瀏覽器儲存的偏好設定</h2>
          <p>
            為了記住觀看時選擇的顯示設定，網站會將這些設定儲存在瀏覽器（localStorage）中。資料只存在該裝置上，不會傳送到任何伺服器；以瀏覽器的「清除網站資料」功能即可刪除，刪除後設定會回到預設值。
          </p>
        </section>

        <section>
          <h2>第三方服務</h2>
          <p>網站使用以下第三方服務。使用時，瀏覽器會直接連線到這些服務，並適用各服務自己的隱私權政策：</p>
          <ul>
            <li>
              <strong>YouTube 影片播放器</strong>：影片透過 YouTube 嵌入播放器播放，並使用 YouTube 的「隱私強化模式」（youtube-nocookie.com）。依
              YouTube 的說明，影片開始播放前，YouTube 不會儲存造訪者的資訊；開始播放後則適用{' '}
              <Ext href="https://policies.google.com/privacy">Google 隱私權政策</Ext>。播放器的程式從 youtube.com 載入。
            </li>
            <li>
              <strong>YouTube 縮圖與頻道頭貼</strong>：影片縮圖與頻道頭貼由 YouTube／Google 的伺服器（i.ytimg.com、yt3.ggpht.com）提供，載入時 IP
              位址會傳送給 Google。
            </li>
            <li>
              <strong>Google Fonts</strong>：網站字型（Noto Sans TC、Noto Sans JP）由 Google Fonts 提供，載入時 IP 位址會傳送給 Google。Google Fonts
              不會設定 cookie。
            </li>
            <li>
              <strong>GitHub Pages</strong>：網站由 GitHub Pages 託管，GitHub 會為了維運與安全記錄存取日誌（包含 IP 位址），詳見{' '}
              <Ext href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement">GitHub 隱私聲明</Ext>。
            </li>
          </ul>
        </section>

        <section>
          <h2>外部連結</h2>
          <p>網站上連到 YouTube、X 等外部網站的連結，點擊後即離開本網站，適用該網站的隱私權政策。</p>
        </section>
      </div>
    </div>
  );
}
