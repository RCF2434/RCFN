# RCFN · にじさんじ非官方字幕

在 YouTube 嵌入影片上顯示外掛字幕，並依說話人分色；觀眾可切換三種字幕樣式。本專案為純靜態網站（React + Vite），可直接部署至 GitHub Pages。視覺風格依照 `Luxury Neumorphic Estate.design.md`。

## 功能

- **多語字幕**：每支影片可上傳中文／English／日本語字幕（至少一種），觀眾在工具列勾選要顯示的語言，可同時看雙語或三語字幕
- **SRT 說話人擴充**：於字幕行開頭以 `<v 名字>` 標記說話人
- **ASS 字幕匯入**：發布頁可上傳 .ass／.ssa，自動轉為 SRT，`Name` 欄位作為說話人
- **依說話人分色**：每位說話人對應固定顏色，可於設定檔指定或自訂色碼，未指定者自動配色
- **三種字幕樣式**：黑底彩字（色塊）／彩框白字（彩色描邊）／白框彩字（白色描邊），選擇結果儲存於瀏覽器
- **網頁發布**：於 `/publish` 依步驟填寫影片資料、上傳字幕並設定顏色，即時預覽後寫入 GitHub repo 並自動部署
- **含字幕的全螢幕**：播放器下方的全螢幕按鈕會一併放大影片、字幕與工具列
- **聊天室重播**：直播錄檔可附上聊天紀錄，依播放時間同步顯示
- **註釋**：可於指定時間加上註釋，字幕上標示編號，影片頁下方列出全部註釋
- **兩個影片列表**：「にじさんじ」（`/`）與「NIJISANJI EN」（`/en`），由頁首切換。每支影片只屬於其中一個列表
- **模糊搜尋**：列表頁可搜尋標題、標籤、說話人與說明（Fuse.js），搜尋與標籤篩選僅限目前的列表。容許拼字錯誤，全形半形、大小寫、平假名片假名均視為相同；以空白分隔的多個詞須全部符合
- 淺色／深色主題

## 本機開發

```bash
npm install
npm run dev        # http://localhost:5173
npm run check:subs # 檢查所有字幕檔與設定
npm run build      # 會先自動執行 check:subs
```

## 透過網頁發布影片（建議）

發布頁與管理頁**僅在本機開發時**提供：執行 `npm run dev` 後，由頁尾的「發布影片」（`/publish`）新增影片，「管理影片」（`/manage`）編輯或刪除已發布的影片。上線版本不包含這些頁面、連結及其程式碼，觀眾無法存取。如需在上線版本提供，可於建置時設定環境變數 `VITE_PUBLISH_PAGE=true`。

本機發布同樣會直接寫入 GitHub repo 並觸發部署，不需先 push。首次使用需填寫 GitHub 帳號與 repo 名稱，之後會自動帶入。

發布分為四個步驟，完成一個步驟後按「下一步」繼續，也可透過上方的步驟列切換：

1. **影片與聊天室**
   - **影片資料**：所屬列表（にじさんじ／NIJISANJI EN 擇一，必填）、YouTube 網址（支援 watch、youtu.be、shorts、embed）、標題、說明、標籤、頻道、網址代稱。標籤以 Enter 或逗號加入，下方會列出其他影片使用過的標籤，點選即可加入；標籤可拖曳調整順序。說明中的換行會保留至影片頁，`[文字](連結)` 會顯示為超連結（開新分頁，僅限 http／https）。
   - **頻道（選填，最多 5 個）**：貼上 YouTube 頻道連結（`https://www.youtube.com/@帳號`、`/channel/UC…`，或輸入 `@帳號`），透過 YouTube Data API 帶入頭貼與名稱，顯示於影片頁標籤下方；可拖曳左側把手調整順序。此功能需要 API 金鑰：於 Google Cloud 啟用 YouTube Data API v3 → 憑證 → 建立 API 金鑰。「應用程式限制」請選擇**網站**並加入 `http://localhost:5173/*`（埠號以 `npm run dev` 顯示的為準）；「IP 位址」限制無法填入 localhost，不適用於此情境。金鑰僅儲存於瀏覽器；頻道資料於發布時查詢一次並存入 `videos.json`，觀眾瀏覽時不會使用 API 額度。頻道更換頭貼後舊圖可能失效，此時會改為顯示名稱首字，於管理頁「編輯」該影片並重新讀取即可。
   - **聊天室重播（選填）**：直播錄檔可上傳 yt-dlp 下載的聊天紀錄（`yt-dlp --js-runtimes node --skip-download --write-subs --sub-langs live_chat 影片網址`，產生 `*.live_chat.json`；`--js-runtimes node` 讓 yt-dlp 以 Node.js 解析 YouTube，避免缺少 JavaScript 執行環境的警告）。網站會在瀏覽器中轉為純文字精簡格式（時間、名稱、身分、訊息、超級留言金額；不保存頭貼與圖片，自訂表情轉為 `:代碼:`），存至 `public/chats/<id>.json`。影片頁會在播放器右側依播放時間重播聊天室（窄螢幕顯示於影片下方），可由工具列開關，全螢幕時同樣顯示於右側。
2. **字幕與說話人**
   - **字幕檔（多語）**：中文、English、日本語各一個欄位，至少上傳一種。每種語言各自選檔、設定編碼，也可以移除；編輯既有影片時移除某種語言，發布時會從 repo 刪除該字幕檔。說話人顏色會把所有語言的說話人合併列出。
     每個字幕檔：選擇或拖曳 .srt／.ass 檔。Big5、UTF-16 會自動辨識，發布時轉存為 UTF-8；出現亂碼時可手動切換編碼。.ass 檔會轉為 SRT，`Name` 欄位作為說話人，開始與結束時間相同的多行（例如雙語字幕）合併為同一句。
   - **說話人顏色**：為每位說話人選擇調色盤顏色，或以「自訂」設定兩個色階（附對比檢查與字幕樣式預覽）。右側預覽即時更新。
3. **註釋（選填）**：每則包含時間、內容與選填的連結（有連結時，影片頁會在註釋文字最後加上外連連結，開新分頁）。新增時自動帶入預覽目前的播放時間，也可手動輸入 `1:23`、`1:02:03`、`83.5`。時間落在某句字幕內時，該句字幕出現時會標示（*編號），點選影片頁的編號會跳至該句字幕開頭；沒有字幕的時間僅列於影片頁下方，點選編號會跳至註釋時間。註釋可匯出為 JSON 檔備份，之後再匯入。
4. **連線與發布**
   - **連線 GitHub**：填寫帳號、repo、分支，並貼上 fine-grained personal access token。
     - 於 GitHub 的 Settings → Developer settings → Personal access tokens → Fine-grained tokens 新增
     - Repository access 僅勾選此 repo
     - Permissions：**Contents: Read and write**（必要）、**Actions: Read-only**（選用，用於在頁面上顯示部署進度）
     - 勾選「在此瀏覽器記住 token」時 token 存於 localStorage；未勾選則於關閉分頁後清除。token 只會傳送至 `api.github.com`
   - **發布**：字幕檔與 `videos.json` 寫入同一個 commit，由 GitHub Actions 自動重新部署。頁面會顯示部署進度，完成後提供公開網址。

其他說明：

- 未連線 GitHub 時仍可預覽字幕效果，但無法發布。
- 「在新分頁預覽影片頁」會以正式影片頁的版面顯示目前的草稿，發布頁的修改會自動同步；預覽期間需保持發布頁開啟。
- 新增影片的內容（含字幕檔與聊天紀錄）會自動儲存為瀏覽器草稿（IndexedDB），關閉分頁後重新開啟可繼續編輯；發布後草稿即清除，超過 30 天的草稿不會還原。捨棄草稿前會再次確認。

### 管理影片

「管理影片」（`/manage`）連線 GitHub 後會列出 repo 中的所有影片，可依列表切換並以標題或網址代稱搜尋。

- **編輯**：開啟 `/manage/<id>`，以相同的四個步驟修改影片，於第 4 步按「更新到網站」。編輯時每次都從 repo 載入最新內容，不另存草稿（註釋仍有各自的瀏覽器草稿）。
- **刪除**：確認後，`videos.json` 的該筆資料、字幕檔與聊天室紀錄會在同一個 commit 中刪除；其他影片仍在使用的檔案不會刪除。刪除後只能從 GitHub 的 commit 紀錄還原。

### 標籤顏色

本機開發時，可透過頁尾的「標籤顏色」（`/tag-colors`）設定每個標籤的文字顏色（調色盤七色、自訂色碼，或「預設」不上色）。儲存後寫入 `src/data/tags.json` 並重新部署，列表頁、影片頁與搜尋框中的標籤都會套用。此頁與發布頁共用同一組 GitHub 連線。

也可以直接編輯 `src/data/tags.json`：

```json
{
  "動畫": "blue",
  "訪談": { "light": "#F2C1D9", "deep": "#8A2E5C" }
}
```

值可為調色盤名稱（見下方「說話人顏色」），或兩個自訂色碼：`deep` 為淺色主題（米色底）的文字顏色，`light` 為深色主題（深灰底）的文字顏色。於標籤顏色頁選擇「自訂」時，會即時顯示兩種底色上的預覽與對比，低於 4.5:1 時會提示。

> 透過網頁發布會直接在 GitHub 上新增 commit。之後於本機修改檔案前，請先執行 `git pull` 以避免衝突。

## 手動新增影片

1. 將字幕檔放入 `public/subtitles/`，並**儲存為 UTF-8**。多語字幕建議命名為 `<id>.zh.srt`、`<id>.en.srt`、`<id>.ja.srt`。
2. 於 `src/data/videos.json` 新增一筆：

```json
{
  "id": "my-video",
  "youtubeId": "dQw4w9WgXcQ",
  "list": "nijisanji",
  "title": "影片標題",
  "description": "列表與影片頁顯示的說明（選填）",
  "subtitles": {
    "zh": "subtitles/my-video.zh.srt",
    "en": "subtitles/my-video.en.srt"
  },
  "tags": ["訪談", "科技"],
  "speakers": {
    "主持人": "gold",
    "來賓": "blue"
  }
}
```

| 欄位 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 用於網址，僅限英數字、`_`、`-`。影片頁網址為 `/video/<id>` |
| `youtubeId` | 是 | YouTube 網址 `watch?v=` 後的 11 個字元 |
| `list` | 否 | 所屬列表：`nijisanji`（にじさんじ）或 `nijisanji-en`（NIJISANJI EN）。未設定時歸在 `nijisanji`；填入其他值時 `npm run check:subs` 會報錯 |
| `title` | 是 | 標題 |
| `subtitles` | 是 | 各語言字幕檔的路徑（相對於 `public/`）：`zh` 中文、`en` English、`ja` 日本語，至少一種。舊格式的單一 `subtitle` 仍可讀取，視為中文 |
| `description` | 否 | 說明文字，換行會保留；`[文字](https://…)` 會顯示為超連結 |
| `tags` | 否 | 標籤，字串陣列。顯示於影片頁，列表頁可依標籤篩選 |
| `speakers` | 否 | 說話人顏色，見下方。名稱須與字幕中的 `<v 名字>` 完全一致 |
| `thumbnail` | 否 | 自訂縮圖網址，預設使用 YouTube 縮圖 |
| `uploader` | 否 | 影片上傳者的頻道 `{ "name", "url" }`，顯示於影片頁標題上方。發布頁會透過 YouTube oEmbed 自動帶入（不需 API 金鑰）；未設定時顯示「Now Showing」 |
| `chat` | 否 | 聊天室重播檔案路徑（相對於 `public/`），例如 `chats/my-video.json`。建議由發布頁上傳 yt-dlp 的聊天紀錄自動產生 |
| `notes` | 否 | 註釋：`[{ "time": 83.5, "text": "註釋內容", "url": "https://…" }]`，time 為秒數，url 選填。依時間排序編號；字幕播放至該時間時標示（*編號），影片頁下方列出註釋，點選編號可跳至該時間；有 url 時在文字最後加上外連連結 |
| `channels` | 否 | 顯示於影片頁的頻道，可設定多個：`[{ "name", "url", "handle", "avatar" }]`。建議由發布頁自動產生（亦相容舊格式的單一 `channel`） |

3. 執行 `npm run check:subs`，確認沒有錯誤，並檢視哪些說話人為自動配色。

## SRT 說話人擴充格式

語法沿用 WebVTT 的 voice tag，於**字幕行開頭**加上 `<v 名字>`：

```srt
1
00:00:01,000 --> 00:00:04,000
<v 主持人>歡迎收看本集節目。

2
00:00:04,500 --> 00:00:08,000
<v 來賓>謝謝邀請，
這一行沒有標記，沿用上一行的來賓。

3
00:00:08,500 --> 00:00:11,000
<v 主持人>同一句字幕裡，
<v 來賓>可以換人說話。

4
00:00:11,500 --> 00:00:14,000
<v 主持人>
標記可以獨占一行，下面都算主持人。

5
00:00:14,500 --> 00:00:17,000
沒有任何標記的字幕，以中性米白色顯示。
```

規則：

- 標記僅在**行首**有效；名字可包含空白（`<v Dr. Lee>`）
- 同一句字幕內，沒有標記的行**沿用上一行**的說話人；不會延續到下一句
- 每句的第一行沒有標記 → 無說話人
- 相容 WebVTT 寫法：`<v.loud 名字>` 的 class 會被忽略，結尾的 `</v>` 可省略
- 支援 SRT 常見的 `<i>` `<b>` `<u>`；其他標籤（如 `<font>`）會被移除
- 時間軸接受 `,` 或 `.` 作為毫秒分隔；時間重疊的字幕會同時顯示，依開始時間由上而下排列
- 一般播放器開啟此檔案時，`<v 名字>` 會被視為未知標籤；如需供其他播放器使用，可轉為 `.vtt`（WebVTT 原生支援 voice tag）

## 說話人顏色

`speakers` 的值可為調色盤名稱：

| 名稱 | 黑底彩字（light） | 白底／色底（deep） |
|---|---|---|
| `gold` | `#E8CB74` | `#7A5F14` |
| `blue` | `#9EC5F0` | `#2F5B8C` |
| `green` | `#95D2A1` | `#33693F` |
| `red` | `#F4A79F` | `#A1342B` |
| `violet` | `#CDB8EE` | `#63458A` |
| `teal` | `#8ED8D0` | `#256660` |
| `orange` | `#F5BA6E` | `#8A5210` |
| `ivory`（米白） | `#F5F0E8` | `#333333` |

每組在三種樣式下的對比皆達 6:1 以上（描邊樣式以文字與描邊的對比計算）。也可以自訂兩個色階：

```json
"speakers": { "主持人": { "light": "#F2C1D9", "deep": "#8A2E5C" } }
```

自訂時請確認 `light` 於深色底上、`deep` 搭配白色時皆清楚可讀（WCAG 對比 ≥ 4.5:1）。發布頁的「自訂」會即時顯示對比。未設定的說話人會依出場順序，從尚未使用的顏色依序分配。

米白（`ivory`）與無說話人字幕的預設顏色相同，只能手動指定，自動配色不會使用；標籤顏色也不提供此選項（等同「預設」）。

## 部署至 GitHub Pages

1. 於 GitHub 建立 repository，將此資料夾推送至 `main` 分支：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<帳號>/<repo>.git
   git push -u origin main
   ```
2. 於 repo 的 **Settings → Pages → Build and deployment → Source** 選擇 **GitHub Actions**。
3. 之後每次 push 至 `main`，`.github/workflows/deploy.yml` 會自動建置並部署。網址為 `https://<帳號>.github.io/<repo>/`。

網址不含 `#`（例如 `https://<帳號>.github.io/<repo>/video/<id>`）。GitHub Pages 沒有伺服器端路由，因此建置時（`scripts/sitePages.js`）會：

- 依 GitHub Actions 的 `GITHUB_REPOSITORY` 自動判斷網站路徑（`/<repo>/`；repo 名稱為 `<帳號>.github.io` 時為 `/`），不需手動設定。改用自訂網域時，可設定環境變數 `BASE_PATH` 與 `SITE_URL`。
- 為首頁、NIJISANJI EN 列表與每支影片各產生一份 HTML（`en/index.html`、`video/<id>/index.html`），其他網址由 `404.html` 載入網站後再顯示正確頁面。
- 舊格式的 `/#/video/<id>` 連結開啟時會自動轉為新網址。

### 分享預覽

社群平台（Facebook、Discord、X、LINE 等）的分享預覽讀取的是 HTML 中的 Open Graph／X meta，建置時會自動寫入每個頁面：

- **首頁與列表**：標題與說明取自 `index.html` 的 `<title>` 與 `<meta name="description">`，分享圖為 `public/og-image.jpg`（1200×630）。
- **影片頁**：標題為影片標題，說明取自影片說明（`[文字](連結)` 只保留文字），分享圖為該影片的 YouTube 縮圖（有 `thumbnail` 時改用它）。

平台會快取預覽內容，更新後可能需要一段時間才會顯示新的標題或圖片。

## 技術說明

- 參考 [siloor/youtube.external.subtitle](https://github.com/siloor/youtube.external.subtitle) 的做法：透過 YouTube IFrame Player API 讀取播放時間，將字幕層疊在 iframe 上。
- YouTube 的原生全螢幕只會放大 iframe，外掛字幕會被遮蓋，因此以 `fs: 0` 關閉原生全螢幕，改由自訂的全螢幕按鈕放大整個播放器容器。iPhone Safari 不支援一般元素的全螢幕，會改為鋪滿視窗。
- YouTube 播放器使用隱私強化模式（`host: youtube-nocookie.com`）。網站本身不用 cookie、不放分析工具，只用 localStorage 記住觀眾的偏好；隱私說明頁在 `/privacy`（`src/pages/PrivacyPage.jsx`），新增分析工具、第三方服務或改變儲存的資料時要一起更新。
- 字幕字級隨播放器高度縮放（CSS container query）。
- 多語字幕：勾選的語言合併成一條時間軸，用同一個同步迴圈；字幕層依語言分組，由上到下為中文、English、日本語。為了不遮擋畫面：兩種語言時整體縮小為 90%、三種為 82%；第一個勾選的是主語言，其他語言再小一級；字幕區塊最高佔畫面一半，超過時從上方裁切。註釋標示（*編號）只標在主語言。

## 專案結構

```
public/subtitles/        字幕檔
src/data/videos.json     影片清單與說話人顏色
src/data/tags.json       標籤顏色
src/lib/srt.js           SRT + 說話人解析
src/lib/subtitleTracks.js  多語字幕：語言定義、合併時間軸、相容舊格式
src/lib/ass.js           ASS／SSA 轉 SRT
src/lib/lists.js         影片列表（にじさんじ／NIJISANJI EN）的定義
src/lib/speakers.js      調色盤與配色邏輯
src/lib/search.js        列表頁模糊搜尋與文字正規化
src/hooks/               YouTube 播放器、字幕同步、全螢幕、偏好設定、草稿自動儲存
src/components/          播放器、字幕層、樣式切換、卡片、確認對話框等
src/pages/               列表頁、影片頁、發布頁（含編輯）、管理頁、預覽頁、標籤顏色頁
src/lib/github.js        GitHub API（讀取 videos.json、寫入 commit、查詢部署進度）
src/lib/publish.js       發布流程
src/components/publish/  發布頁的元件
scripts/check-subtitles.mjs  字幕檢查
scripts/sitePages.js     建置時的網站路徑、各頁面 HTML 與分享預覽 meta
public/og-image.jpg      全站分享圖（1200×630）
```
