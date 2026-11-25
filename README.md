# 非官方字幕

在 YouTube 嵌入影片上掛外部字幕，依說話人分色，觀眾可切換三種字幕樣式。純靜態網站（React + Vite），可直接部署到 GitHub Pages。視覺風格依照 `Luxury Neumorphic Estate.design.md`。

## 功能

- **SRT 說話人擴充**：字幕行開頭寫 `<v 名字>` 標記說話人
- **依說話人分色**：每位說話人固定一個顏色，可在設定檔指定，未指定的自動配色
- **三種字幕樣式**：黑底彩字（色塊）／彩框白字（彩色描邊）／白框彩字（白色描邊），選擇會記在瀏覽器
- **在網站上發布**：在 `/#/publish` 貼 YouTube 網址、上傳字幕、選顏色並即時預覽，按發布就寫進 GitHub repo 並自動部署
- **含字幕的全螢幕**：播放器下方的全螢幕鈕會把影片、字幕、工具列一起放大
- **模糊搜尋**：列表頁搜尋標題、標籤、說話人、說明（Fuse.js）。容許拼錯，全形半形、大小寫、平假名片假名都視為相同；用空白分開多個詞時每個都要符合
- 淺色／深色主題

## 本機開發

```bash
npm install
npm run dev        # http://localhost:5173
npm run check:subs # 檢查所有字幕檔與設定
npm run build      # 會先自動執行 check:subs
```

## 在網站上發布影片（推薦）

發布頁**只在本機**出現：執行 `npm run dev`，打開 http://localhost:5173/#/publish （頁尾的「發布影片」）。上線版本不會有這個連結和頁面，也不會打包它的程式碼，所以觀眾看不到。（想讓上線版本也有，可在建置時設環境變數 `VITE_PUBLISH_PAGE=true`。）

在本機發布一樣是直接寫進 GitHub repo 並觸發部署，不需要先 push。第一次要自己填 GitHub 帳號和 repo 名稱，之後會記住。

1. **連線 GitHub**：填帳號、repo、分支，貼上 fine-grained personal access token。
   - 到 GitHub 的 Settings → Developer settings → Personal access tokens → Fine-grained tokens 新增
   - Repository access 只勾這個 repo
   - Permissions：**Contents: Read and write**（必要）、**Actions: Read-only**（選用，用來在頁面上顯示部署進度）
   - 勾「記住在這個瀏覽器」會存在 localStorage；不勾的話關分頁就清除。token 只會送到 `api.github.com`
2. **影片資料**：YouTube 網址（watch、youtu.be、shorts、embed 都可以）、標題、說明、標籤、網址代稱。標籤按 Enter 或逗號加入，下方會列出其他影片用過的標籤，點一下就能加入。
3. **字幕檔**：選 .srt 或拖曳進來。Big5、UTF-16 會自動辨識，發布時轉存成 UTF-8；有亂碼可以手動換編碼。
   - **頻道（選填，最多 5 個）**：按「加入頻道」，貼任一個 YouTube 頻道連結（`https://www.youtube.com/@帳號`、`/channel/UC…`，或直接打 `@帳號`），會用 YouTube Data API 帶出頭貼和名稱，顯示在影片頁標籤下方。需要一組 API 金鑰：到 Google Cloud 啟用 YouTube Data API v3 → 憑證 → 建立 API 金鑰，建議限制網站為 `http://localhost:5173/*`。金鑰只存在你的瀏覽器；頻道資料在發布時查一次存進 `videos.json`，觀眾瀏覽不會用到 API 額度。頻道換頭貼後舊圖可能失效，會改顯示名稱第一個字，到發布頁「更新」該影片並按重新讀取即可。
   - **註釋（選填）**：每則一個時間＋內容。新增時自動帶入預覽目前播放的時間，也可以手動輸入 `1:23`、`1:02:03`、`83.5`。時間落在某句字幕內，那句字幕一出現就會在後面標示（*編號），影片頁點編號會跳到那句字幕的開頭；沒有字幕的時間只會列在影片頁下方，點編號跳到註釋時間。註釋會自動存成瀏覽器草稿（每支影片一份，發布後清掉），也可以匯出成 JSON 檔備份、之後再匯入。
   - **聊天室重播（選填）**：直播錄檔可以上傳 yt-dlp 下載的聊天紀錄（`yt-dlp --skip-download --write-subs --sub-langs live_chat 影片網址`，得到 `*.live_chat.json`）。網站在瀏覽器裡轉成純文字精簡格式（時間、名字、身分、訊息、超級留言金額；不存頭貼和圖片，自訂表情變成 `:代碼:`），存到 `public/chats/<id>.json`。影片頁會在播放器右邊依播放時間重播聊天室（窄螢幕在影片下方），工具列可以開關，全螢幕時一樣在右邊。
4. **說話人顏色**：每位說話人選一個顏色，右邊預覽即時更新，三種字幕樣式都可以切換確認。
5. **發布**：字幕檔和 `videos.json` 會寫進同一個 commit，GitHub Actions 自動重新部署，頁面上會顯示進度，完成後給你分享網址。

已發布的影片可以在「要做什麼」選單選「更新」，改標題、顏色或換字幕檔。

沒連線 GitHub 也能用這頁預覽字幕效果，只是不能發布。

### 標籤顏色

本機開發時，頁尾的「標籤顏色」（`/#/tag-colors`）可以幫每個標籤選文字顏色（調色盤七色，或「預設」不上色）。儲存後寫進 `src/data/tags.json` 並重新部署，列表頁、影片頁、搜尋框裡的標籤都會套用。和發布頁共用同一組 GitHub 連線。

也可以直接編輯 `src/data/tags.json`：

```json
{
  "動畫": "blue",
  "訪談": { "light": "#F2C1D9", "deep": "#8A2E5C" }
}
```

值可以是調色盤名稱（見下方「說話人顏色」），或自訂兩個色碼：`deep` 是淺色主題（米色底）的文字顏色，`light` 是深色主題（深灰底）的文字顏色。標籤顏色頁選「自訂」時會即時顯示兩種底色上的預覽和對比，低於 4.5:1 會提醒。

> 從網站發布會直接在 GitHub 上新增 commit。之後要在本機改檔案前，先 `git pull`，避免衝突。

## 手動新增一支影片

1. 把字幕檔放到 `public/subtitles/`，**存成 UTF-8**。
2. 在 `src/data/videos.json` 加一筆：

```json
{
  "id": "my-video",
  "youtubeId": "dQw4w9WgXcQ",
  "title": "影片標題",
  "description": "列表與影片頁顯示的說明（選填）",
  "subtitle": "subtitles/my-video.srt",
  "tags": ["訪談", "科技"],
  "speakers": {
    "主持人": "gold",
    "來賓": "blue"
  }
}
```

| 欄位 | 必填 | 說明 |
|---|---|---|
| `id` | 是 | 網址用，只能英數字、`_`、`-`。影片頁網址為 `/#/video/<id>` |
| `youtubeId` | 是 | YouTube 網址 `watch?v=` 後面那 11 個字元 |
| `title` | 是 | 標題 |
| `subtitle` | 是 | 相對於 `public/` 的字幕檔路徑 |
| `description` | 否 | 說明文字 |
| `tags` | 否 | 標籤，字串陣列。顯示在影片頁，列表頁可以依標籤篩選 |
| `speakers` | 否 | 說話人顏色，見下方。名稱要和字幕裡的 `<v 名字>` 完全一致 |
| `thumbnail` | 否 | 自訂縮圖網址，預設用 YouTube 縮圖 |
| `chat` | 否 | 聊天室重播檔案路徑（相對於 `public/`），例如 `chats/my-video.json`。建議用發布頁上傳 yt-dlp 的聊天紀錄自動產生 |
| `notes` | 否 | 註釋：`[{ "time": 83.5, "text": "註釋內容" }]`，time 是秒數。依時間排序編號；字幕播到該時間時標示（*編號），影片頁下方列出註釋，點編號跳到該時間 |
| `channels` | 否 | 顯示在影片頁的頻道，可以多個：`[{ "name", "url", "handle", "avatar" }]`。建議用發布頁自動產生（舊格式的單一 `channel` 也讀得到） |

3. 執行 `npm run check:subs`，確認沒有錯誤，並看哪些說話人是自動配色。

## SRT 說話人擴充格式

語法沿用 WebVTT 的 voice tag，在**字幕行開頭**寫 `<v 名字>`：

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

- 標記只在**行首**有效；名字可以含空白（`<v Dr. Lee>`）
- 同一句字幕內，沒有標記的行**沿用上一行**的說話人；不會跨到下一句
- 每句的第一行沒有標記 → 無說話人
- 相容 WebVTT 寫法：`<v.loud 名字>` 的 class 會被忽略，結尾的 `</v>` 可寫可不寫
- 支援 SRT 常見的 `<i>` `<b>` `<u>`；其他標籤（如 `<font>`）會被移除
- 時間軸接受 `,` 或 `.` 當毫秒分隔；時間重疊的字幕會同時顯示，依開始時間由上而下排列
- 一般播放器打開這個檔案時，`<v 名字>` 會被當成未知標籤；如要給其他播放器用，可轉成 `.vtt`（WebVTT 原生支援 voice tag）

## 說話人顏色

`speakers` 的值可以是調色盤名稱：

| 名稱 | 黑底彩字（light） | 白底／色底（deep） |
|---|---|---|
| `gold` | `#E8CB74` | `#7A5F14` |
| `blue` | `#9EC5F0` | `#2F5B8C` |
| `green` | `#95D2A1` | `#33693F` |
| `red` | `#F4A79F` | `#A1342B` |
| `violet` | `#CDB8EE` | `#63458A` |
| `teal` | `#8ED8D0` | `#256660` |
| `orange` | `#F5BA6E` | `#8A5210` |

每組在三種樣式下的對比都在 6:1 以上（描邊樣式以字和描邊的對比計算）。也可以自訂兩個色階：

```json
"speakers": { "主持人": { "light": "#F2C1D9", "deep": "#8A2E5C" } }
```

自訂時請確認 `light` 在深色底上、`deep` 配白色時都清楚可讀（WCAG 對比 ≥ 4.5:1）。沒有設定的說話人，會依出場順序從還沒用到的顏色依序分配。

## 部署到 GitHub Pages

1. 在 GitHub 建立 repository，把這個資料夾推上 `main` 分支：
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<帳號>/<repo>.git
   git push -u origin main
   ```
2. repo 的 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
3. 之後每次 push 到 `main`，`.github/workflows/deploy.yml` 會自動建置並部署。網址為 `https://<帳號>.github.io/<repo>/`。

設計上不需要知道 repo 名稱：Vite 的 `base` 設為 `./`，路由用 HashRouter（`/#/video/xxx`），重新整理不會 404。

## 技術說明

- 參考 [siloor/youtube.external.subtitle](https://github.com/siloor/youtube.external.subtitle) 的做法：用 YouTube IFrame Player API 讀播放時間，把字幕層疊在 iframe 上。
- YouTube 的原生全螢幕只會放大 iframe，外掛字幕會被蓋住，所以以 `fs: 0` 關閉原生全螢幕，改用自己的全螢幕按鈕放大整個播放器容器。iPhone Safari 不支援對一般元素全螢幕，會改成鋪滿視窗。
- 字幕字級隨播放器高度縮放（CSS container query）。

## 專案結構

```
public/subtitles/        字幕檔
src/data/videos.json     影片清單與說話人顏色
src/data/tags.json       標籤顏色
src/lib/srt.js           SRT + 說話人解析
src/lib/speakers.js      調色盤與配色邏輯
src/lib/search.js        列表頁模糊搜尋與文字正規化
src/hooks/               YouTube 播放器、字幕同步、全螢幕、偏好設定
src/components/          播放器、字幕層、樣式切換、卡片等
src/pages/               列表頁、影片頁、發布頁
src/lib/github.js        GitHub API（讀 videos.json、寫 commit、查部署進度）
src/lib/publish.js       發布流程
src/components/publish/  發布頁的元件
scripts/check-subtitles.mjs  字幕檢查
```

示範用的兩支影片為 Blender 基金會的開放電影，掛載的字幕是功能示範，不是影片原本的對白。
