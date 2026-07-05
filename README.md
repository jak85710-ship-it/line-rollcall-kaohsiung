# 國小運動團隊 LINE 點名系統（高雄）

獨立專案，使用 **Node.js + LINE Bot SDK + Google Sheets + Gmail**，教練現場 LIFF 點名，資料自動寫入 Google 試算表，並 Email 寄出日報。

## 為什麼用 Google Sheets？

- 隊員名單、家長電話、點名紀錄 = **線上 Excel**，打開 Google 雲端硬碟就能改
- 不用維護複雜後台網頁，運動團隊教練、行政都能直接編輯
- 可分享給校方行政、家長代表共同查看

---

## 快速開始

```bash
cd line-rollcall-kaohsiung
npm install
cp .env.example .env
# 依下方步驟填好 .env
npm run seed      # 初始化試算表分頁 + 3 筆示範隊員
npm start
```

---

## 一、Google Sheets 設定（5 分鐘）

### 1. 建立試算表

1. 前往 [Google Sheets](https://sheets.google.com) 新增空白試算表
2. 命名為「運動隊點名系統」
3. 複製網址中的 **Spreadsheet ID**：
   `https://docs.google.com/spreadsheets/d/`**這段ID**`/edit`

### 2. 建立 Google Cloud 服務帳戶

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立專案 → **API 和服務** → **資料庫** → 啟用 **Google Sheets API**
3. **憑證** → **建立憑證** → **服務帳戶**
4. 建立金鑰 → 選 **JSON** → 下載金鑰檔

### 3. 分享試算表給服務帳戶

1. 打開 JSON 金鑰，找到 `client_email`（例如 `xxx@xxx.iam.gserviceaccount.com`）
2. 在 Google 試算表按 **共用**，把這個 email 加為 **編輯者**

### 4. 填入 .env

```env
GOOGLE_SPREADSHEET_ID=你的試算表ID
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> `GOOGLE_PRIVATE_KEY` 從 JSON 的 `private_key` 欄位複製，保留 `\n` 換行。

### 5. 初始化分頁

```bash
npm run seed
```

會自動建立兩個分頁：

| 分頁 | 用途 |
|------|------|
| **隊員名單** | 學生姓名、年級、家長電話等 |
| **點名紀錄** | 每次點名自動寫入，不需手動編輯 |

**隊員名單欄位**：id、姓名、年級、家長姓名、家長電話、備用電話、備註、啟用（填「是」）

---

## 二、Gmail 應用程式密碼

1. 使用一組 **Gmail 帳號**（建議專用，例如 `team-rollcall@gmail.com`）
2. 開啟 [Google 帳戶 → 安全性 → 兩步驟驗證](https://myaccount.google.com/security)
3. 搜尋 **應用程式密碼** → 建立 → 選「郵件」→ 取得 **16 位密碼**
4. 填入 `.env`：

```env
SMTP_USER=your-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop    # 16 位 App Password（空格可留可去）
EMAIL_FROM=運動隊點名系統 <your-email@gmail.com>
EMAIL_TO=coach@school.edu.tw     # 日報寄給誰
```

---

## 三、LINE 設定

完整上架步驟請看：**[docs/LINE-上架指南.md](docs/LINE-上架指南.md)**

快速摘要：

1. [LINE Developers Console](https://developers.line.biz/) 建立 Messaging API Channel
2. 取得 `LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`
3. 建立 **LIFF App**：
   - Endpoint URL：`https://你的網域/liff/rollcall`
   - Scope：`profile`、`openid`
   - Size：Full
4. Webhook URL：`https://你的網域/line/webhook`
5. 教練 LINE User ID 填入 `COACH_LINE_USER_IDS`（在 LINE 輸入「我的ID」可取得）
6. 選用：`npm run setup-rich-menu` 建立選單列

---

## 四、免費部署到 Render（推薦）

> **一鍵部署連結**（需登入 Render + GitHub）  
> https://render.com/deploy?repo=https://github.com/jak85710-ship-it/line-rollcall-kaohsiung

> **建議用 Render**，因 LINE Webhook 需要長時間運行的伺服器。Vercel 是 Serverless，不適合此類 Bot。

詳細環境變數清單見：[docs/RENDER-部署清單.md](docs/RENDER-部署清單.md)

### 步驟

1. 將程式碼推送到 **GitHub**
2. 前往 [render.com](https://render.com) 註冊（免費）
3. **New → Web Service** → 連接 GitHub repo
4. 設定：
   - **Runtime**：Node
   - **Build Command**：`npm install`
   - **Start Command**：`npm start`
   - **Plan**：Free
5. 在 **Environment** 貼上 `.env` 所有變數
6. 部署完成後，複製網址（例如 `https://line-rollcall.onrender.com`）
7. 更新：
   - `.env` 的 `BASE_URL`
   - LINE LIFF Endpoint URL
   - LINE Webhook URL
   - Render 重新部署

也可使用專案內的 `render.yaml` 一鍵部署：

```bash
# Render Dashboard → New → Blueprint → 選此 repo
```

### 注意

- Render 免費方案 15 分鐘無流量會休眠，首次請求需等 ~30 秒唤醒
- 若需 24 小時不間斷，可升級 Render 付費方案，或使用 [UptimeRobot](https://uptimerobot.com) 每 5 分鐘 ping `/health` 保持唤醒

---

## 使用流程

```
教練打開 LINE → 點名 LIFF → 點擊隊員切換狀態 → 確認送出
     ↓                              ↓
Google Sheets 寫入點名紀錄    Gmail 寄出 HTML 日報
     ↓
行政打開 Google 試算表即可查看 / 編輯隊員資料
```

### 隊員資料管理

直接在 Google 試算表 **隊員名單** 分頁新增/修改，無需後台網頁。

---

## API 端點

| Method | Path | 說明 |
|--------|------|------|
| GET | `/health` | 健康檢查 |
| GET | `/api/players` | 取得隊員清單（LIFF） |
| POST | `/api/rollcall` | 提交點名 |
| POST | `/line/webhook` | LINE Bot Webhook |

---

## 目錄結構

```
line-rollcall-kaohsiung/
├── server.js
├── render.yaml              # Render 一鍵部署
├── src/
│   ├── services/
│   │   ├── sheets.js        # Google Sheets 資料層
│   │   ├── line.js          # LINE 驗證
│   │   └── email.js         # Gmail 日報
│   ├── routes/              # API + Webhook
│   └── middleware/auth.js   # 教練白名單驗證
├── public/liff/rollcall.html
└── scripts/init-sheets.js   # 初始化試算表
```
