# LINE 上架指南（中山國小桌球隊點名系統）

本指南協助你將系統部署到網路，並連接 LINE 官方帳號。

---

## 概覽

```
LINE 官方帳號
    ├── 輸入「點名」→ LIFF 點名頁（教練手機點名）
    ├── 輸入「後台」→ 網頁版完整點名表（5 種狀態 + Email）
    └── Rich Menu 選單列（選用）

伺服器（Render 免費版）
    ├── /line/webhook     ← LINE 訊息
    ├── /liff/rollcall    ← LIFF 點名
    └── /admin/           ← 後台點名表
```

---

## 第一步：部署到 Render（約 15 分鐘）

### 1. 上傳程式碼到 GitHub

在專案資料夾執行：

```powershell
cd C:\Users\USER\Projects\line-rollcall-kaohsiung
git init
git add .
git commit -m "Initial commit: LINE rollcall system"
```

到 [github.com](https://github.com) 建立新 repository（例如 `line-rollcall-kaohsiung`），然後：

```powershell
git remote add origin https://github.com/你的帳號/line-rollcall-kaohsiung.git
git branch -M main
git push -u origin main
```

### 2. 在 Render 建立 Web Service

1. 前往 [render.com](https://render.com) 註冊
2. **New → Web Service** → 連接 GitHub repo
3. 設定：
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 3. 設定環境變數（Environment）

在 Render Dashboard → Environment，新增以下變數：

| 變數 | 值 | 說明 |
|------|-----|------|
| `BASE_URL` | `https://你的服務.onrender.com` | 部署後的網址 |
| `LINE_CHANNEL_ID` | （第三步取得） | |
| `LINE_CHANNEL_SECRET` | （第三步取得） | |
| `LINE_CHANNEL_ACCESS_TOKEN` | （第三步取得） | |
| `LIFF_ID` | （第三步取得） | |
| `COACH_LINE_USER_IDS` | 教練的 LINE User ID | 可先留空，之後再填 |
| `ADMIN_TOKEN` | `12345` | 後台密碼 |
| `SMTP_USER` | `ben83127@gmail.com` | |
| `SMTP_PASS` | （Gmail 應用程式密碼） | |
| `EMAIL_FROM` | `運動隊點名系統 <ben83127@gmail.com>` | |
| `EMAIL_TO` | `ben83127@gmail.com` | |

> Google Sheets 變數可先不填，系統會使用內建的 63 位隊員資料。

### 4. 部署完成

複製 Render 給你的網址，例如：`https://line-rollcall-kaohsiung.onrender.com`

測試：瀏覽器開啟 `https://你的網址/health` 應顯示 `{"status":"ok",...}`

---

## 第二步：LINE Developers 設定（約 10 分鐘）

### 1. 建立 Provider 與 Channel

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 登入 → **Create a new provider**（例如：中山桌球隊）
3. **Create a new channel** → 選 **Messaging API**
4. 填寫 Channel 名稱、說明、類別等 → 建立

### 2. 取得 Channel 憑證

在 Channel 的 **Basic settings** 分頁：

- **Channel ID** → 填入 `LINE_CHANNEL_ID`
- **Channel secret** → 填入 `LINE_CHANNEL_SECRET`

在 **Messaging API** 分頁：

- 點 **Issue** 取得 **Channel access token** → 填入 `LINE_CHANNEL_ACCESS_TOKEN`

### 3. 設定 Webhook

在 **Messaging API** 分頁：

1. **Webhook URL** 填入：
   ```
   https://你的網址.onrender.com/line/webhook
   ```
2. 開啟 **Use webhook**
3. 關閉 **Auto-reply messages**（避免與 Bot 衝突）
4. 關閉 **Greeting messages**（我們用程式自訂歡迎訊息）

點 **Verify** 確認 Webhook 成功（需 Render 已部署且 LINE 變數已設定）。

### 4. 建立 LIFF App

1. 在同一 Provider 下 → **Create a new channel** → 選 **LINE Login**
2. 或在 Messaging API Channel 的 **LIFF** 分頁 → **Add**
3. 設定：

| 項目 | 值 |
|------|-----|
| LIFF app name | 桌球隊點名 |
| Size | Full |
| Endpoint URL | `https://你的網址.onrender.com/liff/rollcall` |
| Scope | `profile`, `openid` |
| Bot link feature | On（Associate with Messaging API channel） |

4. 複製 **LIFF ID** → 填入 `LIFF_ID`

### 5. 更新 Render 環境變數

將第二步取得的所有 LINE 憑證更新到 Render Environment，然後 **Manual Deploy → Deploy latest commit**。

---

## 第三步：設定教練權限

### 取得 LINE User ID

1. 用手機加入你的 LINE 官方帳號為好友
2. 在聊天室輸入：**我的ID**
3. Bot 會回覆你的 User ID（格式：`Uxxxxxxxx...`）

### 填入環境變數

在 Render 設定：

```
COACH_LINE_USER_IDS=U1234567890abcdef,U9876543210fedcba
```

多位教練用逗號分隔。更新後重新部署。

> 若 `COACH_LINE_USER_IDS` 留空，所有 LINE 登入使用者都能點名（測試用，正式環境建議設定）。

---

## 第四步：測試

| 測試項目 | 操作 | 預期結果 |
|---------|------|---------|
| Webhook | LINE 輸入「點名」 | 收到「開始點名」按鈕 |
| 後台 | LINE 輸入「後台」 | 收到後台網址 |
| LIFF | 點「開始點名」按鈕 | 開啟點名頁面，顯示隊員清單 |
| 後台網頁 | 瀏覽器開 `/admin/` | 登入密碼 12345，看到 63 位隊員 |
| Email | 後台送出點名表 | 收到 Email 日報 |

---

## 第五步：Rich Menu 選單列（選用）

部署完成且 LINE 憑證填好後，在本機執行：

```powershell
node scripts/setup-rich-menu.js
```

腳本會建立「開始點名 / 後台管理」選單。還需上傳 2500×843 的選單圖片才會顯示（可到 LINE Official Account Manager 設計）。

---

## 常見問題

### Webhook Verify 失敗

- 確認 Render 服務已啟動（免費版首次需等 ~30 秒）
- 確認 `LINE_CHANNEL_SECRET` 正確
- 確認 Webhook URL 結尾是 `/line/webhook`

### LIFF 打開空白或錯誤

- 確認 LIFF Endpoint URL 是 `https://你的網址/liff/rollcall`（不是 .html）
- 確認 `LIFF_ID` 和 `LINE_CHANNEL_ID` 已設定
- 確認 Endpoint URL 使用 HTTPS

### 點名時顯示「沒有點名權限」

- 輸入「我的ID」取得 User ID
- 填入 `COACH_LINE_USER_IDS` 並重新部署

### Render 免費版休眠

15 分鐘無流量會休眠，首次開啟需等 ~30 秒。可註冊 [UptimeRobot](https://uptimerobot.com) 每 5 分钟 ping `/health` 保持喚醒。

---

## 快速檢查清單

- [ ] GitHub repo 已建立並 push
- [ ] Render 部署成功，`/health` 可連
- [ ] LINE Messaging API Channel 已建立
- [ ] Webhook URL 已設定且 Verify 成功
- [ ] LIFF App 已建立，Endpoint 正確
- [ ] 所有環境變數已填入 Render
- [ ] 教練 User ID 已設定
- [ ] 手機測試「點名」「後台」正常

完成以上步驟，系統即正式上架 LINE！
